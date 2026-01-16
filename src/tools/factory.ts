/**
 * Tool factory for creating MCP review tools with consistent error handling
 *
 * All review tools use host extraction mode by default, which formats results
 * for the MCP host model (e.g., Claude) to analyze. This is more efficient
 * than making additional API calls for extraction.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import { formatForHostExtraction } from "../consensus/builder";
import type { OutputFormat as ConsensusFormat } from "../consensus/types";
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
 * Output format options
 */
export type OutputFormat = "markdown" | "html" | "json";

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
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/**
 * Format results as HTML using a template
 */
export function formatResultsAsHtml(
	results: ModelReviewResult[],
	templatePath: string,
	data: {
		analysis?: unknown;
		repoName?: string;
	} = {},
): string {
	try {
		// Read template file
		let template = readFileSync(templatePath, "utf-8");

		// Prepare model perspectives
		const modelPerspectives = results.map((r) => ({
			model: r.model,
			content: r.error ? `Error: ${r.error}` : r.review,
			hasError: !!r.error,
		}));

		// Prepare report data
		const reportData = {
			analysis: data.analysis || null,
			repoName: data.repoName || "Unknown Repository",
			modelPerspectives,
			generatedAt: new Date().toISOString(),
		};

		// Inject data into template (replace placeholder)
		template = template.replace(
			"{{REPORT_DATA}}",
			JSON.stringify(reportData, null, 2),
		);

		return template;
	} catch (error) {
		logger.error("Failed to generate HTML report", error);
		// Fallback to markdown
		return formatResults(results);
	}
}

/**
 * Get the templates directory path
 */
export function getTemplatesDir(): string {
	// Handle both ESM and CommonJS environments
	try {
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);
		return join(__dirname, "..", "..", "templates");
	} catch {
		// Fallback for CommonJS
		return join(process.cwd(), "templates");
	}
}

/**
 * Create a review tool with consistent error handling and logging.
 * All review tools use host extraction mode by default, formatting results
 * for the MCP host model to analyze and synthesize.
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

				const { results, models } = await config.handler(input);

				// Get output format from input if provided
				const outputFormat =
					(input.output_format as ConsensusFormat) ?? "markdown";

				logger.info(`Completed ${config.name}`, {
					modelCount: models.length,
					successCount: results.filter((r) => !r.error).length,
					errorCount: results.filter((r) => r.error).length,
					outputFormat,
				});

				// Use host extraction format for all reviews
				// This provides a structured format that the MCP host model can analyze
				const { formatted } = formatForHostExtraction(results, outputFormat);

				return {
					content: [
						{
							type: "text" as const,
							text: formatted,
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

/**
 * @deprecated Use createReviewTool instead. All review tools now use host extraction by default.
 *
 * This function is kept for backwards compatibility but simply delegates to createReviewTool.
 * The consensus analysis is now always enabled via host extraction mode.
 */
export function createConsensusReviewTool(
	server: McpServer,
	_reviewClient: unknown,
	config: {
		name: string;
		description: string;
		inputSchema: Record<string, z.ZodType<unknown>>;
		consensusConfig?: unknown;
		handler: (input: Record<string, unknown>) => Promise<{
			results: ModelReviewResult[];
			models: string[];
			reviewType?: string;
		}>;
	},
): void {
	logger.warn(
		`createConsensusReviewTool is deprecated. Use createReviewTool instead. Tool "${config.name}" will use host extraction mode.`,
	);

	// Delegate to the unified createReviewTool
	createReviewTool(server, {
		name: config.name,
		description: config.description,
		inputSchema: config.inputSchema,
		handler: config.handler,
	});
}
