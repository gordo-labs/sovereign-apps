import QRCode from 'qrcode';

export type QrCode = { text: string; svg: string };

/** Standards-compliant QR generation; the maintained library handles sizing and ECC. */
export async function generateQrCode(text: string): Promise<QrCode> {
  if (!text || Buffer.byteLength(text, 'utf8') > 2048)
    throw new Error('Pairing QR payload is empty or oversized');
  const svg = await QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 });
  return { text, svg };
}

export function qrCodeToHtml(qr: QrCode, alt = 'Scan to pair'): string {
  return `<div class="qr-container" role="img" aria-label="${escapeHtml(alt)}">${qr.svg}</div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
