/**
 * Display formatting module.
 *
 * This module handles formatting quota data into human-readable strings
 * suitable for display in the pi status bar. It converts raw API data
 * into compact, user-friendly representations.
 *
 * Future enhancements (v2) could add color coding, structured data output,
 * or more detailed formatting options.
 *
 * @module format
 */

import type { ParsedQuota } from "./types";
import { Unit } from "./types";

/** Day-of-week abbreviations for weekly quota reset display */
const DAY_ABBREVIATIONS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Reset indicator symbol */
const RESET_SYMBOL = "↻";

/**
 * Formats a reset timestamp into a human-readable string.
 *
 * The format depends on the quota unit type:
 *
 * - **Unit 3 (5h quota)**: Returns relative time like "2h 14m" or "now" if in the past
 * - **Unit 6 (weekly)**: Returns day-of-week like "Mon", "Tue", etc. or "now" if in the past
 * - **Other units**: Returns "now"
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @param unit - The unit type (3 = 5h quota, 6 = weekly quota)
 * @returns Formatted time string
 *
 * @example
 * ```ts
 * import { formatResetTime, Unit } from "./format";
 *
 * // 5h quota: relative time
 * formatResetTime(Date.now() + 8_040_000, Unit.FIVE_HOUR); // "2h 14m"
 *
 * // Weekly quota: day of week
 * formatResetTime(Date.now() + 86_400_000, Unit.WEEKLY); // "Mon"
 *
 * // Past time
 * formatResetTime(Date.now() - 1000, Unit.FIVE_HOUR); // "now"
 * ```
 */
export function formatResetTime(timestamp: number, unit: number): string {
  // Validate timestamp is a valid number
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "now";
  }

  const now = Date.now();
  const diff = timestamp - now;

  // Past or current time
  if (diff <= 0) {
    return "now";
  }

  // 5h quota (unit 3): show relative time
  if (unit === Unit.FIVE_HOUR) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}h ${minutes}m`;
  }

  // Weekly quota (unit 6): show day of week
  if (unit === Unit.WEEKLY) {
    const dayIndex = new Date(timestamp).getUTCDay();
    // getUTCDay returns 0-6 (Sunday-Saturday), always a valid index
    return DAY_ABBREVIATIONS[dayIndex]!;
  }

  // Unknown unit
  return "now";
}

/**
 * Formats the full quota status for display in the status bar.
 *
 * Builds a compact status string with the following format:
 *
 * ```
 * GLM {PlanLevel} | {5h: X% ↻ time} | {week: Y% ↻ day}
 * ```
 *
 * - Plan level is capitalized (lite → Lite, pro → Pro)
 * - Missing 5h or weekly limits are omitted
 * - Shows "↻ now" for past reset times
 *
 * @param quota - Parsed quota data from the API
 * @returns Formatted status string
 *
 * @example
 * ```ts
 * import { formatQuotaStatus } from "./format";
 *
 * const quota = {
 *   fiveHour: { percentage: 16, nextResetTime: Date.now() + 8_040_000, type: "...", unit: 3 },
 *   weekly: { percentage: 4, nextResetTime: Date.now() + 86_400_000, type: "...", unit: 6 },
 *   planLevel: "lite"
 * };
 *
 * formatQuotaStatus(quota);
 * // "GLM Lite | 5h: 16% ↻ 2h 14m | week: 4% ↻ Mon"
 * ```
 */
export function formatQuotaStatus(quota: ParsedQuota): string {
  const parts: string[] = [];

  // Plan level
  const planLevel =
    quota.planLevel.charAt(0).toUpperCase() + quota.planLevel.slice(1);
  parts.push(`GLM ${planLevel}`);

  // 5h quota
  if (quota.fiveHour) {
    const resetTime = formatResetTime(quota.fiveHour.nextResetTime, Unit.FIVE_HOUR);
    parts.push(`5h: ${quota.fiveHour.percentage}% ${RESET_SYMBOL} ${resetTime}`);
  }

  // Weekly quota
  if (quota.weekly) {
    const resetTime = formatResetTime(quota.weekly.nextResetTime, Unit.WEEKLY);
    parts.push(`week: ${quota.weekly.percentage}% ${RESET_SYMBOL} ${resetTime}`);
  }

  return parts.join(" | ");
}

/**
 * Formats an error state for display.
 *
 * For v1, this function always returns `undefined` to hide the status bar
 * entry entirely on error. This ensures stale data is never shown to users.
 *
 * Future enhancements (v2) could return a minimal error string like
 * "GLM: error" or implement more sophisticated error display strategies.
 *
 * @param error - The error that occurred (unused in v1, kept for future use)
 * @returns Always returns `undefined` to hide the status bar
 *
 * @example
 * ```ts
 * import { formatErrorState } from "./format";
 *
 * const error = new Error("Failed to fetch quota");
 * const display = formatErrorState(error);
 * console.log(display); // undefined (status bar hidden)
 * ```
 */
export function formatErrorState(_error: unknown): string | undefined {
  // For v1, we always hide the status bar on error
  // In the future, we might:
  // - Return a minimal error string like "GLM: error"
  // - Show different error states for different failure modes
  // - Add color coding to indicate error severity
  return undefined;
}
