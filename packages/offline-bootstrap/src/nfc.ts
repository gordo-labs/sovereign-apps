import {
  createBootstrapArtifact,
  encodeBootstrapArtifact,
  validateBootstrapArtifact,
  confirmAndAccept,
  BootstrapReplayStore,
  type BootstrapArtifact,
  type HandoffResult,
} from './artifact.js';
import type { SecurePairingQrEnvelope } from '@sovereign-apps/protocol';

export type NfcPlatform = 'ios' | 'android';
export type NfcAvailability = Readonly<{
  available: boolean;
  platform: NfcPlatform | 'unknown';
  reason?: string;
}>;
export interface NfcAdapter {
  readonly platform: NfcPlatform | 'unknown';
  availability(): Promise<NfcAvailability>;
  write(payload: Uint8Array, signal?: AbortSignal): Promise<void>;
  read(signal?: AbortSignal): Promise<Uint8Array>;
}
export function createUnavailableNfcAdapter(
  platform: NfcPlatform | 'unknown',
  reason = 'NFC host adapter is not installed',
): NfcAdapter {
  const unavailable = async (): Promise<NfcAvailability> => ({
    available: false,
    platform,
    reason,
  });
  return {
    platform,
    availability: unavailable,
    write: async () => {
      throw new Error(reason);
    },
    read: async () => {
      throw new Error(reason);
    },
  };
}

export function encodeNdefBootstrap(envelope: SecurePairingQrEnvelope): Uint8Array {
  return encodeBootstrapArtifact(createBootstrapArtifact(envelope));
}
export function decodeNdefBootstrap(
  payload: Uint8Array,
  options: { now?: number } = {},
): BootstrapArtifact {
  return validateBootstrapArtifact(payload, options);
}
export async function handoffNfc(
  adapter: NfcAdapter,
  confirm: (artifact: BootstrapArtifact) => Promise<boolean> | boolean,
  replayStore: BootstrapReplayStore,
  options: { now?: number } = {},
): Promise<HandoffResult> {
  const availability = await adapter.availability();
  if (!availability.available) throw new Error(availability.reason ?? 'NFC unavailable');
  const artifact = decodeNdefBootstrap(await adapter.read(), options);
  return confirmAndAccept(artifact, confirm, replayStore);
}
