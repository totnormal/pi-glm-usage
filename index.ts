/**
 * pi-glm-usage Extension
 *
 * A pi extension that displays z.ai (GLM Coding Plan) subscription quota
 * usage in the status bar. The extension fetches quota data from the z.ai
 * API after each agent turn and updates the status bar with current usage
 * percentages and reset times.
 *
 * ## Features
 *
 * - Shows 5-hour and weekly quota usage as percentages
 * - Displays reset time (relative for 5h, day-of-week for weekly)
 * - Shows plan level (Lite/Pro/Max)
 * - Updates on startup and after each agent turn
 * - Live updates every 60 seconds during long agent runs
 * - Graceful error handling with cached fallback
 * - Non-blocking fetches with 5-second timeout
 *
 * ## Event Handlers
 *
 * - **session_start**: Fetches quota on pi startup
 * - **agent_start**: Starts periodic 60-second refresh during agent runs
 * - **agent_end**: Stops periodic refresh and fetches quota after each agent turn
 * - **session_shutdown**: Cleanup (stops any running periodic refresh)
 *
 * ## Future Enhancements
 *
 * - Export fetch/format functions for `/glm-usage` command
 * - Add color coding for quota levels
 * - Support configurable refresh interval
 * - Add detailed error messages to status bar
 *
 * @module index
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { ParsedQuota } from "./types";
import type { PeriodicRefreshController, RefreshContext } from "./timer";
import { createPeriodicRefresh } from "./timer";
import { getApiKey } from "./auth";
import { fetchQuota } from "./api";
import { formatQuotaStatus, formatErrorState } from "./format";

/**
 * Main extension entry point.
 *
 * Called by pi when the extension is loaded. Registers event handlers
 * for session_start and agent_end to fetch and display quota data.
 *
 * @param pi - The pi ExtensionAPI instance
 */
export default function (pi: ExtensionAPI): void {
  // Store last known quota for error fallback
  let lastKnownQuota: ParsedQuota | null = null;

  // Store current pi context for setStatus calls during periodic refresh
  let currentCtx: any = null;

  // Safe setStatus wrapper — ctx becomes stale after session replacement/reload,
  // causing `ui` getter to throw. Status bar updates are non-critical, so swallow.
  function safeSetStatus(ctx: any, id: string, value: string | undefined): void {
    try {
      ctx?.ui?.setStatus(id, value);
    } catch {
      // ctx is stale after session replacement/reload — silently ignore
    }
  }

  // Create shared refresh context for periodic updates
  const refreshDeps: RefreshContext = {
    getApiKey,
    fetchQuota,
    formatQuotaStatus,
    formatErrorState,
    setStatus: (id, value) => {
      safeSetStatus(currentCtx, id, value);
    },
    lastKnownQuota: {
      get value() {
        return lastKnownQuota;
      },
      set value(v) {
        lastKnownQuota = v;
      },
    },
  };

  const controller: PeriodicRefreshController = createPeriodicRefresh(refreshDeps);

  /**
   * Fetches quota data and updates the status bar.
   *
   * @param reason - The reason for the update (e.g., "startup", "agent_end")
   * @param ctx - The pi context object
   */
  async function updateStatusBar(reason: string, ctx: any): Promise<void> {
    currentCtx = ctx;
    try {
      const apiKey = getApiKey();
      const quota = await fetchQuota(apiKey);
      lastKnownQuota = quota;
      const formatted = formatQuotaStatus(quota);
      safeSetStatus(ctx, "glm-usage", formatted);
    } catch (error) {
      console.error(`[glm-usage] (${reason}) error:`, error);
      // If we have cached data, keep showing it; otherwise hide the status bar
      if (lastKnownQuota) {
        const formatted = formatQuotaStatus(lastKnownQuota);
        safeSetStatus(ctx, "glm-usage", formatted);
      } else {
        const errorDisplay = formatErrorState(error);
        safeSetStatus(ctx, "glm-usage", errorDisplay);
      }
    }
  }

  // Fetch quota when pi starts up, so the status bar shows data immediately
  pi.on("session_start", async (_event, ctx) => {
    currentCtx = ctx;
    // Fire-and-forget - don't block startup
    updateStatusBar("startup", ctx).catch((err) => {
      console.error("[glm-usage] startup error:", err);
    });
  });

  // Start periodic refresh when agent begins (live updates during long runs)
  pi.on("agent_start", async (_event, ctx) => {
    currentCtx = ctx;
    controller.start(); // begin 60s periodic refresh
  });

  // Stop periodic refresh and fetch quota after each agent turn
  pi.on("agent_end", async (_event, ctx) => {
    currentCtx = ctx;
    controller.stop(); // stop periodic refresh
    // Fire-and-forget - don't block agent completion
    updateStatusBar("agent_end", ctx).catch((err) => {
      console.error("[glm-usage] agent_end error:", err);
    });
  });

  // Cleanup: stop periodic refresh on session shutdown (safety net)
  pi.on("session_shutdown", () => {
    controller.stop(); // safety net cleanup
  });
}
