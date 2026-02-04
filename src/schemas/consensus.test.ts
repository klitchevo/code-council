/**
 * Tests for the consensus schema validation.
 */

import { describe, expect, it } from "vitest";
import { ExtractionResponseSchema } from "./consensus";

describe("ExtractionResponseSchema", () => {
	describe("line number validation", () => {
		it("accepts line: 0 as a valid line number", () => {
			const input = {
				findings: [
					{
						category: "security",
						severity: "high",
						title: "Issue at file start",
						description: "Problem found at line 0",
						location: {
							file: "src/index.ts",
							line: 0,
						},
					},
				],
			};

			const result = ExtractionResponseSchema.safeParse(input);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.findings[0]?.location?.line).toBe(0);
			}
		});

		it("accepts line: 1 as a valid line number", () => {
			const input = {
				findings: [
					{
						category: "bug",
						severity: "medium",
						title: "Test issue",
						description: "Description",
						location: {
							file: "src/test.ts",
							line: 1,
						},
					},
				],
			};

			const result = ExtractionResponseSchema.safeParse(input);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.findings[0]?.location?.line).toBe(1);
			}
		});

		it("accepts string line numbers and coerces to integers", () => {
			const input = {
				findings: [
					{
						category: "performance",
						severity: "low",
						title: "String line number",
						description: "Some models output line numbers as strings",
						location: {
							file: "src/api.ts",
							line: "42",
						},
					},
				],
			};

			const result = ExtractionResponseSchema.safeParse(input);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.findings[0]?.location?.line).toBe(42);
			}
		});

		it("accepts string line: '0' and coerces to 0", () => {
			const input = {
				findings: [
					{
						category: "security",
						severity: "high",
						title: "File start issue",
						description: "GLM model outputs line as string",
						location: {
							file: "src/main.ts",
							line: "0",
						},
					},
				],
			};

			const result = ExtractionResponseSchema.safeParse(input);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.findings[0]?.location?.line).toBe(0);
			}
		});

		it("rejects negative line numbers", () => {
			const input = {
				findings: [
					{
						category: "bug",
						severity: "medium",
						title: "Invalid line",
						description: "Negative lines should fail",
						location: {
							file: "src/test.ts",
							line: -1,
						},
					},
				],
			};

			const result = ExtractionResponseSchema.safeParse(input);

			expect(result.success).toBe(false);
		});

		it("accepts null/undefined line numbers", () => {
			const input = {
				findings: [
					{
						category: "other",
						severity: "info",
						title: "No line specified",
						description: "Location without line",
						location: {
							file: "src/utils.ts",
							line: null,
						},
					},
				],
			};

			const result = ExtractionResponseSchema.safeParse(input);

			expect(result.success).toBe(true);
		});
	});

	describe("category normalization", () => {
		it("normalizes uppercase categories to lowercase", () => {
			const input = {
				findings: [
					{
						category: "SECURITY",
						severity: "HIGH",
						title: "Test",
						description: "Test",
					},
				],
			};

			const result = ExtractionResponseSchema.safeParse(input);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.findings[0]?.category).toBe("security");
				expect(result.data.findings[0]?.severity).toBe("high");
			}
		});

		it("maps unknown categories to 'other'", () => {
			const input = {
				findings: [
					{
						category: "unknown_category",
						severity: "medium",
						title: "Test",
						description: "Test",
					},
				],
			};

			const result = ExtractionResponseSchema.safeParse(input);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.findings[0]?.category).toBe("other");
			}
		});
	});
});
