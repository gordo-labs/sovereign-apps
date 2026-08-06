import type { TransportCandidate } from '@sovereign-apps/module-kernel';
import { ReactNativeIrohEndpoint } from './transport-adapter.js';

let endpoint: ReactNativeIrohEndpoint | null = null;
let activeSession: Awaited<ReturnType<ReactNativeIrohEndpoint['connect']>> | null = null;
let messageLog: string[] = [];

export async function startSovereignPeer(candidate: TransportCandidate, signal?: AbortSignal): Promise<void> {
  endpoint ??= new ReactNativeIrohEndpoint();
  await endpoint.start({ signal: signal ?? new AbortController().signal });
  activeSession = await endpoint.connect(candidate, { signal });
  const stream = await activeSession.openStream({ signal });
  stream.read().then(async function drain(frame): Promise<void> {
    if (!frame) return;
    messageLog = [...messageLog, new TextDecoder().decode(frame)];
    await drain(await stream.read());
  }).catch(() => undefined);
  await stream.write(new TextEncoder().encode(JSON.stringify({
    type: 'hello', timestamp: new Date().toISOString(), payload: { message: 'mobile sovereign peer connected' },
  })), { signal });
}

export async function stopSovereignPeer(): Promise<void> {
  await activeSession?.close('app teardown');
  activeSession = null;
  await endpoint?.stop();
  endpoint = null;
}

export function getMessageLog(): string[] { return [...messageLog]; }
export function clearMessageLog(): void { messageLog = []; }
export async function getNodeId(): Promise<string | null> {
  if (!endpoint) return null;
  try { return (await endpoint.diagnostics()).nodeId || null; } catch { return null; }
}
export function getTransportEndpoint(): ReactNativeIrohEndpoint | null { return endpoint; }
