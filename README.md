# pi-glm-usage

A [pi](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) extension that displays your z.ai (GLM Coding Plan) subscription quota usage in the status bar.

## What it does

Shows two key metrics in pi's footer status bar:

- **5 Hours Quota** — Dynamically refreshed; quota resets 5 hours after consumption
- **Weekly Quota** — Resets every 7 days

Both display as a percentage used (e.g., `5h: 16% | week: 4%`).

The status bar updates live every **60 seconds** during long agent runs, so you can monitor quota consumption in real time.

The status bar also shows:

- Plan level (Lite/Pro/Max)
- Time until quota reset (relative time for 5h quota, day-of-week for weekly)

Example output:

```
GLM Lite | 5h: 16% ↻ 2h 14m | week: 4% ↻ Mon
```

## How it works

### Data source

Calls the z.ai API endpoint `https://api.z.ai/api/monitor/usage/quota/limit` with the user's API key (read from `~/.pi/agent/auth.json` → `zai.key`).

**Example response:**

```json
{
  "code": 200,
  "data": {
    "limits": [
      {
        "type": "TOKENS_LIMIT",
        "unit": 3,
        "percentage": 16,
        "nextResetTime": 1777819631597
      },
      {
        "type": "TOKENS_LIMIT",
        "unit": 6,
        "percentage": 4,
        "nextResetTime": 1778262784969
      },
      {
        "type": "TIME_LIMIT",
        "unit": 5,
        "percentage": 0,
        "nextResetTime": 1780336384978
      }
    ],
    "level": "lite"
  }
}
```

**Unit mapping (discovered from z.ai frontend source):**

| `unit` | Meaning |
|--------|---------|
| 3 | 5 Hours Quota (TOKENS_LIMIT) |
| 6 | Weekly Quota (TOKENS_LIMIT) |
| 5 | Monthly Web Search/Reader/Zread (TIME_LIMIT) — parsed but not displayed in v1 |

### Refresh behavior

- Fetches quota data immediately on pi startup (`session_start` event)
- Starts 60-second periodic refresh when agent begins (`agent_start` event)
- Stops periodic refresh and fetches quota after each agent turn (`agent_end` event)
- Live updates every 60 seconds during long agent runs
- Updates the status bar immediately
- Falls back gracefully on errors (shows last known state or hides)
- All fetches are fire-and-forget (non-blocking) with a 5-second timeout

### Display

Uses `ctx.ui.setStatus("glm-usage", ...)` to render a compact status bar entry:

```
GLM Lite | 5h: 16% ↻ 2h 14m | week: 4% ↻ Mon
```

- `↻` shows when the quota resets (relative time for 5h, day-of-week for weekly)
- Plan level shown on the left (Lite/Pro/Max)
- Missing quota types are omitted from the display

## Configuration

No configuration needed. The extension reads the API key from `~/.pi/agent/auth.json`:

```json
{
  "zai": {
    "type": "api_key",
    "key": "your-api-key-here"
  }
}
```

The `zai.key` field is required. The extension will fail gracefully if the file or key is missing (the status bar entry will be hidden).

**Environment variable (for testing):**

Set `PI_AUTH_DIR` to override the auth file path:

```bash
export PI_AUTH_DIR=/path/to/test/auth/dir
```

This is useful for testing without affecting your actual pi configuration.

## Installation

### Quick install (recommended)

```bash
pi install npm:pi-glm-usage
```

This automatically downloads and installs the extension. Restart pi to load it.

### Manual install

1. Create the extensions directory if it doesn't exist:
   ```bash
   mkdir -p ~/.pi/agent/extensions/glm-usage
   ```

2. Copy the extension files to the directory:
   ```bash
   cp -r pi-glm-usage/* ~/.pi/agent/extensions/glm-usage/
   ```

3. Restart pi to load the extension

The extension will automatically load and display your quota usage in the status bar.

## Troubleshooting

### Status bar not showing

**Cause:** The auth file is missing or the API key is not configured.

**Fix:** Ensure `~/.pi/agent/auth.json` exists and contains a valid `zai.key`:

```bash
cat ~/.pi/agent/auth.json
```

You should see:

```json
{
  "zai": {
    "type": "api_key",
    "key": "sk-..."
  }
}
```

If the file is missing, configure your z.ai API key in pi settings.

### Status bar shows old data

**Cause:** API fetch failed or timed out, falling back to cached data.

**Fix:** Check the pi console for error messages. Common issues:

- Network connectivity problems
- API endpoint is temporarily unavailable
- Invalid API key

To force a refresh, trigger a new agent turn (ask a question in pi).

### "Request timeout: fetch took longer than 5 seconds" in logs

**Cause:** The API request timed out after 5 seconds.

**Fix:** This is usually temporary. The extension will retry on the next agent turn. If the issue persists:

- Check your network connection
- Verify the API endpoint is accessible: `curl -I https://api.z.ai/api/monitor/usage/quota/limit`
- Check if z.ai services are operational

### Extension not loading

**Cause:** The extension files are not in the correct location or have syntax errors.

**Fix:** Verify the extension is installed correctly:

```bash
ls -la ~/.pi/agent/extensions/glm-usage/
```

You should see:

```
index.ts
api.ts
auth.ts
format.ts
types.ts
package.json
tsconfig.json
```

Check the pi console for any error messages during startup.

### TypeScript compilation errors

**Cause:** The extension was not built or has type errors.

**Fix:** Run the typecheck to identify issues:

```bash
bun run typecheck
```

Fix any reported errors and rebuild the extension if necessary.

## Future ideas (out of scope for v1)

- **Color coding** — green/yellow/red as quota fills up (needs `ctx.ui.setStatus` color support or ANSI codes)
- **`/glm-usage` command** — detailed breakdown with `pi.registerCommand()`
- **Token consumption per model** — requires additional API data
- **Web search quota** (unit 5) — already parsed but not displayed
- **Configurable refresh interval** — make the 60-second interval adjustable
- **Detailed error display** — show minimal error message instead of hiding status bar

## Architecture

The extension is structured with clear separation of concerns:

- `timer.ts` — Periodic refresh controller with dependency injection (fully unit testable)
- `api.ts` — API client with timeout and error handling
- `auth.ts` — API key reader from `~/.pi/agent/auth.json`
- `format.ts` — Status bar formatting utilities
- `types.ts` — Shared TypeScript types
- `index.ts` — Extension entry point, wires everything together

All modules follow TDD with co-located tests (`<module>.test.ts`).
