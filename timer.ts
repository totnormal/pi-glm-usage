import type { ParsedQuota } from "./types";

export interface RefreshContext {
  getApiKey: () => string;
  fetchQuota: (apiKey: string) => Promise<ParsedQuota>;
  formatQuotaStatus: (quota: ParsedQuota) => string;
  formatErrorState: (error: unknown) => string | undefined;
  setStatus: (id: string, value: string | undefined) => void;
  lastKnownQuota: { value: ParsedQuota | null };
}

export interface PeriodicRefreshController {
  start: (intervalMs?: number) => void;
  stop: () => void;
  isRunning: () => boolean;
}

const DEFAULT_INTERVAL_MS = 60_000;
const STATUS_BAR_ID = "glm-usage";

export function createPeriodicRefresh(deps: RefreshContext): PeriodicRefreshController {
  let intervalId: ReturnType<typeof setInterval> | null = null;

  async function tick(): Promise<void> {
    try {
      const apiKey = deps.getApiKey();
      const quota = await deps.fetchQuota(apiKey);
      deps.lastKnownQuota.value = quota;
      const formatted = deps.formatQuotaStatus(quota);
      deps.setStatus(STATUS_BAR_ID, formatted);
    } catch (error) {
      if (deps.lastKnownQuota.value) {
        const formatted = deps.formatQuotaStatus(deps.lastKnownQuota.value);
        deps.setStatus(STATUS_BAR_ID, formatted);
      } else {
        const errorDisplay = deps.formatErrorState(error);
        deps.setStatus(STATUS_BAR_ID, errorDisplay);
      }
    }
  }

  return {
    start(intervalMs: number = DEFAULT_INTERVAL_MS): void {
      if (intervalId !== null) return; // already running
      tick(); // immediate first fetch
      intervalId = setInterval(tick, intervalMs);
    },

    stop(): void {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },

    isRunning(): boolean {
      return intervalId !== null;
    },
  };
}
