import { createBootstrapRoute } from '@sovereign-apps/web-presence/next';
import { getWebPresenceRuntime } from '../../../../lib/runtime';

export const runtime = 'nodejs';

export const GET = createBootstrapRoute(
  getWebPresenceRuntime(),
  process.env.PRESENCE_API_BASE ?? '/api/web-presence',
);
