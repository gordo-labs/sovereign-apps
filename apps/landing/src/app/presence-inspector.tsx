'use client';

import { useState } from 'react';

type SafeRecord = {
  hubId: string;
  transportPeerId: string;
  transportKind?: string;
  issuedAt: string;
  expiresAt: string;
  candidateKinds: string[];
};

export default function PresenceInspector() {
  const [identity, setIdentity] = useState('');
  const [record, setRecord] = useState<SafeRecord | null>(null);
  const [state, setState] = useState<'empty' | 'loading' | 'ready' | 'not-found' | 'error'>('empty');

  async function resolve(event: React.FormEvent) {
    event.preventDefault();
    const value = identity.trim();
    if (!value) {
      setRecord(null);
      setState('empty');
      return;
    }
    setState('loading');
    try {
      const response = await fetch(`/api/web-presence/presence/${encodeURIComponent(value)}`, {
        cache: 'no-store',
      });
      if (response.status === 404) {
        setRecord(null);
        setState('not-found');
        return;
      }
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const body = (await response.json()) as { record?: SafeRecord };
      setRecord(body.record ?? null);
      setState(body.record ? 'ready' : 'not-found');
    } catch {
      setRecord(null);
      setState('error');
    }
  }

  return (
    <section aria-labelledby="resolve-heading">
      <h2 id="resolve-heading">Resolve a presence record</h2>
      <form onSubmit={resolve}>
        <label htmlFor="identity">Trusted identity learned during pairing</label>
        <input
          id="identity"
          value={identity}
          onChange={(event) => setIdentity(event.target.value)}
          placeholder="hub identity"
          autoComplete="off"
        />
        <button type="submit">Resolve</button>
      </form>
      <p role="status">
        {state === 'empty' && 'Enter an identity to inspect its optional presence record.'}
        {state === 'loading' && 'Resolving…'}
        {state === 'not-found' && 'No current presence record was found.'}
        {state === 'error' && 'The presence service returned an error.'}
        {state === 'ready' && 'Record received and sanitized for display.'}
      </p>
      {record && (
        <dl>
          <dt>Hub identity</dt><dd>{record.hubId}</dd>
          <dt>Transport peer</dt><dd>{record.transportPeerId}</dd>
          <dt>Transport</dt><dd>{record.transportKind ?? 'not declared'}</dd>
          <dt>Issued</dt><dd>{record.issuedAt}</dd>
          <dt>Expires</dt><dd>{record.expiresAt}</dd>
          <dt>Candidate kinds</dt><dd>{record.candidateKinds.join(', ') || 'none'}</dd>
        </dl>
      )}
      <p>
        This diagnostic view intentionally omits signatures, addresses, and
        payloads. A valid record is only a hint; the paired client must verify
        it and establish a connection independently.
      </p>
    </section>
  );
}
