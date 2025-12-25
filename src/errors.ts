/**
 * Custom error classes for better error handling and user feedback.
 */

/**
 * Base error class for all application errors
 */
export class AppError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly userMessage?: string,
	) {
		super(message);
		this.name = this.constructor.name;
		Error.captureStackTrace(this, this.constructor);
	}
}

/**
 * Error thrown when OpenRouter API calls fail
 */
export class OpenRouterError extends AppError {
	constructor(
		message: string,
		public readonly statusCode?: number,
		public readonly retryable: boolean = false,
	) {
		super(
			message,
			"OPENROUTER_ERROR",
			retryable
				? "The AI service is temporarily unavailable. Please try again in a moment."
				: "Unable to complete the review. Please check your API key and try again.",
		);
	}
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends AppError {
	constructor(
		message: string,
		public readonly field: string,
	) {
		super(message, "CONFIGURATION_ERROR", `Configuration error: ${message}`);
	}
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends AppError {
	constructor(
		message: string,
		public readonly field: string,
	) {
		super(
			message,
			"VALIDATION_ERROR",
			`Invalid input for ${field}: ${message}`,
		);
	}
}

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
 * Format any error for display to users (string format)
 */
export function formatErrorMessage(error: unknown): string {
	if (error instanceof AppError) {
		return error.userMessage || error.message;
	}

	if (error instanceof Error) {
		// Sanitize error messages to avoid leaking sensitive info
		const sanitized = error.message
			.replace(/sk-or-v1-[a-zA-Z0-9]+/g, "[REDACTED]")
			.replace(/Bearer [a-zA-Z0-9-_]+/g, "Bearer [REDACTED]");

		// Map common errors to user-friendly messages
		if (sanitized.includes("401") || sanitized.includes("Unauthorized")) {
			return "API authentication failed. Please check your OPENROUTER_API_KEY environment variable.";
		}
		if (sanitized.includes("429") || sanitized.includes("rate limit")) {
			return "Rate limit exceeded. Please wait a moment and try again.";
		}
		if (sanitized.includes("timeout") || sanitized.includes("ETIMEDOUT")) {
			return "Request timed out. The AI service may be slow. Please try again.";
		}

		return sanitized;
	}

	return "An unexpected error occurred. Please try again.";
}

/**
 * Format error for MCP tool response
 */
export function formatError(error: unknown): MCPToolResponse {
	return {
		content: [
			{
				type: "text",
				text: `Error: ${formatErrorMessage(error)}`,
			},
		],
		isError: true,
	};
}
