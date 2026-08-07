import type { PairingGrant } from '@sovereign-apps/protocol';

/** Adapter boundary for iOS Keychain / Android Keystore. Never substitute AsyncStorage. */
export interface SecureStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export class PairingTrustStore {
  constructor(
    private readonly storage: SecureStorage,
    private readonly key = 'sovereign-apps/pairing-grants/v1',
  ) {}
  async list(): Promise<PairingGrant[]> {
    const raw = await this.storage.get(this.key);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((entry): entry is PairingGrant =>
        Boolean(
          entry && typeof entry === 'object' && typeof (entry as PairingGrant).id === 'string',
        ),
      );
    } catch {
      return [];
    }
  }
  async save(grant: PairingGrant): Promise<void> {
    const grants = (await this.list()).filter((entry) => entry.id !== grant.id);
    grants.push(grant);
    await this.storage.set(this.key, JSON.stringify(grants));
  }
  async revoke(id: string): Promise<void> {
    const grants = await this.list();
    await this.saveAll(
      grants.map((grant) =>
        grant.id === id ? { ...grant, revokedAt: new Date().toISOString() } : grant,
      ),
    );
  }
  async revokeAll(): Promise<void> {
    await this.saveAll(
      (await this.list()).map((grant) => ({ ...grant, revokedAt: new Date().toISOString() })),
    );
  }
  async resetIdentity(): Promise<void> {
    await this.storage.remove(this.key);
  }
  private async saveAll(grants: PairingGrant[]): Promise<void> {
    await this.storage.set(this.key, JSON.stringify(grants));
  }
}
