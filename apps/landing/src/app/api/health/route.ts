export const runtime = 'nodejs';

export function GET() {
  return Response.json({ ok: true, service: 'web-presence-example' }, { headers: { 'Cache-Control': 'no-store' } });
}
