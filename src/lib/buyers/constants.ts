/** Planned prices. Not charged until Stripe is connected. */
export const ONE_TIME_PRICE_USD = 150;
export const AGENT_MONTHLY_PRICE_USD = 350;

/** Soft courtesy volume for an agent subscription. Not a hard stop. */
export const DEFAULT_AGENT_MONTHLY_CAP = 25;

export const ONE_TIME_LINK_DAYS = 90;
export const AGENT_TOKEN_YEARS = 10;
export const FILE_TTL_DAYS = 30;
/** Abandoned uploads are removed after one day. A finished report deletes them immediately. */
export const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Direct uploads go to private Blob storage, not through the function body.
 * 50 MB covers a long scanned PDF. The function itself still refuses a raw
 * multipart body over the platform request limit.
 */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
export const FUNCTION_BODY_BYTES = 4 * 1024 * 1024;
export const MAX_FILES = 40;

export const MAX_NOTE_CHARS = 500;
export const MAX_INTAKE_NOTES = 2000;
export const MAX_NAME_CHARS = 120;
