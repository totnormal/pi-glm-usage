/**
 * Unit types from the z.ai quota quota API.
 *
 * These values are discovered from the z.ai frontend source and represent
 * different quota periods. The extension displays only the 5-hour and weekly
 * quotas (unit 3 and 6), but parses the monthly quota (unit 5) for future use.
 *
 * @see {@link https://api.z.ai/api/monitor/usage/quota/limit API endpoint}
 */
export const Unit = {
  /** 5-hour quota (TOKENS_LIMIT) — resets 5 hours after consumption */
  FIVE_HOUR: 3,
  /** Weekly quota (TOKENS_LIMIT) — resets every 7 days */
  WEEKLY: 6,
  /** Monthly quota (TIME_LIMIT) for web search/reader/Zread — parsed but not displayed in v1 */
  MONTHLY: 5,
} as const;

/** Union type of all unit values */
export type UnitType = (typeof Unit)[keyof typeof Unit];

/**
 * Individual quota limit from the API response.
 *
 * Each limit represents a different quota period (5-hour, weekly, monthly)
 * with its own percentage used and reset time.
 */
export interface QuotaLimit {
  /** The type of quota (e.g., "TOKENS_LIMIT", "TIME_LIMIT") */
  type: string;
  /** The unit period (3 = 5h, 6 = weekly, 5 = monthly) */
  unit: number;
  /** Percentage of quota used (0-100) */
  percentage: number;
  /** Unix timestamp in milliseconds when the quota resets */
  nextResetTime: number;
}

/**
 * Top-level API response structure from the z.ai quota endpoint.
 *
 * @example
 * ```json
 * {
 *   "code": 200,
 *   "data": {
 *     "limits": [...],
 *     "level": "lite"
 *   }
 * }
 * ```
 */
export interface QuotaResponse {
  /** HTTP status code (200 = success) */
  code: number;
  /** Response data containing quota limits and plan level */
  data: {
    /** Array of quota limits for different periods */
    limits: QuotaLimit[];
    /** Plan level (e.g., "lite", "pro", "max") */
    level: string;
  };
}

/**
 * Internal parsed quota representation used by the extension.
 *
 * This structure filters the raw API response to extract only the
 * relevant quota types (5-hour and weekly) for display.
 *
 * @see {@link fetchQuota} for the parsing logic
 */
export interface ParsedQuota {
  /** 5-hour quota limit (null if not present in API response) */
  fiveHour: QuotaLimit | null;
  /** Weekly quota limit (null if not present in API response) */
  weekly: QuotaLimit | null;
  /** Plan level (e.g., "lite", "pro", "max") */
  planLevel: string;
}
