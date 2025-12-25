import { describe, expect, it } from "vitest";
import {
	AppError,
	ConfigurationError,
	formatError,
	formatErrorMessage,
	OpenRouterError,
	ValidationError,
} from "./errors";

describe("Error Classes", () => {
	describe("AppError", () => {
		it("should create error with code and user message", () => {
			const error = new AppError(
				"Internal message",
				"ERR_CODE",
				"User message",
			);
			expect(error.message).toBe("Internal message");
			expect(error.code).toBe("ERR_CODE");
			expect(error.userMessage).toBe("User message");
			expect(error.name).toBe("AppError");
		});
	});

	describe("OpenRouterError", () => {
		it("should create retryable error", () => {
			const error = new OpenRouterError("Rate limit", 429, true);
			expect(error.message).toBe("Rate limit");
			expect(error.statusCode).toBe(429);
			expect(error.retryable).toBe(true);
			expect(error.code).toBe("OPENROUTER_ERROR");
		});

		it("should create non-retryable error", () => {
			const error = new OpenRouterError("Invalid API key", 401, false);
			expect(error.retryable).toBe(false);
		});
	});

	describe("ConfigurationError", () => {
		it("should create error with field", () => {
			const error = new ConfigurationError("Invalid value", "API_KEY");
			expect(error.field).toBe("API_KEY");
			expect(error.code).toBe("CONFIGURATION_ERROR");
		});
	});

	describe("ValidationError", () => {
		it("should create error with field", () => {
			const error = new ValidationError("Too long", "code");
			expect(error.field).toBe("code");
			expect(error.code).toBe("VALIDATION_ERROR");
		});
	});
});

describe("formatErrorMessage", () => {
	it("should use userMessage from AppError", () => {
		const error = new AppError("Internal", "CODE", "User-friendly");
		expect(formatErrorMessage(error)).toBe("User-friendly");
	});

	it("should sanitize API keys from error messages", () => {
		const error = new Error("Failed with key sk-or-v1-abc123def456");
		expect(formatErrorMessage(error)).toBe("Failed with key [REDACTED]");
	});

	it("should sanitize Bearer tokens", () => {
		const error = new Error("Auth failed: Bearer abc-123-def");
		expect(formatErrorMessage(error)).toBe("Auth failed: Bearer [REDACTED]");
	});

	it("should map 401 errors to friendly message", () => {
		const error = new Error("401 Unauthorized");
		expect(formatErrorMessage(error)).toBe(
			"API authentication failed. Please check your OPENROUTER_API_KEY environment variable.",
		);
	});

	it("should map rate limit errors to friendly message", () => {
		const error = new Error("429 rate limit exceeded");
		expect(formatErrorMessage(error)).toBe(
			"Rate limit exceeded. Please wait a moment and try again.",
		);
	});

	it("should map timeout errors to friendly message", () => {
		const error = new Error("Request timeout ETIMEDOUT");
		expect(formatErrorMessage(error)).toBe(
			"Request timed out. The AI service may be slow. Please try again.",
		);
	});

	it("should handle unknown errors", () => {
		expect(formatErrorMessage("random string")).toBe(
			"An unexpected error occurred. Please try again.",
		);
	});

	it("should handle null/undefined", () => {
		expect(formatErrorMessage(null)).toBe(
			"An unexpected error occurred. Please try again.",
		);
	});
});

describe("formatError", () => {
	it("should return MCP error response", () => {
		const error = new Error("Something went wrong");
		const response = formatError(error);

		expect(response).toEqual({
			content: [
				{
					type: "text",
					text: "Error: Something went wrong",
				},
			],
			isError: true,
		});
	});

	it("should handle AppError with user message", () => {
		const error = new AppError("Internal", "CODE", "User-friendly message");
		const response = formatError(error);

		expect(response.content[0]?.text).toBe("Error: User-friendly message");
	});
});
