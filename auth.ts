/**
 * API key authentication module.
 *
 * This module handles reading the z.ai API key from the pi auth configuration
 * file. It supports environment variable overrides for testing purposes.
 *
 * @module auth
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

/** Default auth file path relative to user home directory */
const DEFAULT_AUTH_PATH = ".pi/agent/auth.json";

/**
 * Gets the path to the pi auth configuration file.
 *
 * The path can be overridden via the `PI_AUTH_DIR` environment variable,
 * which is useful for testing without affecting the actual pi configuration.
 *
 * @returns Path to auth.json
 *
 * @example
 * ```ts
 * // Default path: ~/.pi/agent/auth.json
 * getAuthFilePath(); // "/home/user/.pi/agent/auth.json"
 *
 * // With override:
 * process.env.PI_AUTH_DIR = "/tmp/test-auth";
 * getAuthFilePath(); // "/tmp/test-auth/auth.json"
 * ```
 */
function getAuthFilePath(): string {
  const authDir = process.env.PI_AUTH_DIR;
  return authDir
    ? path.join(authDir, "auth.json")
    : path.join(os.homedir(), DEFAULT_AUTH_PATH);
}

/**
 * Structure of the auth.json file.
 *
 * This interface defines the expected shape of the pi auth configuration
 * file, specifically the zai section containing the API key.
 *
 * @internal
 */
interface AuthConfig {
  zai: {
    key: string;
  };
}

/**
 * Reads the z.ai API key from the pi auth file.
 *
 * This function reads the auth.json file, parses it as JSON, and extracts
 * the zai.key field. It provides clear error messages for common failure
 * cases (file not found, missing key, invalid JSON).
 *
 * @returns The z.ai API key
 * @throws {Error} If the auth file doesn't exist, can't be read, or the key is missing
 *
 * @example
 * ```ts
 * import { getApiKey } from "./auth";
 *
 * try {
 *   const apiKey = getApiKey();
 *   console.log(`API key loaded: ${apiKey.slice(0, 8)}...`);
 * } catch (error) {
 *   console.error("Failed to load API key:", error);
 * }
 * ```
 */
export function getApiKey(): string {
  const authFilePath = getAuthFilePath();

  try {
    const content = fs.readFileSync(authFilePath, "utf-8");
    const auth = JSON.parse(content) as Partial<AuthConfig>;

    const apiKey = auth.zai?.key;

    if (!apiKey) {
      throw new Error("zai.key not found in auth.json");
    }

    return apiKey;
  } catch (error) {
    if (error instanceof Error) {
      // Re-throw with clearer context
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(
          `Auth file not found at ${authFilePath}. Please ensure you've configured your z.ai API key in pi.`
        );
      }
      throw new Error(`Failed to read API key: ${error.message}`);
    }
    throw new Error("Failed to read API key: unknown error");
  }
}
