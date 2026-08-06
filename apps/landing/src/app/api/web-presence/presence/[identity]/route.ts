import { createPresenceRoute } from '@sovereign-apps/web-presence/next';
import { getWebPresenceRuntime, sanitizePresence } from '../../../../../lib/runtime';

export const runtime = 'nodejs';

const handler = createPresenceRoute(getWebPresenceRuntime());

export async function GET(request: Request, context: Parameters<typeof handler>[1]) {
  const response = await handler(request, context);
  if (!response.ok) return response;
  const body = (await response.json()) as { record?: Parameters<typeof sanitizePresence>[0] };
  return Response.json(body.record ? { record: sanitizePresence(body.record) } : body, {
    status: response.status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export const PUT = handler;
export const POST = handler;
