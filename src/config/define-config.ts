import type { CodeCouncilConfig } from "./types";

/**
 * Helper function for creating code-council configuration with full type support.
 *
 * This function provides autocompletion and type checking for your configuration.
 * It's a no-op at runtime - it simply returns the config object unchanged.
 *
 * @example
 * ```typescript
 * // .code-council/config.ts
 * import { defineConfig } from "@klitchevo/code-council/config";
 *
 * export default defineConfig({
 *   models: {
 *     codeReview: ["anthropic/claude-sonnet-4", "openai/gpt-4o"],
 *     frontendReview: ["anthropic/claude-sonnet-4"],
 *   },
 *   consensus: {
 *     enabled: true,
 *     modelWeights: { "anthropic/claude-sonnet-4": 1.2 },
 *     highConfidenceThreshold: 0.8,
 *   },
 *   llm: {
 *     temperature: 0.3,
 *     maxTokens: 16384,
 *   },
 * });
 * ```
 *
 * @param config - The configuration object
 * @returns The same configuration object (identity function for type inference)
 */
export function defineConfig(config: CodeCouncilConfig): CodeCouncilConfig {
	return config;
}
