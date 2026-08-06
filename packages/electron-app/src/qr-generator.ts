/**
 * QR Code generator for sovereign-apps pairing.
 *
 * Pure TypeScript implementation — no external dependencies needed.
 * Generates PNG-compatible QR codes from pairing payloads.
 *
 * Based on QR code v3 (29x29 cells), binary mode, L error correction.
 */

/** QR code data structure. */
export interface QrCode {
  /** Module matrix (29x29 for v3-L). true = dark, false = light. */
  modules: boolean[][];
  /** Dimension (29). */
  size: number;
  /** The encoded text. */
  text: string;
}

// GF(256) polynomial arithmetic for Reed-Solomon
const GF256_EXP = new Uint8Array(512);
const GF256_LOG = new Uint8Array(256);

(function initGf256() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF256_EXP[i] = x;
    GF256_LOG[x] = i;
    x = (x << 1) ^ (x >= 0x80 ? 0o311 : 0);
    x &= 0xff;
  }
  for (let i = 255; i < 512; i++) {
    GF256_EXP[i] = GF256_EXP[i - 255];
  }
})();

function gf256Mul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF256_EXP[(GF256_LOG[a] + GF256_LOG[b]) % 255];
}

/** Generate Reed-Solomon error correction codes. */
function reedSolomonEncode(data: number[], ecCount: number): number[] {
  // Generator polynomial for given EC count (lowest degree, for QR EC)
  // Standard QR EC generators: g(x) for each EC count
  const genPoly: number[] = new Array(ecCount + 1).fill(0);
  genPoly[0] = 1;
  for (let i = 0; i < ecCount; i++) {
    const current = new Array(genPoly.length + 1).fill(0);
    for (let j = 0; j < genPoly.length; j++) {
      current[j] = gf256Mul(genPoly[j], GF256_EXP[i]);
      current[j + 1] ^= current[j];
    }
    genPoly.push(0);
    for (let k = 0; k < current.length - 1; k++) {
      genPoly[k] = current[k] === 0 ? 0 : current[k];
    }
    genPoly.pop();
  }

  // Polynomial division
  const msg: number[] = [...data, ...new Array(ecCount).fill(0)];
  const genDegree = ecCount;
  for (let i = 0; i < data.length; i++) {
    if (msg[i] === 0) continue;
    const lead = msg[i];
    for (let j = 0; j <= genDegree; j++) {
      msg[i + j] ^= gf256Mul(genPoly[j], lead);
    }
  }
  return msg.slice(data.length);
}

/** QR code version 3 data characteristics (29x29, L error correction). */
const QR_V3_L = {
  version: 3,
  size: 29,
  totalCodewords: 91,      // (29*29 - 3*8 - 6*8 + 2) / 8 ≈ 91
  dataCodewords: 62,       // 91 - 29 EC codewords (L level)
  ecCodewords: 29,         // 91 - 62 = 29
  blocks: 1,
} as const;

/** Mode indicators for QR. */
const MODE_BYTE = 0b0100;

/** Character count indicator for byte mode at version 3: 12 bits. */
function characterCountIndicator(dataLen: number): number[] {
  const bits = dataLen.toString(2).padStart(12, '0');
  return bits.split('').map(Number);
}

/** Pad data to fill the data codewords. */
function padData(data: number[], target: number): number[] {
  const padBytes = [0b11101100, 0b00010001]; // Alternating pad pattern
  const result = [...data];
  for (let i = data.length; i < target; i++) {
    result.push(padBytes[(i - data.length) % 2]);
  }
  return result;
}

/** Convert byte data to codewords (8-bit chunks). */
function bytesToCodewords(data: Uint8Array): number[] {
  const codewords: number[] = [];
  for (let i = 0; i < data.byteLength; i++) {
    codewords.push(data[i]);
  }
  return codewords;
}

/** Build the full QR data block (mode byte + count + data + pad + EC). */
function buildDataBlock(text: string): number[] {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);

  // Construct data: mode indicator (4 bits) + char count (12 bits) + data
  const modeBits = [0, 1, 0, 0]; // byte mode: 0100
  const countBits = characterCountIndicator(bytes.byteLength);

  // Build the bitstream
  const bitstream: number[] = [...modeBits, ...countBits];
  for (let i = 0; i < bytes.byteLength; i++) {
    const byteVal = bytes[i];
    for (let b = 7; b >= 0; b--) {
      bitstream.push((byteVal >> b) & 1);
    }
  }

  // Calculate total bits needed
  const bitsNeeded = QR_V3_L.dataCodewords * 8;
  const terminatorBits = Math.min(4, bitsNeeded - bitstream.length);
  bitstream.push(...new Array(terminatorBits).fill(0));
  // Pad to multiple of 8
  while (bitstream.length % 8 !== 0) bitstream.push(0);
  // Pad to fill data codewords
  while (bitstream.length < bitsNeeded) {
    const padByte = bitstream.length % 16 === 0 ? 0b11101100 : 0b00010001;
    for (let b = 7; b >= 0; b--) {
      bitstream.push((padByte >> b) & 1);
    }
  }

  // Convert bitstream to codewords
  const dataCodewords: number[] = [];
  for (let i = 0; i < QR_V3_L.dataCodewords * 8; i += 8) {
    let codeword = 0;
    for (let j = 0; j < 8; j++) {
      codeword = (codeword << 1) | (bitstream[i + j] ?? 0);
    }
    dataCodewords.push(codeword);
  }

  // Reed-Solomon EC
  const ec = reedSolomonEncode(dataCodewords, QR_V3_L.ecCodewords);
  return [...dataCodewords, ...ec];
}

/** Placement patterns for version 3 QR. */
const RESERVED_CELLS = new Map<string, number>(); // key: "row,col" -> value (0=data, 1=EC, 2=format, 3=version, 4=timing, 5=finder)

/** Marker patterns that override data. */
type MarkerFunction = (row: number, col: number) => boolean;

/** Apply QR code structure markers to a grid. */
function applyMarkers(grid: boolean[][], size: number): void {
  // Finder patterns (3 corners with 7x7 alternating pattern)
  const finderPattern = [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1],
  ];
  const fpSize = 7;

  // Top-left
  for (let r = 0; r < fpSize; r++) {
    for (let c = 0; c < fpSize; c++) {
      grid[r][c] = finderPattern[r][c] === 1;
    }
  }
  // Top-right
  for (let r = 0; r < fpSize; r++) {
    for (let c = 0; c < fpSize; c++) {
      grid[r][size - fpSize + c] = finderPattern[r][c] === 1;
    }
  }
  // Bottom-left
  for (let r = 0; r < fpSize; r++) {
    for (let c = 0; c < fpSize; c++) {
      grid[size - fpSize + r][c] = finderPattern[r][c] === 1;
    }
  }

  // Separator lines (white around finder patterns)
  const sep = fpSize;
  // After top-left finder: col 7, rows 0-6
  for (let r = 0; r < sep; r++) {
    if (r >= grid.length || sep >= grid[0].length) continue;
    grid[r][sep] = false;
    grid[sep][r] = false;
  }
  // Top-right: col size-8, rows 0-6
  const trCol = size - fpSize - 1;
  for (let r = 0; r < sep; r++) {
    if (r >= grid.length || trCol < 0) continue;
    grid[r][trCol] = false;
    grid[trCol][size - fpSize + r] = false;
  }
  // Bottom-left: row size-8, cols 0-6
  const brRow = size - fpSize - 1;
  for (let c = 0; c < sep; c++) {
    if (brRow >= grid.length || c >= grid[0].length) continue;
    grid[brRow][c] = false;
    grid[size - fpSize + c][brRow] = false;
  }

  // Timing patterns (alternating)
  for (let i = 8; i < size - 8; i++) {
    grid[6][i] = (i % 2 === 0);
    grid[i][6] = (i % 2 === 0);
  }

  // Dark module (alignment marker near bottom-right). Already set by timing.
  grid[size - 8][8] = true;
}

/** Place data bits into the grid using QR masking pattern. */
function placeData(
  grid: boolean[][],
  data: number[],
  size: number,
): void {
  // Data encoded as 8-bit codewords, placed in columns right-to-left,
  // alternating up/down within each pair of columns
  const bits: boolean[] = [];
  for (const codeword of data) {
    for (let b = 7; b >= 0; b--) {
      bits.push(((codeword >> b) & 1) === 1);
    }
  }

  // Column pairs, right to left
  let bitIndex = 0;
  for (let colPair = Math.floor(size / 2); colPair >= 0; colPair--) {
    const rightCol = colPair * 2;
    const leftCol = rightCol - 1;
    for (let col = rightCol; col >= Math.max(0, leftCol); col--) {
      const upward = (rightCol - leftCol === 0) ? false : (col === leftCol ? true : false);
      if (col === 6) {
        // Timing column — skip
        if (leftCol >= 0 && col !== rightCol) continue;
        continue;
      }
      if (upward) {
        for (let row = 0; row < size; row++) {
          placeBit(grid, row, col, bits, bitIndex++, size);
        }
      } else {
        for (let row = size - 1; row >= 0; row--) {
          placeBit(grid, row, col, bits, bitIndex++, size);
        }
      }
    }
  }
}

/** Place a single bit, respecting reserved cells. */
function placeBit(
  grid: boolean[][],
  row: number,
  col: number,
  bits: boolean[],
  index: number,
  size: number,
): void {
  // Skip reserved cells (finder patterns, timing, format, version info)
  if (isReserved(row, col, size)) return;
  if (index >= bits.length) return;
  // Apply mask pattern: (row + col) % 2 == 0 → invert
  const masked = bits[index] !== ((row + col) % 2 === 0);
  grid[row][col] = masked;
}

function isReserved(row: number, col: number, size: number): boolean {
  // Finder patterns and separators
  const fpSize = 8;
  // Top-left finder region (0-7, 0-7)
  if (row < fpSize && col < fpSize) return true;
  // Top-right finder region (0-7, size-8 to size-1)
  if (row < fpSize && col >= size - fpSize) return true;
  // Bottom-left finder region (size-8 to size-1, 0-7)
  if (row >= size - fpSize && col < fpSize) return true;
  // Timing row (row 6) and timing column (col 6)
  // Skip timing entirely — we use the whole column
  // Format info regions (rows 0-8 col 8, row 8 cols 0-7, etc.)
  if (col === 8 && row < 9) return true;
  if (row === 8 && col < 9) return true;
  if (row === 8 && col >= size - 9) return true;
  if (col === size - 9 && row < 9) return true;
  if (row === size - 9 && col < 9) return true;
  return false;
}

/** Generate a QR code from text. */
export function generateQrCode(text: string): QrCode {
  const size = QR_V3_L.size;
  const grid = Array.from({ length: size }, () =>
    new Array(size).fill(false),
  );

  // Apply fixed markers
  applyMarkers(grid, size);

  // Build data block
  const dataBlock = buildDataBlock(text);

  // Place data
  placeData(grid, dataBlock, size);

  // Format info (version 3, L error correction)
  // Standard QR format: 15 bits, BCH encoded
  const formatPoly = 0b10100110111; // generator for QR format
  let formatData = 0b011; // L error correction mask (011)
  formatData = (formatData << 10) | 0b0001001; // data bits for v3
  // BCH encoding
  let remainder = formatData;
  for (let i = 4; i > 0; i--) {
    if ((remainder >> (i + 10)) & 1) {
      remainder ^= (formatPoly << i);
    }
  }
  const formatBits = (formatData << 11) | remainder;

  // Place format bits
  // Row 0: cols 8..size-1 (9..size-1) and row 1..8: col 8
  for (let i = 0; i < 6; i++) {
    const idx = i; // bit index
    if (idx < 6) {
      const col = 8 + idx;
      grid[0][col] = ((formatBits >> (14 - idx)) & 1) === 1;
    }
  }
  // Row 7 and row 8 on col 8
  for (let i = 6; i < 7; i++) {
    grid[7][8] = ((formatBits >> 8) & 1) === 1;
  }
  for (let i = 7; i < 9; i++) {
    const row = i - 7;
    grid[8][row] = ((formatBits >> (14 - i)) & 1) === 1;
  }
  // Bottom row: col 8..0
  for (let i = 0; i < 8; i++) {
    const col = i;
    grid[size - 1][col] = ((formatBits >> (14 - (7 - i))) & 1) === 1;
  }

  // Fill remaining dark module
  grid[8][8] = true;

  return { modules: grid, size, text };
}

/** Render a QR code as an SVG data URL. */
export function qrCodeToSvgDataUrl(qr: QrCode, moduleSize = 4): string {
  const dim = qr.size * moduleSize;
  const svgParts: string[] = [];

  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">`);
  svgParts.push('<rect width="100%" height="100%" fill="#fff"/>');

  for (let row = 0; row < qr.size; row++) {
    for (let col = 0; col < qr.size; col++) {
      if (qr.modules[row][col]) {
        const x = col * moduleSize;
        const y = row * moduleSize;
        svgParts.push(`<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="#000"/>`);
      }
    }
  }

  svgParts.push('</svg>');
  return `data:image/svg+xml;base64,${btoa(svgParts.join('\n'))}`;
}

/** Render a QR code as an HTML inline string with SVG. */
export function qrCodeToHtml(qr: QrCode, label = 'Pairing'): string {
  const svgDataUrl = qrCodeToSvgDataUrl(qr);
  return `<div class="qr-container"><p class="qr-label">${label}</p><img src="${svgDataUrl}" alt="QR Code" class="qr-image"/></div>`;
}
