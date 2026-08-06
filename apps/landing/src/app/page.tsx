/**
 * Sovereign App Template — PRISONS preview landing page.
 *
 * PRISONS (Peer-to-peer Remote Iroh Sovereign Network Shell):
 * A preview page showing the three apps, node connectivity status,
 * and an interactive demo of how Electron ↔ React Native ↔ Web peers
 * exchange data over Iroh QUIC.
 */

'use client';

import React, { useEffect, useState } from 'react';

type PeerStatus = 'disconnected' | 'connecting' | 'connected';

interface PeerData {
  platform: 'electron' | 'mobile' | 'web';
  nodeId: string;
  status: PeerStatus;
  lastMessage?: string;
}

const DEFAULT_PEERS: PeerData[] = [
  { platform: 'electron', nodeId: 'electron-node-0001', status: 'disconnected' },
  { platform: 'mobile', nodeId: 'mobile-node-0001', status: 'disconnected' },
  { platform: 'web', nodeId: 'web-node-0001', status: 'disconnected' },
];

export default function PrionsPreview() {
  const [peers, setPeers] = useState<PeerData[]>(DEFAULT_PEERS);
  const [message, setMessage] = useState('');
  const [log, setLog] = useState<string[]>([]);

  // Simulate a connection sequence for the preview demo
  useEffect(() => {
    const steps = [
      { electron: 'connected', mobile: 'connecting', web: 'disconnected' },
      { electron: 'connected', mobile: 'connected', web: 'connecting' },
      { electron: 'connected', mobile: 'connected', web: 'connected' },
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i >= steps.length) {
        clearInterval(interval);
        setLog((prev) => [...prev, '[PRISONS] All peers connected via Iroh QUIC']);
        return;
      }
      const s = steps[i];
      setPeers((prev) =>
        prev.map((p) => ({
          ...p,
          status: p.platform === 'electron' ? s.electron as PeerStatus
            : p.platform === 'mobile' ? s.mobile as PeerStatus
            : s.web as PeerStatus,
        })),
      );
      i++;
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const handleSend = () => {
    if (!message.trim()) return;
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    setTimeout(() => {
      setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] peer: echo "${message}"`]);
    }, 500);
    setMessage('');
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>PRISONS</h1>
        <p style={styles.subtitle}>
          Peer-to-peer Remote Iroh Sovereign Network Shell
        </p>
      </header>

      <section style={styles.peersGrid}>
        {peers.map((peer) => (
          <div key={peer.platform} style={{
            ...styles.peerCard,
            borderColor: peer.status === 'connected' ? '#4CAF50'
              : peer.status === 'connecting' ? '#FFC107'
              : '#ccc',
          }}>
            <h3 style={styles.peerTitle}>
              {peer.platform === 'electron' ? '🖥️ Desktop (Electron)'
               : peer.platform === 'mobile' ? '📱 Mobile (React Native)'
               : '🌐 Web (Next.js)'}
            </h3>
            <code style={styles.nodeId}>{peer.nodeId}</code>
            <p style={{
              ...styles.statusLabel,
              color: peer.status === 'connected' ? '#4CAF50'
                : peer.status === 'connecting' ? '#FFC107'
                : '#999',
            }}>
              {peer.status === 'connected' ? '● Connected'
               : peer.status === 'connecting' ? '◌ Connecting'
               : '○ Disconnected'}
            </p>
          </div>
        ))}
      </section>

      <section style={styles.demoSection}>
        <h2 style={styles.sectionTitle}>Interactive Demo</h2>
        <div style={styles.sendBox}>
          <input
            style={styles.input}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Send a sovereign message..."
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button style={styles.button} onClick={handleSend}>
            Send
          </button>
        </div>
        <div style={styles.log}>
          {log.map((line, i) => (
            <div key={i} style={styles.logLine}>{line}</div>
          ))}
          {log.length === 0 && (
            <em style={{ color: '#999' }}>Messages will appear here...</em>
          )}
        </div>
      </section>

      <footer style={styles.footer}>
        <p>Sovereign App Template — MIT License</p>
        <code style={styles.footerCode}>github.com/gordo-labs/sovereign-apps</code>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    maxWidth: 800,
    margin: '0 auto',
    padding: '2rem 1rem',
    color: '#1a1a1a',
  },
  header: { textAlign: 'center', marginBottom: '2rem' },
  title: { fontSize: '2.5rem', fontWeight: 800, margin: 0 },
  subtitle: { fontSize: '1rem', color: '#666', marginTop: '0.5rem' },
  peersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1rem',
    marginBottom: '2rem',
  },
  peerCard: {
    border: '2px solid #ccc',
    borderRadius: 8,
    padding: '1rem',
    textAlign: 'center',
    transition: 'border-color 0.3s',
  },
  peerTitle: { fontSize: '1rem', fontWeight: 600, margin: '0 0 0.5rem', minHeight: '2.5em' },
  nodeId: { fontSize: '0.75rem', color: '#666', fontFamily: 'monospace' },
  statusLabel: { fontSize: '0.875rem', fontWeight: 600, marginTop: '0.5rem' },
  demoSection: { marginBottom: '2rem' },
  sectionTitle: { fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' },
  sendBox: { display: 'flex', gap: '0.5rem', marginBottom: '1rem' },
  input: {
    flex: 1,
    padding: '0.5rem',
    border: '1px solid #ccc',
    borderRadius: 4,
    fontSize: '1rem',
  },
  button: {
    padding: '0.5rem 1rem',
    backgroundColor: '#000',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
  log: {
    background: '#f5f5f5',
    border: '1px solid #ccc',
    borderRadius: 4,
    padding: '1rem',
    minHeight: '120px',
    fontFamily: 'monospace',
    fontSize: '0.875rem',
  },
  logLine: { padding: '2px 0' },
  footer: { textAlign: 'center', color: '#666', fontSize: '0.8rem' },
  footerCode: { display: 'block', fontSize: '0.75rem', marginTop: '0.25rem' },
};
