export const MIN_SUBMIT_MS = 3_000;

export const TOO_FAST_ERROR =
  "Please take a moment to review your request, then submit again.";

export function startedAtFromBody(body: unknown): number | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const value = (body as Record<string, unknown>).form_started_at;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function isSubmitTooFast(startedAt: number | null, now = Date.now()) {
  if (startedAt === null || !Number.isFinite(startedAt) || startedAt <= 0) {
    return false;
  }
  const elapsed = now - startedAt;
  if (elapsed < 0) return false;
  return elapsed < MIN_SUBMIT_MS;
}
