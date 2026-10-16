/**
 * Sovereign App Template — React Native UI shell with pairing flow.
 *
 * Shows a camera scan, fingerprint confirmation, and one-use Iroh pairing.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
  ScrollView,
  Linking,
} from 'react-native';
import {
  startSovereignPeer,
  getMessageLog,
  getNodeId,
  getTransportEndpoint,
  stopSovereignPeer,
} from './index.js';
import { MobilePairingClient, type PairingEvent } from './hub-pairing.js';
import { PairingQrCamera } from './PairingQrCamera.js';

const PAIRING_INPUT_PLACEHOLDER = 'Paste a pairing link or QR JSON for testing';

export function App(): React.JSX.Element {
  const [paired, setPaired] = useState(false);
  const [transportReady, setTransportReady] = useState(false);
  const [tcpForwarderStatus, setTcpForwarderStatus] = useState<string | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const pairingRef = useRef<MobilePairingClient | null>(null);
  const [pairingState, setPairingState] = useState('scanning');
  const [pairingHubId, setPairingHubId] = useState<string | null>(null);
  const [pairingFingerprint, setPairingFingerprint] = useState<string | null>(null);
  const [pairingLog, setPairingLog] = useState<string[]>([]);
  const [qrInput, setQrInput] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const pairingCandidateRef = useRef<{ id: string; kind: 'iroh'; address: string } | null>(null);

  // Initialize pairing client
  useEffect(() => {
    const client = new MobilePairingClient();
    pairingRef.current = client;

    client.onEvent((event: PairingEvent) => {
      setPairingLog((prev) => [...prev, `[${event.type}] ${event.detail ?? ''}`]);
      setPairingState(event.type);
      if (event.hubId) setPairingHubId(event.hubId);
      if (event.fingerprint) setPairingFingerprint(event.fingerprint);
      if (event.type === 'paired') {
        setPaired(true);
      }
    });

    return () => {
      client.reset();
      void stopSovereignPeer();
    };
  }, []);

  // Poll for new messages
  useEffect(() => {
    const interval = setInterval(() => {
      void getNodeId().then(setNodeId);
      const log = getMessageLog();
      if (log.length > 0) {
        setMessages([...log]);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Handle a camera scan, custom sovereign:// link, web link, or test JSON.
  const handlePairingInput = useCallback((value: string) => {
    if (!value.trim()) return;
    const client = pairingRef.current;
    if (!client) return;

    const result = client.handleQrScan(value.trim());
    if ('error' in result) {
      setPairingLog((prev) => [...prev, `[error] ${result.error}`]);
      return;
    }
    pairingCandidateRef.current = result.bootstrap
      ? { id: result.nodeId, kind: 'iroh', address: result.bootstrap }
      : null;
    setCameraOpen(false);
    setPairingLog((prev) => [
      ...prev,
      `[scanned] Hub: ${result.hubId}`,
      `[fingerprint] ${result.fingerprint} — verify it matches the desktop screen`,
    ]);
  }, []);

  // A desktop can hand off the same payload through a custom scheme or web link.
  useEffect(() => {
    let mounted = true;
    void Linking.getInitialURL().then((url) => {
      if (mounted && url) handlePairingInput(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => handlePairingInput(url));
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [handlePairingInput]);

  const handleQrSubmit = useCallback(
    () => handlePairingInput(qrInput),
    [handlePairingInput, qrInput],
  );

  // Handle fingerprint verification
  const handleVerifyFingerprint = useCallback(async () => {
    const client = pairingRef.current;
    if (!client) return;
    client.verifyFingerprint();
    setPairingLog((prev) => [...prev, '[verified] Fingerprint matches']);
    const candidate = pairingCandidateRef.current;
    if (!candidate) {
      setPairingLog((prev) => [
        ...prev,
        '[waiting] Pairing verified; desktop QR did not include a dialable bootstrap',
      ]);
      return;
    }
    try {
      const grant = await startSovereignPeer(candidate, {
        sessionRef: client.getSessionRef() ?? undefined,
      });
      if (!grant) throw new Error('Desktop did not issue a pairing grant');
      const mobileNodeId = await getNodeId();
      if (!mobileNodeId) throw new Error('Could not verify this device Iroh identity');
      client.acceptIrohGrant(grant, mobileNodeId);
      setTransportReady(true);
      setPairingLog((prev) => [
        ...prev,
        '[paired] Iroh channel authenticated and one-use pairing grant accepted',
      ]);
      try {
        const endpoint = getTransportEndpoint();
        if (!endpoint) throw new Error('Iroh endpoint is not available');
        const forwarder = await endpoint.startTcpForwarder(candidate);
        setTcpForwarderStatus(
          `Connected to desktop example service on local port ${forwarder.port}`,
        );
        const response = await fetch(`http://127.0.0.1:${forwarder.port}/health`);
        if (!response.ok)
          throw new Error(`Desktop example service returned HTTP ${response.status}`);
        const health = (await response.json()) as { status?: unknown };
        if (health.status !== 'ok') throw new Error('Desktop example service health check failed');
        setTcpForwarderStatus(
          'Secure Iroh TCP forwarder verified against the desktop example service',
        );
      } catch (error) {
        setTcpForwarderStatus(
          `Optional TCP forwarding unavailable: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } catch (error) {
      setPairingLog((prev) => [
        ...prev,
        `[connect-error] ${error instanceof Error ? error.message : String(error)}`,
      ]);
    }
  }, []);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Sovereign App</Text>
      <Text style={styles.info}>Node: {nodeId ?? 'starting...'}</Text>

      {/* Pairing section */}
      {!paired ? (
        <View style={styles.pairingBox}>
          <Text style={styles.section}>Pairing — Initial WiFi Setup</Text>

          {/* Camera scan is the primary path; text input remains diagnostic fallback. */}
          <Text style={styles.label}>Scan the desktop QR code:</Text>
          <Button
            title={cameraOpen ? 'Close camera' : 'Open camera'}
            onPress={() => setCameraOpen((open) => !open)}
          />
          {cameraOpen && (
            <View style={styles.cameraBox}>
              <PairingQrCamera onScan={handlePairingInput} onCancel={() => setCameraOpen(false)} />
            </View>
          )}
          <Text style={styles.label}>Or open a pairing link / paste a QR payload:</Text>
          <TextInput
            style={styles.input}
            placeholder={PAIRING_INPUT_PLACEHOLDER}
            value={qrInput}
            onChangeText={setQrInput}
            multiline
          />
          <Button title="Submit QR" onPress={handleQrSubmit} />

          {/* Fingerprint verification */}
          {pairingFingerprint && (
            <View style={styles.fingerprintBox}>
              <Text style={styles.fingerprintLabel}>
                Desktop fingerprint:{' '}
                <Text style={styles.fingerprintValue}>{pairingFingerprint}</Text>
              </Text>
              <Text style={styles.hint}>
                Verify this matches what the desktop screen shows, then confirm:
              </Text>
              <Button title="✓ Fingerprint Verified" onPress={handleVerifyFingerprint} />
            </View>
          )}

          {/* Pairing status */}
          <Text style={styles.statusLabel}>
            Status: <Text style={styles.statusValue}>{pairingState}</Text>
          </Text>
          {transportReady && (
            <Text style={styles.hint}>
              Iroh transport is open and the one-use pairing grant was accepted.
            </Text>
          )}
          {tcpForwarderStatus && <Text style={styles.hint}>{tcpForwarderStatus}</Text>}
          {pairingHubId && <Text style={styles.hubLabel}>Hub: {pairingHubId}</Text>}

          {/* Pairing log */}
          <View style={styles.pairingLog}>
            {pairingLog.map((line, i) => (
              <Text key={i} style={styles.logLine}>
                {line}
              </Text>
            ))}
            {pairingLog.length === 0 && (
              <Text style={styles.hint}>Pairing events will appear here...</Text>
            )}
          </View>
        </View>
      ) : (
        <View>
          <Text style={styles.status}>
            Pairing grant accepted for {pairingHubId ?? 'desktop peer'}
          </Text>
        </View>
      )}

      {/* Message log */}
      <Text style={styles.section}>Messages:</Text>
      <FlatList
        data={messages}
        keyExtractor={(item, i) => String(i)}
        renderItem={({ item }) => <Text style={styles.message}>{item}</Text>}
        style={styles.list}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  info: { fontSize: 14, color: '#666', marginBottom: 16 },
  section: { fontSize: 16, fontWeight: '600', marginTop: 12, marginBottom: 8 },
  pairingBox: {
    backgroundColor: '#f0f8ff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bcd',
  },
  cameraBox: {
    height: 320,
    overflow: 'hidden',
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  label: { fontSize: 14, color: '#333', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    marginBottom: 8,
    borderRadius: 4,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  fingerprintBox: {
    backgroundColor: '#fff9e6',
    padding: 12,
    borderRadius: 4,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eec',
  },
  fingerprintLabel: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  fingerprintValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#b8860b',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  hint: { fontSize: 12, color: '#666', marginVertical: 4 },
  statusLabel: { fontSize: 14, marginTop: 8 },
  statusValue: { fontWeight: '600', color: '#090' },
  hubLabel: { fontSize: 14, color: '#069' },
  pairingLog: {
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
    minHeight: 60,
  },
  logLine: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#555',
    paddingVertical: 1,
  },
  status: { fontSize: 14, color: '#090', marginBottom: 16 },
  list: { flex: 1, maxHeight: 200 },
  message: { fontSize: 12, fontFamily: 'monospace', paddingVertical: 2 },
});
