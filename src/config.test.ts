import { describe, expect, it } from "vitest";
import { parseModels } from "./config";

describe("parseModels", () => {
	const defaults = ["minimax/minimax-m2.1", "x-ai/grok-code-fast-1"];

	it("should return defaults when env var is undefined", () => {
		expect(parseModels(undefined, defaults)).toEqual(defaults);
	});

	describe("array input (only supported format)", () => {
		it("should accept array of strings", () => {
			const result = parseModels(
				["anthropic/claude-3.5-sonnet", "openai/gpt-4-turbo"],
				defaults,
			);
			expect(result).toEqual([
				"anthropic/claude-3.5-sonnet",
				"openai/gpt-4-turbo",
			]);
		});

		it("should accept single-element array", () => {
			const result = parseModels(["anthropic/claude-3.5-sonnet"], defaults);
			expect(result).toEqual(["anthropic/claude-3.5-sonnet"]);
		});

		it("should filter empty strings from array", () => {
			const result = parseModels(
				["anthropic/claude-3.5-sonnet", "", "  ", "openai/gpt-4-turbo"],
				defaults,
			);
			expect(result).toEqual([
				"anthropic/claude-3.5-sonnet",
				"openai/gpt-4-turbo",
			]);
		});

		it("should return defaults for empty array", () => {
			const result = parseModels([], defaults);
			expect(result).toEqual(defaults);
		});
	});

	describe("JSON string input (MCP format)", () => {
		it("should parse JSON array string", () => {
			const result = parseModels(
				'["anthropic/claude-3.5-sonnet","openai/gpt-4-turbo"]',
				defaults,
			);
			expect(result).toEqual([
				"anthropic/claude-3.5-sonnet",
				"openai/gpt-4-turbo",
			]);
		});

		it("should parse JSON array with spaces", () => {
			const result = parseModels(
				'["anthropic/claude-3.5-sonnet", "openai/gpt-4-turbo"]',
				defaults,
			);
			expect(result).toEqual([
				"anthropic/claude-3.5-sonnet",
				"openai/gpt-4-turbo",
			]);
		});

		it("should filter empty strings from JSON array", () => {
			const result = parseModels(
				'["anthropic/claude-3.5-sonnet", "", "openai/gpt-4-turbo"]',
				defaults,
			);
			expect(result).toEqual([
				"anthropic/claude-3.5-sonnet",
				"openai/gpt-4-turbo",
			]);
		});

		it("should return defaults for empty JSON array", () => {
			const result = parseModels("[]", defaults);
			expect(result).toEqual(defaults);
		});
	});

	describe("invalid formats (should throw)", () => {
		it("should throw for plain string", () => {
			expect(() =>
				parseModels("anthropic/claude-3.5-sonnet", defaults),
			).toThrow("Model configuration must be an array of strings");
		});

		it("should throw for comma-separated string", () => {
			expect(() =>
				parseModels("anthropic/claude-3.5-sonnet,openai/gpt-4-turbo", defaults),
			).toThrow("Model configuration must be an array of strings");
		});

		it("should throw for empty string", () => {
			expect(() => parseModels("", defaults)).toThrow(
				"Model configuration must be an array of strings",
			);
		});

		it("should throw for whitespace string", () => {
			expect(() => parseModels("   ", defaults)).toThrow(
				"Model configuration must be an array of strings",
			);
		});

		it("should throw for JSON object", () => {
			expect(() => parseModels('{"model": "test"}', defaults)).toThrow(
				"Model configuration must be an array of strings",
			);
		});
	});
});
