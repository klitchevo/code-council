#!/usr/bin/env node

/**
 * Code Council MCP Server
 * Multi-model AI code review server using OpenRouter API
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	getBackendReviewModels,
	getCodeReviewModels,
	getConfigPath,
	getDiscussionModels,
	getFrontendReviewModels,
	getPlanReviewModels,
	getTpsAuditModels,
	initializeConfig,
} from "./config";
import { formatError } from "./errors";
import { logger } from "./logger";
import { ReviewClient } from "./review-client";
import { InMemorySessionStore } from "./session/in-memory-store";
import { createConversationTool } from "./tools/conversation-factory";
import {
	discussCouncilSchema,
	handleDiscussCouncil,
} from "./tools/discuss-council";
import { createReviewTool } from "./tools/factory";
import { handleInitConfig, initConfigSchema } from "./tools/init-config";
import { handleListConfig } from "./tools/list-config";
import {
	backendReviewSchema,
	handleBackendReview,
} from "./tools/review-backend";
import { codeReviewSchema, handleCodeReview } from "./tools/review-code";
import {
	frontendReviewSchema,
	handleFrontendReview,
} from "./tools/review-frontend";
import { gitReviewSchema, handleGitReview } from "./tools/review-git";
import { handlePlanReview, planReviewSchema } from "./tools/review-plan";
import {
	formatTpsAuditResults,
	handleTpsAudit,
	tpsAuditSchema,
} from "./tools/tps-audit";

// CLI argument handling - check before requiring API key
const args = process.argv.slice(2);
const command = args[0];

if (command === "init") {
	// Parse CLI flags for init command
	const cliOptions: Record<string, unknown> = {};

	for (let i = 1; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--js" || arg === "--javascript") {
			cliOptions.format = "javascript";
		} else if (arg === "--ts" || arg === "--typescript") {
			cliOptions.format = "typescript";
		} else if (arg === "--root") {
			cliOptions.location = "root";
		} else if (arg === "--directory" || arg === "--dir") {
			cliOptions.location = "directory";
		} else if (arg === "--no-comments") {
			cliOptions.include_comments = false;
		} else if (arg === "--force" || arg === "-f") {
			cliOptions.force = true;
		} else if (arg === "--help" || arg === "-h") {
			console.log(`
Code Council - Initialize Configuration

Usage: npx @klitchevo/code-council init [options]

Options:
  --ts, --typescript   Generate TypeScript config (default)
  --js, --javascript   Generate JavaScript config
  --root               Create config in project root (code-council.config.ts)
  --dir, --directory   Create config in .code-council/ directory (default)
  --no-comments        Generate config without explanatory comments
  --force, -f          Overwrite existing config file
  --help, -h           Show this help message

Examples:
  npx @klitchevo/code-council init
  npx @klitchevo/code-council init --js --root
  npx @klitchevo/code-council init --force
`);
			process.exit(0);
		}
	}

	const result = handleInitConfig(cliOptions);

	if (result.success) {
		console.log(`✓ ${result.message}`);
		console.log(
			"\nYou can now customize the configuration by editing the file.",
		);
		process.exit(0);
	} else {
		console.error(`✗ ${result.message}`);
		process.exit(1);
	}
}

if (command === "--help" || command === "-h") {
	console.log(`
Code Council - Multi-model AI code review MCP server

Usage: npx @klitchevo/code-council [command]

Commands:
  init     Generate a configuration file with default values
  (none)   Start the MCP server (requires OPENROUTER_API_KEY)

For MCP server usage, configure in your MCP client settings.
See: https://github.com/klitchevo/code-council
`);
	process.exit(0);
}

// Validate API key (only needed for MCP server mode)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
	console.error("Error: OPENROUTER_API_KEY environment variable is required");
	console.error(
		"For MCP clients, add it to the 'env' section of your server config.",
	);
	console.error(
		"For local development, create a .env file with: OPENROUTER_API_KEY=your-key",
	);
	process.exit(1);
}

// Initialize client, session store, and server
const client = new ReviewClient(OPENROUTER_API_KEY);
const sessionStore = new InMemorySessionStore();
const server = new McpServer({
	name: "code-council",
	version: "1.0.0",
});

// Register review tools
createReviewTool(server, {
	name: "review_code",
	description:
		"Review code for quality, bugs, performance, and security issues using multiple AI models in parallel",
	inputSchema: codeReviewSchema,
	handler: (input) => handleCodeReview(client, input),
});

createReviewTool(server, {
	name: "review_frontend",
	description:
		"Review frontend code for accessibility, performance, UX, and best practices using multiple AI models in parallel",
	inputSchema: frontendReviewSchema,
	handler: (input) => handleFrontendReview(client, input),
});

createReviewTool(server, {
	name: "review_backend",
	description:
		"Review backend code for security, performance, architecture, and best practices using multiple AI models in parallel",
	inputSchema: backendReviewSchema,
	handler: (input) => handleBackendReview(client, input),
});

createReviewTool(server, {
	name: "review_plan",
	description:
		"Review implementation plans BEFORE coding to catch issues early using multiple AI models in parallel",
	inputSchema: planReviewSchema,
	handler: (input) => handlePlanReview(client, input),
});

createReviewTool(server, {
	name: "review_git_changes",
	description:
		"Review git changes (staged, unstaged, diff, or specific commit) using multiple AI models in parallel",
	inputSchema: gitReviewSchema,
	handler: (input) => handleGitReview(client, getCodeReviewModels(), input),
});

// Register TPS audit tool (custom handler for HTML/JSON output)
server.registerTool(
	"tps_audit",
	{
		description:
			"Toyota Production System audit - analyze a codebase for flow, waste, bottlenecks, and quality. " +
			"Scans the repository, identifies entry points, maps data flow, and provides actionable recommendations. " +
			"Outputs interactive HTML report by default, or markdown/JSON.",
		inputSchema: tpsAuditSchema,
	},
	async (input: Record<string, unknown>) => {
		try {
			logger.debug("Starting tps_audit", {
				inputKeys: Object.keys(input),
			});

			const result = await handleTpsAudit(client, getTpsAuditModels(), input);
			const formattedOutput = formatTpsAuditResults(result);

			logger.info("Completed tps_audit", {
				modelCount: result.models.length,
				filesScanned: result.scanResult.files.length,
				outputFormat: result.outputFormat,
				hasAnalysis: !!result.analysis,
			});

			return {
				content: [
					{
						type: "text" as const,
						text: formattedOutput,
					},
				],
			};
		} catch (error) {
			logger.error(
				"Error in tps_audit",
				error instanceof Error ? error : new Error(String(error)),
			);
			return formatError(error);
		}
	},
);

// Register config tool
server.registerTool(
	"list_review_config",
	{ description: "Show current model configuration" },
	async () => {
		const { text } = await handleListConfig();
		return {
			content: [{ type: "text" as const, text }],
		};
	},
);

// Register init_config tool
server.registerTool(
	"init_config",
	{
		description:
			"Generate a Code Council configuration file with default values. " +
			"Creates a TypeScript or JavaScript config file with model settings, " +
			"consensus options, and LLM parameters.",
		inputSchema: initConfigSchema,
	},
	async (input: Record<string, unknown>) => {
		try {
			const result = handleInitConfig(input);

			if (result.success) {
				return {
					content: [
						{
							type: "text" as const,
							text: `${result.message}\n\nYou can now customize the configuration by editing the file.`,
						},
					],
				};
			}
			return {
				content: [
					{
						type: "text" as const,
						text: result.message,
					},
				],
			};
		} catch (error) {
			logger.error(
				"Error in init_config",
				error instanceof Error ? error : new Error(String(error)),
			);
			return formatError(error);
		}
	},
);

// Register council discussion tool
createConversationTool(
	server,
	{
		name: "discuss_with_council",
		description:
			"Start or continue a multi-turn discussion with the AI council. " +
			"First call (without session_id) starts a new discussion and returns a session_id. " +
			"Subsequent calls with the session_id continue the conversation. " +
			"Each model maintains its own conversation history for authentic perspectives.",
		inputSchema: discussCouncilSchema,
		handler: (input, store) => handleDiscussCouncil(client, input, store),
	},
	sessionStore,
);

// Graceful shutdown handlers
function handleShutdown(signal: string) {
	logger.info(`Received ${signal}, shutting down gracefully`);
	sessionStore.shutdown();
	process.exit(0);
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

// Start server
async function main() {
	// Initialize configuration from file (if exists)
	await initializeConfig();
	const configFilePath = getConfigPath();
	if (configFilePath) {
		logger.info("Loaded configuration from file", {
			configPath: configFilePath,
		});
	}

	const transport = new StdioServerTransport();
	await server.connect(transport);

	logger.info("Code Council MCP server started", {
		configFile: configFilePath,
		codeReviewModels: getCodeReviewModels(),
		frontendReviewModels: getFrontendReviewModels(),
		backendReviewModels: getBackendReviewModels(),
		planReviewModels: getPlanReviewModels(),
		discussionModels: getDiscussionModels(),
		tpsAuditModels: getTpsAuditModels(),
	});
}

main().catch((error) => {
	logger.error("Fatal error during server startup", error);
	process.exit(1);
});
