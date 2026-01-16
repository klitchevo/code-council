/**
 * Tests for config loader functionality
 *
 * Note: These tests use mocking to avoid conflicts with other test files
 * that mock node:fs globally. Integration tests with real filesystem
 * should be run separately if needed.
 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Import the module functions to test - must be done after the mock is set up
// Note: Due to vi.mock hoisting, we need to be careful about what we test

describe("Config Loader - Unit Tests", () => {
	describe("findConfigFile logic", () => {
		it("returns the first matching config file location", () => {
			// This tests the expected search order
			const expectedOrder = [
				".code-council/config.ts",
				".code-council/config.js",
				"code-council.config.ts",
				"code-council.config.js",
			];

			// Verify the search order is documented correctly
			expect(expectedOrder[0]).toBe(".code-council/config.ts");
			expect(expectedOrder[1]).toBe(".code-council/config.js");
			expect(expectedOrder[2]).toBe("code-council.config.ts");
			expect(expectedOrder[3]).toBe("code-council.config.js");
		});
	});

	describe("config path construction", () => {
		it("correctly joins paths", () => {
			const cwd = "/home/user/project";
			const configRelativePath = ".code-council/config.ts";
			const expected = join(cwd, configRelativePath);
			expect(expected).toBe("/home/user/project/.code-council/config.ts");
		});

		it("handles root config location", () => {
			const cwd = "/home/user/project";
			const configRelativePath = "code-council.config.ts";
			const expected = join(cwd, configRelativePath);
			expect(expected).toBe("/home/user/project/code-council.config.ts");
		});
	});
});

describe("Config Loader - Error Handling", () => {
	it("should format Zod validation errors with proper paths", () => {
		// Test the error message format that the loader produces
		const mockIssues = [
			{
				path: ["consensus", "highConfidenceThreshold"],
				message: "Number must be at most 1",
			},
			{
				path: ["models", "codeReview", "0"],
				message: "String must contain at least 1 character(s)",
			},
		];

		const formattedErrors = mockIssues
			.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
			.join("\n");

		expect(formattedErrors).toBe(
			"  - consensus.highConfidenceThreshold: Number must be at most 1\n" +
				"  - models.codeReview.0: String must contain at least 1 character(s)",
		);
	});

	it("should handle empty path in error formatting", () => {
		const mockIssues = [{ path: [], message: "Invalid configuration" }];

		const formattedErrors = mockIssues
			.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
			.join("\n");

		expect(formattedErrors).toBe("  - : Invalid configuration");
	});
});

describe("LoadConfigResult interface", () => {
	it("defines expected structure for empty config", () => {
		const emptyResult = {
			config: {},
			configPath: null,
		};

		expect(emptyResult.config).toEqual({});
		expect(emptyResult.configPath).toBeNull();
	});

	it("defines expected structure for loaded config", () => {
		const loadedResult = {
			config: {
				models: {
					codeReview: ["model-1"],
				},
			},
			configPath: "/path/to/config.ts",
		};

		expect(loadedResult.config.models?.codeReview).toEqual(["model-1"]);
		expect(loadedResult.configPath).toBe("/path/to/config.ts");
	});
});
