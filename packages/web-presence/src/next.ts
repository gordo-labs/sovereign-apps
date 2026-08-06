import type { WebPresenceCore } from './core.js';

export type RouteContext = { params: Promise<Record<string, string | string[] | undefined>> };
export type NextHandler = (request: Request, context: RouteContext) => Promise<Response>;
export type NextWebPresenceRoutes = { basePath: string; bootstrap: NextHandler; presence: NextHandler; signaling: NextHandler };
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const error = (reason: unknown) => {
  const status =
    typeof reason === 'object' &&
    reason &&
    'status' in reason &&
    typeof (reason as { status: unknown }).status === 'number'
      ? (reason as { status: number }).status
      : 400;
  return json({ error: reason instanceof Error ? reason.message : 'rejected' }, status);
};
const param = (ctx: RouteContext, name: string) =>
  Promise.resolve(ctx.params).then((p) => {
    const value = p[name];
    return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
  });

/** Factories are compatible with Next App Router route exports and do not own route files. */
export function createBootstrapRoute(core: WebPresenceCore, apiBase: string): NextHandler {
  return async () => json(core.bootstrap(apiBase));
}
export function createPresenceRoute(core: WebPresenceCore): NextHandler {
  return async (request, context) => {
    try {
      const identity = await param(context, 'identity');
      if (request.method === 'GET') {
        const record = await core.getPresence(identity, request);
        return record === undefined ? json({ record: null }, 404) : json({ record });
      }
      if (request.method !== 'PUT' && request.method !== 'POST')
        return new Response(null, { status: 405 });
      const body = (await request.json()) as { record?: unknown };
      if (!body || body.record === undefined) return json({ error: 'missing_record' }, 400);
      await core.putPresence(body.record, request, identity);
      return new Response(null, { status: 204 });
    } catch (reason) {
      return error(reason);
    }
  };
}
export function createSignalingRoute(core: WebPresenceCore): NextHandler {
  return async (request, context) => {
    try {
      const identity = await param(context, 'identity');
      const session = await param(context, 'sessionId');
      if (request.method === 'GET') {
        const since = new URL(request.url).searchParams.get('since');
        const records = await core.getSignaling(
          identity,
          session,
          since ? Date.parse(since) : undefined,
          request,
        );
        return json({ records });
      }
      if (request.method !== 'PUT' && request.method !== 'POST')
        return new Response(null, { status: 405 });
      const body = (await request.json()) as { envelope?: unknown };
      if (!body || body.envelope === undefined) return json({ error: 'missing_envelope' }, 400);
      await core.putSignaling(body.envelope, request, identity, session);
      return new Response(null, { status: 204 });
    } catch (reason) {
      return error(reason);
    }
  };
}

/** Return route factories for a configurable mount point; applications own route files. */
export function createNextWebPresenceRoutes(options: { core: WebPresenceCore; basePath: string; apiBase?: string }): NextWebPresenceRoutes {
  const basePath = `/${options.basePath.replace(/^\/+|\/+$/g, '')}`;
  return { basePath, bootstrap: createBootstrapRoute(options.core, options.apiBase ?? basePath), presence: createPresenceRoute(options.core), signaling: createSignalingRoute(options.core) };
}
