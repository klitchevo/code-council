/**
 * Configuration loader for Code Council
 *
 * Discovers and loads TypeScript/JavaScript configuration files,
 * validates them with Zod, and merges with environment variables.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { createJiti } from "jiti";
import { CodeCouncilConfigSchema } from "./schema";
import type { CodeCouncilConfig } from "./types";

/**
 * Supported configuration file locations (in order of priority)
 */
const CONFIG_LOCATIONS = [
	".code-council/config.ts",
	".code-council/config.js",
	"code-council.config.ts",
	"code-council.config.js",
] as const;

/**
 * Result of loading configuration
 */
export interface LoadConfigResult {
	/** The validated configuration object */
	config: CodeCouncilConfig;
	/** Path to the config file that was loaded, or null if none found */
	configPath: string | null;
}

/**
 * Discover config file in project
 *
 * Searches for configuration files in the following order:
 * 1. .code-council/config.ts
 * 2. .code-council/config.js
 * 3. code-council.config.ts
 * 4. code-council.config.js
 *
 * @param cwd - Directory to search in (defaults to process.cwd())
 * @returns Full path to config file, or null if not found
 */
export function findConfigFile(cwd: string = process.cwd()): string | null {
	for (const location of CONFIG_LOCATIONS) {
		const fullPath = join(cwd, location);
		if (existsSync(fullPath)) {
			return fullPath;
		}
	}
	return null;
}

/**
 * Load configuration from a file
 *
 * Uses jiti to load TypeScript files without requiring compilation.
 *
 * @param configPath - Path to the configuration file
 * @returns The loaded and validated configuration
 * @throws Error if the config file is invalid
 */
export async function loadConfigFile(
	configPath: string,
): Promise<CodeCouncilConfig> {
	const jiti = createJiti(import.meta.url, {
		interopDefault: true,
	});

	const loaded = await jiti.import(configPath);

	// Handle both default export and module.exports
	const rawConfig = (loaded as { default?: unknown }).default ?? loaded;

	// Validate with Zod
	const result = CodeCouncilConfigSchema.safeParse(rawConfig);

	if (!result.success) {
		const errors = result.error.issues
			.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
			.join("\n");
		throw new Error(`Invalid configuration in ${configPath}:\n${errors}`);
	}

	return result.data;
}

/**
 * Load configuration from file (if exists)
 *
 * This function discovers and loads the configuration file without
 * merging with environment variables. Use `loadAndMergeConfig` for
 * the full configuration with env var fallbacks.
 *
 * @param cwd - Directory to search in (defaults to process.cwd())
 * @returns Configuration and the path it was loaded from
 */
export async function loadConfig(
	cwd: string = process.cwd(),
): Promise<LoadConfigResult> {
	const configPath = findConfigFile(cwd);

	if (!configPath) {
		// No config file - return empty config
		return { config: {}, configPath: null };
	}

	const config = await loadConfigFile(configPath);
	return { config, configPath };
}

/**
 * Check if a config file exists in the given directory
 *
 * @param cwd - Directory to check
 * @returns true if a config file exists
 */
export function hasConfigFile(cwd: string = process.cwd()): boolean {
	return findConfigFile(cwd) !== null;
}
