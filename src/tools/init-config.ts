/**
 * init_config tool - Generate Code Council configuration files
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { DEFAULT_MODELS } from "../constants";
import { logger } from "../logger";

/**
 * Schema for init_config tool input
 */
export const initConfigSchema = {
	location: z
		.enum(["directory", "root"])
		.optional()
		.describe(
			"Where to create config: 'directory' for .code-council/config.ts, 'root' for code-council.config.ts (default: directory)",
		),
	format: z
		.enum(["typescript", "javascript"])
		.optional()
		.describe("Config file format (default: typescript)"),
	include_comments: z
		.boolean()
		.optional()
		.describe("Include explanatory comments in the config (default: true)"),
	force: z
		.boolean()
		.optional()
		.describe("Overwrite existing config file (default: false)"),
};

/**
 * Generate TypeScript config content with comments
 */
function generateTypescriptConfigWithComments(): string {
	const models = DEFAULT_MODELS.map((m) => `    "${m}"`).join(",\n");

	return `import { defineConfig } from "@klitchevo/code-council/config";

/**
 * Code Council Configuration
 *
 * This file configures the AI models and behavior for Code Council.
 * For full documentation, see: https://github.com/klitchevo/code-council
 */
export default defineConfig({
  /**
   * Models Configuration
   *
   * Specify which OpenRouter models to use for each review type.
   * Browse available models at: https://openrouter.ai/models
   */
  models: {
    // Default models used when specific type is not configured
    defaultModels: [
${models}
    ],

    // Uncomment and customize models for specific review types:
    // codeReview: ["anthropic/claude-sonnet-4", "openai/gpt-4o"],
    // frontendReview: ["anthropic/claude-sonnet-4"],
    // backendReview: ["openai/gpt-4o", "google/gemini-2.0-flash-exp"],
    // planReview: ["anthropic/claude-sonnet-4"],
    // discussion: ["anthropic/claude-sonnet-4", "openai/gpt-4o"],
    // tpsAudit: ["anthropic/claude-sonnet-4", "openai/gpt-4o"],
  },

  /**
   * Consensus Analysis Settings
   *
   * All reviews use consensus analysis by default. These settings
   * control how findings from multiple models are weighted and scored.
   */
  consensus: {
    // Weight specific models higher (1.0 = normal, >1 = higher weight)
    // modelWeights: {
    //   "anthropic/claude-sonnet-4": 1.2,
    //   "openai/gpt-4o": 1.0,
    // },

    // Confidence thresholds for categorizing findings
    highConfidenceThreshold: 0.8,
    moderateConfidenceThreshold: 0.5,
  },

  /**
   * LLM Behavior Settings
   */
  llm: {
    // Temperature: 0.0-2.0, lower = more focused/deterministic
    temperature: 0.3,

    // Maximum tokens in model responses
    maxTokens: 16384,
  },

  /**
   * Session Settings (for council discussions)
   */
  // session: {
  //   maxSessions: 100,           // Max concurrent sessions
  //   maxMessagesPerModel: 20,    // Messages before context windowing
  //   ttlMs: 1800000,             // Session timeout (30 min)
  //   rateLimitPerMinute: 10,     // Rate limit per session
  // },

  /**
   * Input Limits
   */
  // inputLimits: {
  //   maxCodeLength: 100000,      // Max code input length
  //   maxContextLength: 50000,    // Max context length
  //   maxModels: 10,              // Max models per review
  // },
});
`;
}

/**
 * Generate TypeScript config content without comments
 */
function generateTypescriptConfig(): string {
	const models = DEFAULT_MODELS.map((m) => `      "${m}"`).join(",\n");

	return `import { defineConfig } from "@klitchevo/code-council/config";

export default defineConfig({
  models: {
    defaultModels: [
${models}
    ],
  },
  consensus: {
    highConfidenceThreshold: 0.8,
    moderateConfidenceThreshold: 0.5,
  },
  llm: {
    temperature: 0.3,
    maxTokens: 16384,
  },
});
`;
}

/**
 * Generate JavaScript config content with comments
 */
function generateJavascriptConfigWithComments(): string {
	const models = DEFAULT_MODELS.map((m) => `    "${m}"`).join(",\n");

	return `/**
 * Code Council Configuration
 *
 * This file configures the AI models and behavior for Code Council.
 * For full documentation, see: https://github.com/klitchevo/code-council
 *
 * @type {import("@klitchevo/code-council/config").CodeCouncilConfig}
 */
module.exports = {
  /**
   * Models Configuration
   *
   * Specify which OpenRouter models to use for each review type.
   * Browse available models at: https://openrouter.ai/models
   */
  models: {
    // Default models used when specific type is not configured
    defaultModels: [
${models}
    ],

    // Uncomment and customize models for specific review types:
    // codeReview: ["anthropic/claude-sonnet-4", "openai/gpt-4o"],
    // frontendReview: ["anthropic/claude-sonnet-4"],
    // backendReview: ["openai/gpt-4o", "google/gemini-2.0-flash-exp"],
    // planReview: ["anthropic/claude-sonnet-4"],
    // discussion: ["anthropic/claude-sonnet-4", "openai/gpt-4o"],
    // tpsAudit: ["anthropic/claude-sonnet-4", "openai/gpt-4o"],
  },

  /**
   * Consensus Analysis Settings
   */
  consensus: {
    highConfidenceThreshold: 0.8,
    moderateConfidenceThreshold: 0.5,
  },

  /**
   * LLM Behavior Settings
   */
  llm: {
    temperature: 0.3,
    maxTokens: 16384,
  },
};
`;
}

/**
 * Generate JavaScript config content without comments
 */
function generateJavascriptConfig(): string {
	const models = DEFAULT_MODELS.map((m) => `      "${m}"`).join(",\n");

	return `/** @type {import("@klitchevo/code-council/config").CodeCouncilConfig} */
module.exports = {
  models: {
    defaultModels: [
${models}
    ],
  },
  consensus: {
    highConfidenceThreshold: 0.8,
    moderateConfidenceThreshold: 0.5,
  },
  llm: {
    temperature: 0.3,
    maxTokens: 16384,
  },
};
`;
}

/**
 * Handle init_config tool invocation
 */
export function handleInitConfig(input: Record<string, unknown>): {
	success: boolean;
	message: string;
	path?: string;
} {
	const location = (input.location as "directory" | "root") ?? "directory";
	const format = (input.format as "typescript" | "javascript") ?? "typescript";
	const includeComments = (input.include_comments as boolean) ?? true;
	const force = (input.force as boolean) ?? false;

	// Determine file path
	const extension = format === "typescript" ? "ts" : "js";
	const filePath =
		location === "directory"
			? join(process.cwd(), ".code-council", `config.${extension}`)
			: join(process.cwd(), `code-council.config.${extension}`);

	// Check if file already exists
	if (existsSync(filePath) && !force) {
		logger.warn("Config file already exists", { path: filePath });
		return {
			success: false,
			message: `Configuration file already exists at ${filePath}. Use force=true to overwrite.`,
			path: filePath,
		};
	}

	// Generate config content
	let content: string;
	if (format === "typescript") {
		content = includeComments
			? generateTypescriptConfigWithComments()
			: generateTypescriptConfig();
	} else {
		content = includeComments
			? generateJavascriptConfigWithComments()
			: generateJavascriptConfig();
	}

	// Create directory if needed
	const dir = dirname(filePath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
		logger.debug("Created directory", { dir });
	}

	// Write file
	writeFileSync(filePath, content, "utf-8");

	logger.info("Created config file", {
		path: filePath,
		format,
		includeComments,
	});

	return {
		success: true,
		message: `Created configuration file at ${filePath}`,
		path: filePath,
	};
}
