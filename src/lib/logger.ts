/**
 * Request logging (T014, FR-010, NFR-7).
 *
 * `withLogging` wraps a route handler rather than living in middleware, because
 * middleware runs *before* the handler and never observes the final status or
 * duration — and NFR-7 wants both on the same line (research.md R2).
 *
 * Wrapping also makes "exactly one line per request" structural: there is a
 * single emit point, so double-logging and skipped-logging are both unreachable.
 * An early `return` on a validation failure cannot bypass it, which is precisely
 * the 4xx case the requirement cares most about.
 */

export type LogLine = {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  reason?: string;
};

/** Header a handler sets to explain a failure it is deliberately returning. */
export const REASON_HEADER = 'x-triage-reason';

function emit(line: LogLine): void {
  // One JSON line to stdout. No logging dependency: the requirement is a single
  // structured line, and transports/redaction/levels are not asked for here
  // (Principle III, research.md R2).
  console.log(JSON.stringify(line));
}

export function withLogging<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<Response>,
): (request: Request, ...args: Args) => Promise<Response> {
  return async (request: Request, ...args: Args): Promise<Response> => {
    const startedAt = performance.now();
    const method = request.method;
    const path = new URL(request.url).pathname;

    try {
      const response = await handler(request, ...args);
      const durationMs = Math.round(performance.now() - startedAt);

      const line: LogLine = { method, path, status: response.status, durationMs };
      if (response.status >= 400) {
        // Handlers pass the reason out-of-band so the body stays the contract's
        // shape and the log line still explains the failure.
        line.reason = response.headers.get(REASON_HEADER) ?? 'unspecified';
      }
      emit(line);

      return response;
    } catch (error: unknown) {
      const durationMs = Math.round(performance.now() - startedAt);
      const name = error instanceof Error ? error.constructor.name : typeof error;
      const detail = error instanceof Error ? error.message : String(error);

      emit({ method, path, status: 500, durationMs, reason: `${name}: ${detail}` });

      return Response.json(
        { error: 'internal_error', reason: 'An unexpected error occurred.' },
        { status: 500 },
      );
    }
  };
}
