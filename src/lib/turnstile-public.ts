export const TURNSTILE_REJECTED_ERROR =
  "We could not confirm this request. Please try again.";

export function turnstileSiteKey() {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
}
