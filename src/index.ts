#!/usr/bin/env node

/**
 * Code Council MCP Server
 * Multi-model AI code review server using OpenRouter API
 */

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	BACKEND_REVIEW_MODELS,
	CODE_REVIEW_MODELS,
	FRONTEND_REVIEW_MODELS,
	PLAN_REVIEW_MODELS,
} from "./config";
import { logger } from "./logger";
import { ReviewClient } from "./review-client";
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

// Initialize client and server
const client = new ReviewClient(OPENROUTER_API_KEY);
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

// Start server
async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);

	logger.info("Code Council MCP server started", {
		codeReviewModels: CODE_REVIEW_MODELS,
		frontendReviewModels: FRONTEND_REVIEW_MODELS,
		backendReviewModels: BACKEND_REVIEW_MODELS,
		planReviewModels: PLAN_REVIEW_MODELS,
	});
}

main().catch((error) => {
	logger.error("Fatal error during server startup", error);
	process.exit(1);
});
