import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createUnavailableAdapter } from '../dist/adapters.js';

test('SA-015 guard: no Bluetooth data route is claimed without a native adapter', async () => {
  const matrix = JSON.parse(
    fs.readFileSync(
      new URL('../../../docs/bluetooth-transport-matrix.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(matrix.status, 'bootstrap-only');
  assert.equal(matrix.verifiedPayloadLimitBytes, 0);
  assert.ok(matrix.rows.length >= 4);
  for (const row of matrix.rows) {
    assert.equal(row.nativeAdapterInRepository, false, row.pair);
    assert.equal(row.physicalEvidence, false, row.pair);
    assert.equal(row.decision, 'bootstrap-only', row.pair);
  }
  const adapter = createUnavailableAdapter('android', 'central');
  assert.equal((await adapter.availability()).available, false);
});
