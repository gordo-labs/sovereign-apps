export class ModuleKernelError extends Error {
  constructor(readonly code: string, message: string, readonly details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = 'ModuleKernelError';
  }
}
export class ModuleCompositionError extends ModuleKernelError { constructor(message: string, details?: Readonly<Record<string, unknown>>) { super('invalid_composition', message, details); this.name = 'ModuleCompositionError'; } }
export class ModuleUnavailableError extends ModuleKernelError { constructor(moduleId: string, reason?: string) { super('unavailable', `Module ${moduleId} is unavailable${reason ? `: ${reason}` : ''}`, { moduleId }); this.name = 'ModuleUnavailableError'; } }
export class OperationCancelledError extends ModuleKernelError { constructor(operation: string) { super('cancelled', `${operation} was cancelled`); this.name = 'OperationCancelledError'; } }
export class OperationTimeoutError extends ModuleKernelError { constructor(operation: string, timeoutMs: number) { super('timeout', `${operation} timed out after ${timeoutMs}ms`, { timeoutMs }); this.name = 'OperationTimeoutError'; } }

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new OperationCancelledError('operation');
}
export async function withTimeout<T>(operation: string, task: (signal: AbortSignal) => Promise<T>, timeoutMs = 10_000, parent?: AbortSignal): Promise<T> {
  throwIfAborted(parent);
  const controller = new AbortController();
  const abort = () => controller.abort();
  parent?.addEventListener('abort', abort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new OperationTimeoutError(operation, timeoutMs)); }, timeoutMs); });
    return await Promise.race([task(controller.signal), timeout]);
  } catch (error) {
    if (parent?.aborted || controller.signal.aborted && !(error instanceof OperationTimeoutError)) throw new OperationCancelledError(operation);
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    parent?.removeEventListener('abort', abort);
  }
}
