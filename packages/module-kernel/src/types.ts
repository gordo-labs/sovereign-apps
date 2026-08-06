export type ModuleId = string;
export type Platform = 'node' | 'electron' | 'ios' | 'android' | 'web' | 'unknown';
export type ModuleKind = 'identity' | 'grant-store' | 'discovery' | 'bootstrap' | 'transport' | 'pairing' | 'route' | 'codec' | 'diagnostics';
export type LifecycleState = 'idle' | 'starting' | 'ready' | 'stopping' | 'stopped' | 'failed';

export interface ModuleContext {
  readonly signal: AbortSignal;
  readonly platform: Platform;
  readonly now: () => number;
  readonly diagnostics?: Diagnostics;
}

export interface ModuleAvailability {
  readonly available: boolean;
  readonly reason?: string;
  readonly platforms?: readonly Platform[];
}

export interface SovereignModule {
  readonly manifest: ModuleManifest;
  readonly availability: ModuleAvailability;
  readonly state: LifecycleState;
  start(context: ModuleContext): Promise<void>;
  stop(): Promise<void>;
}

export interface ModuleManifest {
  readonly id: ModuleId;
  readonly version: `${number}.${number}.${number}` | string;
  readonly kind: ModuleKind;
  readonly dependencies?: readonly ModuleId[];
  readonly conflicts?: readonly ModuleId[];
  readonly platforms?: readonly Platform[];
  readonly configSchema?: readonly ConfigField[];
  readonly capabilities?: readonly string[];
  readonly optional?: boolean;
}

export interface ConfigField {
  readonly name: string;
  readonly type: 'string' | 'number' | 'boolean' | 'string[]' | 'object';
  readonly required?: boolean;
}

export interface IdentityStore {
  getIdentity(signal?: AbortSignal): Promise<IdentityRecord | null>;
  putIdentity(identity: IdentityRecord, signal?: AbortSignal): Promise<void>;
  deleteIdentity(signal?: AbortSignal): Promise<void>;
}
export interface KeyStore extends IdentityStore {}
export interface GrantStore {
  list(peerId?: string, signal?: AbortSignal): Promise<TrustGrant[]>;
  put(grant: TrustGrant, signal?: AbortSignal): Promise<void>;
  revoke(grantId: string, signal?: AbortSignal): Promise<void>;
}
export interface IdentityRecord { readonly id: string; readonly publicKey: string; readonly algorithm: string; readonly createdAt: string; }
export interface TrustGrant { readonly id: string; readonly peerId: string; readonly capabilities: readonly string[]; readonly issuedAt: string; readonly expiresAt: string | null; readonly revokedAt?: string; }

export interface DiscoveryCandidate { readonly id: string; readonly transport: string; readonly address: string; readonly metadata?: Readonly<Record<string, string>>; readonly seenAt: string; }
export interface Discovery extends SovereignModule { discover(options?: { signal?: AbortSignal; timeoutMs?: number }): AsyncIterable<DiscoveryCandidate>; }

export interface BootstrapEnvelope { readonly version: 1; readonly kind: 'qr' | 'ble' | 'nfc' | 'deep-link' | 'file'; readonly peerId: string; readonly expiresAt: string; readonly material: Readonly<Record<string, string>>; readonly signature?: string; }
export interface Bootstrap extends SovereignModule { export(envelope: BootstrapEnvelope, signal?: AbortSignal): Promise<Uint8Array>; import(data: Uint8Array, signal?: AbortSignal): Promise<BootstrapEnvelope>; }

export interface TransportCandidate { readonly id: string; readonly kind: string; readonly address: string; readonly priority?: number; }
export interface TransportEndpoint extends SovereignModule { candidates(signal?: AbortSignal): Promise<readonly TransportCandidate[]>; accept(signal?: AbortSignal): Promise<TransportSession>; connect(candidate: TransportCandidate, options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<TransportSession>; }
export interface TransportSession { readonly id: string; readonly candidate: TransportCandidate; openStream(options?: { signal?: AbortSignal }): Promise<FramedStream>; close(reason?: string): Promise<void>; }
export interface FramedStream { readonly id: string; read(options?: { signal?: AbortSignal }): Promise<Uint8Array | null>; write(frame: Uint8Array, options?: { signal?: AbortSignal }): Promise<void>; close(): Promise<void>; }

export interface PairingPolicy { verifyBootstrap(envelope: BootstrapEnvelope, signal?: AbortSignal): Promise<{ peerId: string; accepted: boolean }>; authenticate(session: TransportSession, requested: readonly string[], signal?: AbortSignal): Promise<AuthResult>; revoke(peerId: string, signal?: AbortSignal): Promise<void>; }
export interface AuthResult { readonly peerId: string; readonly granted: readonly string[]; readonly grantId: string; }
export interface RoutePolicy { rank(candidates: readonly TransportCandidate[], signal?: AbortSignal): Promise<readonly TransportCandidate[]>; observe(event: RouteEvent): void; }
export interface RouteEvent { readonly candidateId: string; readonly state: 'available' | 'connecting' | 'connected' | 'failed' | 'closed'; readonly at: string; readonly errorCode?: string; }
export interface AppCodec<T = unknown> { readonly capabilities: readonly string[]; encode(value: T, signal?: AbortSignal): Uint8Array; decode(frame: Uint8Array, signal?: AbortSignal): T; authorize(capability: string): boolean; }
export interface Diagnostics { emit(event: DiagnosticEvent): void; }
export interface DiagnosticEvent { readonly name: string; readonly at: string; readonly module?: ModuleId; readonly outcome?: 'ok' | 'error' | 'cancelled'; readonly fields?: Readonly<Record<string, string | number | boolean>>; }
