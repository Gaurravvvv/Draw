/**
 * Input Validation & Sanitization — Central module for all user input validation.
 * Prevents XSS, prototype pollution, memory bombs, and injection attacks.
 */

// ── Nickname Validation ──────────────────────────────────────────────────────

const NICKNAME_MAX_LENGTH = 20;
const NICKNAME_REGEX = /^[a-zA-Z0-9 _\-'.!?]+$/;

/**
 * Sanitize a user nickname:
 * - Strip HTML tags
 * - Trim whitespace
 * - Enforce max length
 * - Allow only safe characters (alphanumeric, space, basic punctuation)
 * - Fallback to 'Anonymous' if invalid
 */
export function sanitizeNickname(raw: unknown): string {
  if (typeof raw !== 'string') return 'Anonymous';

  // Strip any HTML tags
  let clean = raw.replace(/<[^>]*>/g, '');

  // Trim and enforce max length
  clean = clean.trim().slice(0, NICKNAME_MAX_LENGTH);

  // Validate allowed characters
  if (!clean || !NICKNAME_REGEX.test(clean)) {
    return 'Anonymous';
  }

  return clean;
}

// ── Game Settings Validation ─────────────────────────────────────────────────

interface GameSettingsLimits {
  rounds: { min: number; max: number };
  maxPlayers: { min: number; max: number };
  drawTime: { min: number; max: number };
  wordSource: string[];
  wordCategory: string[];
}

const GAME_SETTINGS_LIMITS: GameSettingsLimits = {
  rounds: { min: 1, max: 10 },
  maxPlayers: { min: 2, max: 10 },
  drawTime: { min: 15, max: 300 },
  wordSource: ['predefined', 'ai'],
  wordCategory: ['Animals', 'Objects', 'Food', 'Actions', 'Places', 'Nature', 'Sports', 'Vehicles'],
};

/**
 * Validate and sanitize game settings update.
 * - Only whitelisted keys are accepted
 * - Numeric values are clamped to valid ranges
 * - Enum values are validated against allowed options
 * - Prevents prototype pollution by explicitly picking known fields
 */
export function validateGameSettings(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const input = raw as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  // rounds
  if ('rounds' in input && typeof input.rounds === 'number') {
    result.rounds = Math.min(
      GAME_SETTINGS_LIMITS.rounds.max,
      Math.max(GAME_SETTINGS_LIMITS.rounds.min, Math.floor(input.rounds)),
    );
  }

  // maxPlayers
  if ('maxPlayers' in input && typeof input.maxPlayers === 'number') {
    result.maxPlayers = Math.min(
      GAME_SETTINGS_LIMITS.maxPlayers.max,
      Math.max(GAME_SETTINGS_LIMITS.maxPlayers.min, Math.floor(input.maxPlayers)),
    );
  }

  // drawTime
  if ('drawTime' in input && typeof input.drawTime === 'number') {
    result.drawTime = Math.min(
      GAME_SETTINGS_LIMITS.drawTime.max,
      Math.max(GAME_SETTINGS_LIMITS.drawTime.min, Math.floor(input.drawTime)),
    );
  }

  // wordSource
  if ('wordSource' in input && typeof input.wordSource === 'string') {
    if (GAME_SETTINGS_LIMITS.wordSource.includes(input.wordSource)) {
      result.wordSource = input.wordSource;
    }
  }

  // wordCategory
  if ('wordCategory' in input && typeof input.wordCategory === 'string') {
    if (GAME_SETTINGS_LIMITS.wordCategory.includes(input.wordCategory)) {
      result.wordCategory = input.wordCategory;
    }
  }

  return result;
}

// ── Guess Validation ─────────────────────────────────────────────────────────

const GUESS_MAX_LENGTH = 50;

/**
 * Sanitize a guess submission:
 * - Enforce max length
 * - Trim whitespace
 * - Strip HTML tags
 */
export function sanitizeGuess(raw: unknown): string {
  if (typeof raw !== 'string') return '';

  let clean = raw.replace(/<[^>]*>/g, '');
  clean = clean.trim().slice(0, GUESS_MAX_LENGTH);

  return clean;
}

// ── Base64 Payload Validation ────────────────────────────────────────────────

const MAX_BASE64_LENGTH = 5 * 1024 * 1024; // 5MB

/**
 * Validate a base64 image payload.
 * Returns the payload if valid, or null if invalid/too large.
 */
export function validateBase64Payload(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  if (raw === 'empty') return 'empty'; // Allow empty canvas marker

  if (raw.length > MAX_BASE64_LENGTH) return null;

  // Must start with a data URL prefix for images
  if (!raw.startsWith('data:image/')) return null;

  return raw;
}
