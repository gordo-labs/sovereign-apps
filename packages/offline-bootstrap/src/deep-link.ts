import { createBootstrapArtifact, encodeBootstrapArtifact, validateBootstrapArtifact, type BootstrapArtifact, type HandoffResult, confirmAndAccept, BootstrapReplayStore } from './artifact.js';
import type { SecurePairingQrEnvelope } from '@sovereign-apps/protocol';

export type DeepLinkConfig = Readonly<{ schemes: readonly string[]; hosts?: readonly string[]; paths?: readonly string[] }>;
export const DEFAULT_DEEP_LINK_CONFIG: DeepLinkConfig = Object.freeze({ schemes: ['sovereign'], hosts: ['pair'], paths: ['/pair', '/'] });

function checkedConfig(config: DeepLinkConfig): DeepLinkConfig {
  if (!config.schemes.length || config.schemes.some((scheme) => !/^[a-z][a-z0-9+.-]*$/i.test(scheme))) throw new Error('Invalid deep-link scheme allowlist');
  return config;
}

export function createDeepLink(envelope: SecurePairingQrEnvelope, config: DeepLinkConfig = DEFAULT_DEEP_LINK_CONFIG): string {
  checkedConfig(config);
  const bytes = encodeBootstrapArtifact(createBootstrapArtifact(envelope));
  const data = Buffer.from(bytes).toString('base64url');
  const scheme = config.schemes[0];
  const host = config.hosts?.[0] ?? 'pair';
  return `${scheme}://${host}/pair?data=${data}`;
}

export function parseDeepLink(value: string, config: DeepLinkConfig = DEFAULT_DEEP_LINK_CONFIG, options: { now?: number } = {}): BootstrapArtifact {
  checkedConfig(config);
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Malformed deep link'); }
  if (!config.schemes.includes(url.protocol.slice(0, -1))) throw new Error('Deep-link scheme is not allowed');
  if (url.username || url.password || url.port || url.hash) throw new Error('Deep link contains forbidden URL components');
  if (config.hosts && !config.hosts.includes(url.hostname)) throw new Error('Deep-link host is not allowed');
  if (config.paths && !config.paths.includes(url.pathname)) throw new Error('Deep-link path is not allowed');
  if ([...url.searchParams.keys()].some((key) => key !== 'data') || !url.searchParams.get('data')) throw new Error('Deep link must contain only data');
  let bytes: Uint8Array;
  try { bytes = new Uint8Array(Buffer.from(url.searchParams.get('data')!, 'base64url')); } catch { throw new Error('Malformed deep-link data'); }
  return validateBootstrapArtifact(bytes, options);
}

export async function handoffDeepLink(value: string, config: DeepLinkConfig, confirm: (artifact: BootstrapArtifact) => Promise<boolean> | boolean, replayStore: BootstrapReplayStore, options: { now?: number } = {}): Promise<HandoffResult> {
  return confirmAndAccept(parseDeepLink(value, config, options), confirm, replayStore);
}
