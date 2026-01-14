/**
 * Tool factory for creating MCP conversation tools with session management
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import { formatError } from "../errors.js";
import { logger } from "../logger.js";
import type { ModelReviewResult } from "../review-client.js";
import type { ISessionStore } from "../session/session-store.js";
import type { SessionId } from "../session/types.js";

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
 * Result from a conversation tool handler
 */
export interface ConversationResult {
	results: ModelReviewResult[];
	models: readonly string[];
	sessionId: SessionId;
	isNewSession: boolean;
	topic: string;
}

/**
 * Format council discussion results for MCP response
 */
function formatDiscussionResults(
	results: ModelReviewResult[],
	sessionId: SessionId,
	isNewSession: boolean,
	topic: string,
): string {
	const header = isNewSession
		? `# Council Discussion Started\n\n**Topic:** ${topic}\n**Session ID:** \`${sessionId}\`\n\n_Use this session_id in subsequent calls to continue the discussion._\n\n---\n\n`
		: `# Council Discussion Continued\n\n**Session ID:** \`${sessionId}\`\n\n---\n\n`;

	const responses = results
		.map((r) => {
			const modelName = r.model.split("/").pop() || r.model;
			if (r.error) {
				return `## ${modelName}\n\n**Error:** ${r.error}`;
			}
			return `## ${modelName}\n\n${r.review}`;
		})
		.join("\n\n---\n\n");

	const footer = `\n\n---\n\n**Session ID:** \`${sessionId}\` _(include in your next message to continue)_`;

	return header + responses + footer;
}

/**
 * Create a conversation tool with session management
 */
export function createConversationTool(
	server: McpServer,
	config: {
		name: string;
		description: string;
		inputSchema: Record<string, z.ZodType<unknown>>;
		handler: (
			input: Record<string, unknown>,
			sessionStore: ISessionStore,
		) => Promise<ConversationResult>;
	},
	sessionStore: ISessionStore,
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

				const { results, models, sessionId, isNewSession, topic } =
					await config.handler(input, sessionStore);

				logger.info(`Completed ${config.name}`, {
					sessionId,
					isNewSession,
					modelCount: models.length,
					successCount: results.filter((r) => !r.error).length,
					errorCount: results.filter((r) => r.error).length,
				});

				return {
					content: [
						{
							type: "text" as const,
							text: formatDiscussionResults(
								results,
								sessionId,
								isNewSession,
								topic,
							),
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
