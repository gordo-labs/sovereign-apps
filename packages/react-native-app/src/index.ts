import type { TransportCandidate } from '@sovereign-apps/module-kernel';
import type { PairingGrant } from '@sovereign-apps/protocol';
import { ReactNativeIrohEndpoint } from './transport-adapter.js';

let endpoint: ReactNativeIrohEndpoint | null = null;
let activeSession: Awaited<ReturnType<ReactNativeIrohEndpoint['connect']>> | null = null;
let messageLog: string[] = [];

export async function startSovereignPeer(
  candidate: TransportCandidate,
  options: { sessionRef?: string } = {},
  signal?: AbortSignal,
): Promise<PairingGrant | null> {
  endpoint ??= new ReactNativeIrohEndpoint();
  await endpoint.start({ signal: signal ?? new AbortController().signal });
  activeSession = await endpoint.connect(candidate, { signal });
  const stream = await activeSession.openStream({ signal });
  const mobileNodeId = await getNodeId();
  if (!mobileNodeId) throw new Error('Native Iroh bridge did not return this device node id');
  await stream.write(
    new TextEncoder().encode(
      JSON.stringify(
        options.sessionRef
          ? { type: 'sovereign.pair.request', sessionRef: options.sessionRef, mobileNodeId }
          : { type: 'sovereign.peer.hello', mobileNodeId, timestamp: new Date().toISOString() },
      ),
    ),
    { signal },
  );
  const firstReply = await stream.read({ signal });
  if (!firstReply) throw new Error('Desktop closed the Iroh stream before replying');
  let grant: PairingGrant | null = null;
  const response = JSON.parse(new TextDecoder().decode(firstReply)) as {
    type?: string;
    reason?: string;
    grant?: PairingGrant;
  };
  if (response.type === 'sovereign.pair.reject')
    throw new Error(response.reason ?? 'Desktop rejected pairing');
  if (options.sessionRef) {
    if (response.type !== 'sovereign.pair.grant' || !response.grant)
      throw new Error('Desktop returned an invalid pairing grant');
    if (response.grant.peerKey !== mobileNodeId || response.grant.nodeId !== mobileNodeId)
      throw new Error('Desktop grant is not bound to this mobile Iroh identity');
    grant = response.grant;
  }
  stream
    .read()
    .then(async function drain(frame): Promise<void> {
      if (!frame) return;
      messageLog = [...messageLog, new TextDecoder().decode(frame)];
      await drain(await stream.read());
    })
    .catch(() => undefined);
  return grant;
}

export async function stopSovereignPeer(): Promise<void> {
  await activeSession?.close('app teardown');
  activeSession = null;
  await endpoint?.stop();
  endpoint = null;
}

export function getMessageLog(): string[] {
  return [...messageLog];
}
export function clearMessageLog(): void {
  messageLog = [];
}
export async function getNodeId(): Promise<string | null> {
  if (!endpoint) return null;
  try {
    return (await endpoint.diagnostics()).nodeId || null;
  } catch {
    return null;
  }
}
export function getTransportEndpoint(): ReactNativeIrohEndpoint | null {
  return endpoint;
}
export * from './secure-store.js';
export * from './lan-discovery.js';
