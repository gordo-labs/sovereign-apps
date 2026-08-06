import { createSignalingRoute } from '@sovereign-apps/web-presence/next';
import { getWebPresenceRuntime } from '../../../../../../lib/runtime';

export const runtime = 'nodejs';
const handler = createSignalingRoute(getWebPresenceRuntime());
export const GET = handler;
export const PUT = handler;
export const POST = handler;
