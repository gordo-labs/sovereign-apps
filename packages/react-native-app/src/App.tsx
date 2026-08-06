/**
 * Sovereign App Template — React Native UI shell with pairing flow.
 *
 * Shows:
 *   - QR scanner (placeholder — real camera integration would use
 *     react-native-camera-kit or similar)
 *   - Manual pairing code entry fallback
 *   - Fingerprint verification prompt
 *   - Connection status, paired devices
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
} from 'react-native';
import { startSovereignPeer, getMessageLog, getNodeId } from './index.js';
import { MobilePairingClient, type PairingEvent } from './hub-pairing.js';

// QR scanner placeholder — in production this would use react-native-camera-kit
const QR_SCANNER_PLACEHOLDER = 'Enter desktop QR payload (JSON)';

export function App(): React.JSX.Element {
  const [peerId, setPeerId] = useState('');
  const [connected, setConnected] = useState(false);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const pairingRef = useRef<MobilePairingClient | null>(null);
  const [pairingState, setPairingState] = useState('scanning');
  const [pairingHubId, setPairingHubId] = useState<string | null>(null);
  const [pairingFingerprint, setPairingFingerprint] = useState<string | null>(null);
  const [pairingLog, setPairingLog] = useState<string[]>([]);
  const [qrInput, setQrInput] = useState('');

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
        setConnected(true);
      }
    });

    return () => {
      client.reset();
    };
  }, []);

  // Poll for new messages
  useEffect(() => {
    setNodeId(getNodeId());
    const interval = setInterval(() => {
      const log = getMessageLog();
      if (log.length > 0) {
        setMessages([...log]);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Handle QR scan (or manual input)
  const handleQrSubmit = useCallback(() => {
    if (!qrInput.trim()) return;
    const client = pairingRef.current;
    if (!client) return;

    const result = client.handleQrScan(qrInput.trim());
    if ('error' in result) {
      setPairingLog((prev) => [...prev, `[error] ${result.error}`]);
      return;
    }
    setPairingLog((prev) => [
      ...prev,
      `[scanned] Hub: ${result.hubId}`,
      `[fingerprint] ${result.fingerprint} — verify it matches the desktop screen`,
    ]);
  }, [qrInput]);

  // Handle fingerprint verification
  const handleVerifyFingerprint = useCallback(() => {
    const client = pairingRef.current;
    if (!client) return;
    client.verifyFingerprint();
    setPairingLog((prev) => [...prev, '[verified] Fingerprint matches']);
  }, []);

  // Connect to desktop via Iroh
  const handleConnect = useCallback(async () => {
    if (!peerId.trim()) return;
    await startSovereignPeer(peerId.trim());
    setConnected(true);
  }, [peerId]);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Sovereign App</Text>
      <Text style={styles.info}>Node: {nodeId ?? 'starting...'}</Text>

      {/* Pairing section */}
      {!connected ? (
        <View style={styles.pairingBox}>
          <Text style={styles.section}>Pairing — Initial WiFi Setup</Text>

          {/* QR scan / manual entry */}
          <Text style={styles.label}>Scan QR or enter payload:</Text>
          <TextInput
            style={styles.input}
            placeholder={QR_SCANNER_PLACEHOLDER}
            value={qrInput}
            onChangeText={setQrInput}
            multiline
          />
          <Button title="Submit QR" onPress={handleQrSubmit} />

          {/* Fingerprint verification */}
          {pairingFingerprint && (
            <View style={styles.fingerprintBox}>
              <Text style={styles.fingerprintLabel}>
                Desktop fingerprint: <Text style={styles.fingerprintValue}>{pairingFingerprint}</Text>
              </Text>
              <Text style={styles.hint}>
                Verify this matches what the desktop screen shows,
                then confirm:
              </Text>
              <Button title="✓ Fingerprint Verified" onPress={handleVerifyFingerprint} />
            </View>
          )}

          {/* Pairing status */}
          <Text style={styles.statusLabel}>
            Status: <Text style={styles.statusValue}>{pairingState}</Text>
          </Text>
          {pairingHubId && (
            <Text style={styles.hubLabel}>Hub: {pairingHubId}</Text>
          )}

          {/* Pairing log */}
          <View style={styles.pairingLog}>
            {pairingLog.map((line, i) => (
              <Text key={i} style={styles.logLine}>{line}</Text>
            ))}
            {pairingLog.length === 0 && (
              <Text style={styles.hint}>Pairing events will appear here...</Text>
            )}
          </View>

          {/* Direct connect fallback */}
          <View style={{ marginTop: 16 }}>
            <Text style={styles.section}>Or connect directly via Iroh:</Text>
            <TextInput
              style={styles.input}
              placeholder="Peer node id"
              value={peerId}
              onChangeText={setPeerId}
            />
            <Button title="Connect" onPress={handleConnect} />
          </View>
        </View>
      ) : (
        <View>
          <Text style={styles.status}>Paired / Connected to {pairingHubId ?? peerId}</Text>
        </View>
      )}

      {/* Message log */}
      <Text style={styles.section}>Messages:</Text>
      <FlatList
        data={messages}
        keyExtractor={(item, i) => String(i)}
        renderItem={({ item }) => (
          <Text style={styles.message}>{item}</Text>
        )}
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
