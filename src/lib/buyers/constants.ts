/** Planned prices. Not charged until Stripe is connected. */
export const ONE_TIME_PRICE_USD = 150;
export const AGENT_MONTHLY_PRICE_USD = 350;

/** Soft courtesy volume for an agent subscription. Not a hard stop. */
export const DEFAULT_AGENT_MONTHLY_CAP = 25;

export const ONE_TIME_LINK_DAYS = 90;
export const AGENT_TOKEN_YEARS = 10;
export const FILE_TTL_DAYS = 30;

/**
 * 4 MB stays under the platform request-body ceiling for a route upload.
 * Larger packets are split across the slots that allow more than one file.
 */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
export const MAX_FILES = 40;

export const MAX_NOTE_CHARS = 500;
export const MAX_INTAKE_NOTES = 2000;
export const MAX_NAME_CHARS = 120;
