/**
 * Tool factory for creating MCP review tools with consistent error handling
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import { formatError } from "../errors";
import { logger } from "../logger";
import type { ModelReviewResult } from "../review-client";

/**
 * MCP tool response type
 */
type MCPToolResponse = {
	content: Array<{
		type: "text";
		text: string;
	}>;
	isError?: boolean;
};

/**
 * Format review results into a readable markdown string
 */
function formatResults(results: ModelReviewResult[]): string {
	return results
		.map((r) => {
			if (r.error) {
				return `## Review from \`${r.model}\`\n\n**Error:** ${r.error}`;
			}
			return `## Review from \`${r.model}\`\n\n${r.review}`;
		})
		.join("\n\n---\n\n");
}

/**
 * Create a review tool with consistent error handling and logging
 */
export function createReviewTool(
	server: McpServer,
	config: {
		name: string;
		description: string;
		inputSchema: Record<string, z.ZodType<unknown>>;
		handler: (input: Record<string, unknown>) => Promise<{
			results: ModelReviewResult[];
			models: string[];
			reviewType?: string;
		}>;
	},
): void {
	server.registerTool(
		config.name,
		{
			description: config.description,
			inputSchema: config.inputSchema,
		},
		async (input: Record<string, unknown>) => {
			try {
				logger.debug(`Starting ${config.name}`, {
					inputKeys: Object.keys(input),
				});

				const { results, models, reviewType } = await config.handler(input);

				logger.info(`Completed ${config.name}`, {
					modelCount: models.length,
					successCount: results.filter((r) => !r.error).length,
					errorCount: results.filter((r) => r.error).length,
				});

				const title = reviewType
					? `# ${config.name.replace("review_", "").replace("_", " ")} Review - ${reviewType} (${models.length} models)`
					: `# ${config.name.replace("review_", "").replace("_", " ")} Review Results (${models.length} models)`;

				return {
					content: [
						{
							type: "text" as const,
							text: `${title}\n\n${formatResults(results)}`,
						},
					],
				} satisfies MCPToolResponse;
			} catch (error) {
				logger.error(
					`Error in ${config.name}`,
					error instanceof Error ? error : new Error(String(error)),
				);
				return formatError(error);
			}
		},
	);
}
