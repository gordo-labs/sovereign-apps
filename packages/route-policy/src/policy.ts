import { OperationCancelledError } from '@sovereign-apps/module-kernel';
import type {
  RouteAdapter,
  RouteCandidate,
  RouteDiagnostic,
  RouteFailure,
  RouteOperationOptions,
  RoutePolicyDecision,
  RoutePolicyDependencies,
  RoutePolicyLike,
  RouteSession,
  RoutePolicyOptions,
} from './types.js';

const failureOf = (error: unknown): RouteFailure => {
  if (error instanceof RoutePolicyError) return error.failure;
  if (
    error instanceof OperationCancelledError ||
    (error instanceof Error && error.name === 'AbortError')
  )
    return 'cancelled';
  return 'candidate_failure';
};

export class RoutePolicyError extends Error {
  constructor(
    public readonly failure: RouteFailure,
    message?: string,
  ) {
    super(message ?? failure);
    this.name = 'RoutePolicyError';
  }
}

type Health = { failures: number; openUntil: number };

export class LocalFirstRoutePolicy implements RoutePolicyLike {
  private readonly health = new Map<string, Health>();
  private networkGeneration = 0;
  private unsubscribe?: () => void;
  private lastCandidates: readonly RouteCandidate[] = [];

  constructor(private readonly dependencies: RoutePolicyDependencies = {}) {
    this.unsubscribe = dependencies.network?.subscribe((event) => {
      if (event.kind === 'changed') this.invalidateNetwork();
    });
  }

  dispose() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }
  invalidateNetwork() {
    this.networkGeneration++;
    for (const health of this.health.values()) health.openUntil = 0;
    this.emit({ name: 'route_network_invalidated', at: this.iso() });
  }

  rank(
    candidates: readonly RouteCandidate[],
    options: RoutePolicyOptions = {},
  ): readonly RouteCandidate[] {
    const localities = options.localityPreference ?? ['local', 'nearby', 'remote', 'unknown'];
    const locality = new Map(localities.map((value, index) => [value, index]));
    return [...candidates]
      .filter(
        (candidate) =>
          candidate.available &&
          (candidate.kind === 'direct' ||
            options.allowRelays !== false ||
            candidate.kind !== 'relay') &&
          (candidate.kind !== 'helper' || options.allowHelpers === true),
      )
      .sort((a, b) => {
        const av = this.health.get(a.id);
        const bv = this.health.get(b.id);
        const aOpen = av && av.openUntil > this.now() ? 1 : 0;
        const bOpen = bv && bv.openUntil > this.now() ? 1 : 0;
        const score = (candidate: RouteCandidate, open: number) =>
          Number(candidate.trustBinding.verified) * -1000 +
          Number(candidate.reachable === true) * -100 +
          (locality.get(candidate.locality) ?? 99) * 10 +
          candidate.cost +
          candidate.latencyMs / 1000 +
          open * 10000 +
          (candidate.priority ?? 0) * -0.01;
        return score(a, aOpen) - score(b, bOpen) || a.id.localeCompare(b.id);
      });
  }

  async connect(
    candidates: readonly RouteCandidate[],
    adapter: RouteAdapter,
    options: RouteOperationOptions,
  ): Promise<RoutePolicyDecision> {
    const startedGeneration = this.networkGeneration;
    this.lastCandidates = candidates;
    if (candidates.some((candidate) => candidate.trustBinding.peerId !== options.peerId))
      throw new RoutePolicyError('auth_failure', 'candidate trust binding does not match peer');
    const ranked = this.rank(candidates, options);
    const selected = options.manualRouteId
      ? ranked.filter((candidate) => candidate.id === options.manualRouteId)
      : ranked;
    if (options.manualRouteId && selected.length === 0)
      throw new RoutePolicyError('candidate_failure', 'manual route is unavailable');
    const attempted: string[] = [];
    const rejected: { routeId: string; failure: RouteFailure }[] = [];
    const maxRace = Math.max(1, options.maxRace ?? 2);
    const maxAttempts = Math.max(1, options.maxAttemptsPerCandidate ?? 1);
    for (let offset = 0; offset < selected.length; offset += maxRace) {
      const batch = selected.slice(offset, offset + maxRace);
      const controllers = batch.map(() => new AbortController());
      const attempts = batch.map((candidate, index) =>
        this.attempt(
          candidate,
          adapter,
          options,
          controllers[index].signal,
          maxAttempts,
          attempted,
        ),
      );
      try {
        const result = await Promise.any(attempts);
        controllers.forEach((controller) => controller.abort());
        for (const candidate of batch)
          if (candidate.id !== result.candidateId)
            this.emit({
              name: 'route_cancelled',
              at: this.iso(),
              routeId: candidate.id,
              outcome: 'cancelled',
            });
        const decision: RoutePolicyDecision = {
          routeId: result.candidateId,
          chosenAt: this.iso(),
          reason: this.reason(result.candidateId, candidates),
          attempted,
          rejected,
          session: result,
        };
        this.emit({
          name: 'route_selected',
          at: decision.chosenAt,
          routeId: result.candidateId,
          outcome: 'ok',
          fields: { networkGeneration: this.networkGeneration },
        });
        return decision;
      } catch (error) {
        const errors = error instanceof AggregateError ? error.errors : [error];
        if (errors.some((item) => failureOf(item) === 'auth_failure')) {
          controllers.forEach((controller) => controller.abort());
          throw new RoutePolicyError('auth_failure', 'route authentication failed');
        }
        errors.forEach((item, index) => {
          const candidate = batch[index];
          if (candidate) {
            const failure = failureOf(item);
            rejected.push({ routeId: candidate.id, failure });
            this.recordFailure(candidate.id, failure);
            this.emit({
              name: 'route_rejected',
              at: this.iso(),
              routeId: candidate.id,
              outcome: failure === 'cancelled' ? 'cancelled' : 'error',
              failure,
            });
          }
        });
      }
    }
    if (startedGeneration !== this.networkGeneration)
      throw new RoutePolicyError('transport_failure', 'network changed while reconnecting');
    throw new RoutePolicyError(
      rejected.at(-1)?.failure ?? 'candidate_failure',
      'all route candidates failed',
    );
  }

  reconnect(
    candidates: readonly RouteCandidate[],
    adapter: RouteAdapter,
    options: RouteOperationOptions,
  ) {
    this.emit({
      name: 'route_reconnect',
      at: this.iso(),
      fields: { candidateCount: candidates.length },
    });
    return this.connect(candidates, adapter, options);
  }

  backoff(routeId: string, options: RoutePolicyOptions = {}): number {
    const failures = this.health.get(routeId)?.failures ?? 0;
    const base = options.baseBackoffMs ?? 250;
    const cap = options.maxBackoffMs ?? 30_000;
    const jitter = 0.75 + (this.dependencies.random?.() ?? 0.5) * 0.5;
    return Math.min(cap, base * 2 ** Math.max(0, failures - 1)) * jitter;
  }

  private async attempt(
    candidate: RouteCandidate,
    adapter: RouteAdapter,
    options: RouteOperationOptions,
    signal: AbortSignal,
    maxAttempts: number,
    attempted: string[],
  ): Promise<RouteSession> {
    if (!candidate.trustBinding.verified || !(await options.trust(candidate, signal)))
      throw new RoutePolicyError('auth_failure', 'candidate trust binding was not verified');
    attempted.push(candidate.id);
    this.emit({
      name: 'route_attempt',
      at: this.iso(),
      routeId: candidate.id,
      fields: { locality: candidate.locality, kind: candidate.kind },
    });
    let last: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (signal.aborted) throw new RoutePolicyError('cancelled');
      try {
        const session = await adapter.connect(candidate, {
          signal,
          timeoutMs: options.connectTimeoutMs ?? 10_000,
        });
        if (signal.aborted) {
          await session.close('race_lost');
          throw new RoutePolicyError('cancelled');
        }
        this.health.set(candidate.id, { failures: 0, openUntil: 0 });
        return session;
      } catch (error) {
        last = error;
        if (failureOf(error) === 'auth_failure') throw error;
        if (attempt < maxAttempts) await this.delay(this.backoff(candidate.id, options), signal);
      }
    }
    throw last instanceof Error ? last : new RoutePolicyError('transport_failure');
  }

  private recordFailure(routeId: string, failure: RouteFailure) {
    if (failure === 'auth_failure' || failure === 'cancelled') return;
    const current = this.health.get(routeId) ?? { failures: 0, openUntil: 0 };
    current.failures++;
    if (current.failures >= 3) {
      current.openUntil = this.now() + 30_000;
      this.emit({ name: 'route_circuit_open', at: this.iso(), routeId, outcome: 'error', failure });
    }
    this.health.set(routeId, current);
  }
  private async delay(ms: number, signal: AbortSignal) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new RoutePolicyError('cancelled'));
        },
        { once: true },
      );
    });
  }
  private reason(routeId: string, candidates: readonly RouteCandidate[]) {
    const candidate = candidates.find((item) => item.id === routeId)!;
    return `${candidate.kind}:${candidate.locality}:${candidate.discoverySource}`;
  }
  private now() {
    return this.dependencies.clock?.now() ?? Date.now();
  }
  private iso() {
    return new Date(this.now()).toISOString();
  }
  private emit(event: RouteDiagnostic) {
    this.dependencies.diagnostics?.(event);
  }
}
