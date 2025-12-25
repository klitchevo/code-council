/**
 * Multi-model review client for code, frontend, backend, and plan reviews
 * Uses OpenRouter API to access multiple LLM providers
 */

import { OpenRouter } from "@openrouter/sdk";
import { LLM_CONFIG } from "./constants";
import { OpenRouterError } from "./errors";
import { logger } from "./logger";
import * as backendReviewPrompts from "./prompts/backend-review";
import * as codeReviewPrompts from "./prompts/code-review";
import * as frontendReviewPrompts from "./prompts/frontend-review";
import * as planReviewPrompts from "./prompts/plan-review";
import { executeInParallel } from "./utils/parallel-executor";

/**
 * Result from a single model's review.
 * Either contains a review or an error, never both.
 */
export interface ModelReviewResult {
	/** The model identifier (e.g., "anthropic/claude-3.5-sonnet") */
	model: string;
	/** The review content from the model */
	review: string;
	/** Error message if the review failed */
	error?: string;
}

/**
 * Client for performing multi-model code reviews.
 * Supports parallel execution across multiple AI models for diverse perspectives.
 *
 * @example
 * ```typescript
 * const client = new ReviewClient(process.env.OPENROUTER_API_KEY);
 * const results = await client.reviewCode(
 *   'function add(a, b) { return a + b; }',
 *   ['anthropic/claude-3.5-sonnet', 'openai/gpt-4-turbo'],
 *   'JavaScript addition function'
 * );
 * ```
 */
export class ReviewClient {
	private client: OpenRouter;

	constructor(apiKey: string) {
		this.client = new OpenRouter({
			apiKey,
		});
	}

	/**
	 * Send a chat request to OpenRouter API
	 * @param model - Model identifier (e.g., "anthropic/claude-3.5-sonnet")
	 * @param systemPrompt - System prompt for the model
	 * @param userMessage - User message/question
	 * @returns The model's response content
	 * @throws {OpenRouterError} If the API call fails
	 */
	private async chat(
		model: string,
		systemPrompt: string,
		userMessage: string,
	): Promise<string> {
		try {
			logger.debug("Sending chat request", {
				model,
				messageLength: userMessage.length,
			});

			const response = await this.client.chat.send({
				model,
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "user", content: userMessage },
				],
				temperature: LLM_CONFIG.DEFAULT_TEMPERATURE,
				maxTokens: LLM_CONFIG.DEFAULT_MAX_TOKENS,
			});

			const content = response.choices?.[0]?.message?.content;

			if (typeof content === "string") {
				logger.debug("Received response", { model, length: content.length });
				return content;
			}

			if (Array.isArray(content)) {
				const text = content
					.filter((item) => item.type === "text")
					.map((item) => (item as { type: "text"; text: string }).text)
					.join("\n");
				logger.debug("Received array response", { model, length: text.length });
				return text;
			}

			throw new OpenRouterError("No response content from model", 500);
		} catch (error) {
			if (error instanceof OpenRouterError) {
				throw error;
			}

			const message = error instanceof Error ? error.message : "Unknown error";
			logger.error("Chat request failed", error, { model });

			const isRetryable =
				message.includes("429") || message.includes("rate limit");
			throw new OpenRouterError(message, undefined, isRetryable);
		}
	}

	/**
	 * Review code for quality, bugs, performance, and security
	 * @param code - Code to review
	 * @param models - Array of model identifiers to use
	 * @param context - Optional context (language, description, etc.)
	 * @returns Array of review results from each model
	 */
	async reviewCode(
		code: string,
		models: string[],
		context?: string,
	): Promise<ModelReviewResult[]> {
		const userMessage = codeReviewPrompts.buildUserMessage(code, context);

		return executeInParallel(models, (model) =>
			this.chat(model, codeReviewPrompts.SYSTEM_PROMPT, userMessage),
		);
	}

	/**
	 * Review frontend code for accessibility, performance, and UX
	 */
	async reviewFrontend(
		code: string,
		models: string[],
		options?: {
			framework?: string;
			reviewType?: "accessibility" | "performance" | "ux" | "full";
			context?: string;
		},
	): Promise<ModelReviewResult[]> {
		const userMessage = frontendReviewPrompts.buildUserMessage(
			code,
			options?.reviewType || "full",
			options?.framework,
			options?.context,
		);

		return executeInParallel(models, (model) =>
			this.chat(model, frontendReviewPrompts.SYSTEM_PROMPT, userMessage),
		);
	}

	/**
	 * Review backend code for security, performance, and architecture
	 */
	async reviewBackend(
		code: string,
		models: string[],
		options?: {
			language?: string;
			reviewType?: "security" | "performance" | "architecture" | "full";
			context?: string;
		},
	): Promise<ModelReviewResult[]> {
		const userMessage = backendReviewPrompts.buildUserMessage(
			code,
			options?.reviewType || "full",
			options?.language,
			options?.context,
		);

		return executeInParallel(models, (model) =>
			this.chat(model, backendReviewPrompts.SYSTEM_PROMPT, userMessage),
		);
	}

	/**
	 * Review implementation plans before code is written
	 */
	async reviewPlan(
		plan: string,
		models: string[],
		options?: {
			reviewType?:
				| "feasibility"
				| "completeness"
				| "risks"
				| "timeline"
				| "full";
			context?: string;
		},
	): Promise<ModelReviewResult[]> {
		const userMessage = planReviewPrompts.buildUserMessage(
			plan,
			options?.reviewType || "full",
			options?.context,
		);

		return executeInParallel(models, (model) =>
			this.chat(model, planReviewPrompts.SYSTEM_PROMPT, userMessage),
		);
	}
}
