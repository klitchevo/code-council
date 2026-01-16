/**
 * Configuration module for Code Council
 *
 * This module provides TypeScript configuration support with full autocompletion.
 *
 * @example
 * ```typescript
 * // .code-council/config.ts
 * import { defineConfig } from "@klitchevo/code-council/config";
 *
 * export default defineConfig({
 *   models: {
 *     codeReview: ["anthropic/claude-sonnet-4"],
 *   },
 * });
 * ```
 *
 * @module
 */

// Re-export defineConfig helper
export { defineConfig } from "./define-config";
// Re-export loader functions
export {
	findConfigFile,
	hasConfigFile,
	type LoadConfigResult,
	loadConfig,
	loadConfigFile,
} from "./loader";

// Re-export schemas for internal use
export {
	CodeCouncilConfigSchema,
	ConsensusConfigSchema,
	InputLimitsConfigSchema,
	LLMConfigSchema,
	ModelsConfigSchema,
	SessionConfigSchema,
} from "./schema";
// Re-export types for user imports
export type {
	CodeCouncilConfig,
	ConsensusConfig,
	InputLimitsConfig,
	KnownModel,
	LLMConfig,
	ModelId,
	ModelsConfig,
	SessionConfig,
} from "./types";
