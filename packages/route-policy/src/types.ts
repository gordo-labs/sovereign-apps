import type { ModuleContext, SovereignModule } from '@sovereign-apps/module-kernel';

export type RouteFailure = 'discovery_outage' | 'helper_outage' | 'auth_failure' | 'candidate_failure' | 'transport_failure' | 'app_protocol_failure' | 'timeout' | 'cancelled';
export type RouteLocality = 'local' | 'nearby' | 'remote' | 'unknown';
export type RouteKind = 'direct' | 'relay' | 'helper';

export type RouteCandidate = {
  readonly id: string;
  readonly discoverySource: string;
  readonly bootstrapEvidence: 'qr' | 'presence' | 'mdns' | 'ble' | 'nfc' | 'manual' | 'none';
  readonly transportAdapter: string;
  readonly addressHints: readonly string[];
  readonly trustBinding: { readonly peerId: string; readonly verified: boolean; readonly fingerprint?: string };
  readonly kind: RouteKind;
  readonly locality: RouteLocality;
  readonly cost: number;
  readonly latencyMs: number;
  readonly available: boolean;
  readonly reachable?: boolean;
  readonly priority?: number;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
};

export type RouteSession = { readonly id: string; readonly candidateId: string; close(reason?: string): Promise<void> };
export type RouteAdapter = {
  connect(candidate: RouteCandidate, options: { signal: AbortSignal; timeoutMs: number }): Promise<RouteSession>;
};
export type TrustVerifier = (candidate: RouteCandidate, signal: AbortSignal) => Promise<boolean>;
export type RoutePolicyDecision = {
  readonly routeId: string;
  readonly chosenAt: string;
  readonly reason: string;
  readonly attempted: readonly string[];
  readonly rejected: readonly { routeId: string; failure: RouteFailure }[];
  readonly session: RouteSession;
};
export type RoutePolicyOptions = {
  readonly maxRace?: number;
  readonly connectTimeoutMs?: number;
  readonly maxAttemptsPerCandidate?: number;
  readonly baseBackoffMs?: number;
  readonly maxBackoffMs?: number;
  readonly localityPreference?: readonly RouteLocality[];
  readonly allowRelays?: boolean;
  readonly allowHelpers?: boolean;
};
export type RoutePolicyDependencies = {
  readonly clock?: { now(): number };
  readonly random?: () => number;
  readonly network?: { subscribe(listener: (event: { kind: 'changed' | 'foreground' | 'background' }) => void): () => void };
  readonly diagnostics?: (event: RouteDiagnostic) => void;
};
export type RouteDiagnostic = {
  readonly name: 'route_available' | 'route_attempt' | 'route_rejected' | 'route_selected' | 'route_cancelled' | 'route_reconnect' | 'route_network_invalidated' | 'route_circuit_open';
  readonly at: string;
  readonly routeId?: string;
  readonly outcome?: 'ok' | 'error' | 'cancelled';
  readonly failure?: RouteFailure;
  readonly fields?: Readonly<Record<string, string | number | boolean>>;
};
export type RouteOperationOptions = RoutePolicyOptions & {
  readonly peerId: string;
  readonly manualRouteId?: string;
  readonly signal?: AbortSignal;
  readonly trust: TrustVerifier;
};

export type RouteModule = SovereignModule & { readonly policy: RoutePolicyLike };
export type RoutePolicyLike = {
  connect(candidates: readonly RouteCandidate[], adapter: RouteAdapter, options: RouteOperationOptions): Promise<RoutePolicyDecision>;
  invalidateNetwork(): void;
  reconnect(candidates: readonly RouteCandidate[], adapter: RouteAdapter, options: RouteOperationOptions): Promise<RoutePolicyDecision>;
};

export type RouteModuleContext = ModuleContext & { readonly policy?: RoutePolicyOptions };
