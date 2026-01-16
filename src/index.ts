#!/usr/bin/env node

/**
 * Code Council MCP Server
 * Multi-model AI code review server using OpenRouter API
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	BACKEND_REVIEW_MODELS,
	CODE_REVIEW_MODELS,
	DISCUSSION_MODELS,
	FRONTEND_REVIEW_MODELS,
	getConfigPath,
	initializeConfig,
	PLAN_REVIEW_MODELS,
	TPS_AUDIT_MODELS,
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

// Validate API key
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
	handler: (input) => handleGitReview(client, CODE_REVIEW_MODELS, input),
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

			const result = await handleTpsAudit(client, TPS_AUDIT_MODELS, input);
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
		codeReviewModels: CODE_REVIEW_MODELS,
		frontendReviewModels: FRONTEND_REVIEW_MODELS,
		backendReviewModels: BACKEND_REVIEW_MODELS,
		planReviewModels: PLAN_REVIEW_MODELS,
		discussionModels: DISCUSSION_MODELS,
		tpsAuditModels: TPS_AUDIT_MODELS,
	});
}

main().catch((error) => {
	logger.error("Fatal error during server startup", error);
	process.exit(1);
});
