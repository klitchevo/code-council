/**
 * Tests for the extractor module.
 */

import { describe, expect, it } from "vitest";
import { parseExtractionResponse } from "./extractor";

describe("parseExtractionResponse", () => {
	const sourceModel = "test-model";

	it("parses valid JSON response", () => {
		const response = JSON.stringify({
			findings: [
				{
					category: "security",
					severity: "critical",
					title: "SQL Injection",
					description: "User input in query",
					location: { file: "src/api.ts", line: 42 },
					suggestion: "Use parameterized queries",
					rawExcerpt: "SQL Injection found",
					confidence: 0.95,
				},
			],
		});

		const findings = parseExtractionResponse(response, sourceModel);
		expect(findings).toHaveLength(1);
		const finding = findings[0]!;
		expect(finding.category).toBe("security");
		expect(finding.severity).toBe("critical");
		expect(finding.title).toBe("SQL Injection");
		expect(finding.sourceModel).toBe(sourceModel);
		expect(finding.location?.file).toBe("src/api.ts");
		expect(finding.location?.line).toBe(42);
	});

	it("handles JSON wrapped in markdown code blocks", () => {
		const response = `\`\`\`json
{
  "findings": [
    {
      "category": "bug",
      "severity": "high",
      "title": "Null check missing",
      "description": "Potential NPE",
      "rawExcerpt": "Missing null check"
    }
  ]
}
\`\`\``;

		const findings = parseExtractionResponse(response, sourceModel);
		expect(findings).toHaveLength(1);
		const finding = findings[0]!;
		expect(finding.category).toBe("bug");
		expect(finding.title).toBe("Null check missing");
	});

	it("handles JSON wrapped in plain code blocks", () => {
		const response = `\`\`\`
{
  "findings": []
}
\`\`\``;

		const findings = parseExtractionResponse(response, sourceModel);
		expect(findings).toHaveLength(0);
	});

	it("parses empty findings array", () => {
		const response = JSON.stringify({ findings: [] });
		const findings = parseExtractionResponse(response, sourceModel);
		expect(findings).toHaveLength(0);
	});

	it("parses multiple findings", () => {
		const response = JSON.stringify({
			findings: [
				{
					category: "security",
					severity: "critical",
					title: "Issue 1",
					description: "Description 1",
					rawExcerpt: "Excerpt 1",
				},
				{
					category: "performance",
					severity: "medium",
					title: "Issue 2",
					description: "Description 2",
					rawExcerpt: "Excerpt 2",
				},
				{
					category: "bug",
					severity: "low",
					title: "Issue 3",
					description: "Description 3",
					rawExcerpt: "Excerpt 3",
				},
			],
		});

		const findings = parseExtractionResponse(response, sourceModel);
		expect(findings).toHaveLength(3);
		expect(findings[0]?.category).toBe("security");
		expect(findings[1]?.category).toBe("performance");
		expect(findings[2]?.category).toBe("bug");
	});

	it("generates unique IDs for each finding", () => {
		const response = JSON.stringify({
			findings: [
				{
					category: "security",
					severity: "high",
					title: "Issue 1",
					description: "Desc",
					rawExcerpt: "Raw",
				},
				{
					category: "security",
					severity: "high",
					title: "Issue 2",
					description: "Desc",
					rawExcerpt: "Raw",
				},
			],
		});

		const findings = parseExtractionResponse(response, sourceModel);
		expect(findings[0]?.id).not.toBe(findings[1]?.id);
	});

	it("sets extractedAt timestamp", () => {
		const response = JSON.stringify({
			findings: [
				{
					category: "bug",
					severity: "low",
					title: "Test",
					description: "Test",
					rawExcerpt: "Test",
				},
			],
		});

		const findings = parseExtractionResponse(response, sourceModel);
		const finding = findings[0]!;
		expect(finding.extractedAt).toBeTruthy();
		// Should be a valid ISO date string
		expect(() => new Date(finding.extractedAt)).not.toThrow();
	});

	it("handles optional fields", () => {
		const response = JSON.stringify({
			findings: [
				{
					category: "maintainability",
					severity: "info",
					title: "Consider refactoring",
					description: "This could be cleaner",
					rawExcerpt: "Consider refactoring",
					// No location, suggestion, or confidence
				},
			],
		});

		const findings = parseExtractionResponse(response, sourceModel);
		const finding = findings[0]!;
		expect(finding.location).toBeUndefined();
		expect(finding.suggestion).toBeUndefined();
		expect(finding.confidence).toBeUndefined();
	});

	it("handles location with endLine", () => {
		const response = JSON.stringify({
			findings: [
				{
					category: "performance",
					severity: "medium",
					title: "N+1 query",
					description: "Loop with queries",
					location: { file: "src/api.ts", line: 15, endLine: 25 },
					rawExcerpt: "N+1 pattern",
				},
			],
		});

		const findings = parseExtractionResponse(response, sourceModel);
		const finding = findings[0]!;
		expect(finding.location?.line).toBe(15);
		expect(finding.location?.endLine).toBe(25);
	});

	it("throws on invalid JSON", () => {
		const response = "this is not json";
		expect(() => parseExtractionResponse(response, sourceModel)).toThrow();
	});

	it("throws on invalid schema", () => {
		const response = JSON.stringify({
			findings: [
				{
					// Missing required fields
					title: "Only title",
				},
			],
		});
		expect(() => parseExtractionResponse(response, sourceModel)).toThrow();
	});

	it("throws on invalid category", () => {
		const response = JSON.stringify({
			findings: [
				{
					category: "invalid_category",
					severity: "high",
					title: "Test",
					description: "Test",
					rawExcerpt: "Test",
				},
			],
		});
		expect(() => parseExtractionResponse(response, sourceModel)).toThrow();
	});

	it("throws on invalid severity", () => {
		const response = JSON.stringify({
			findings: [
				{
					category: "security",
					severity: "invalid_severity",
					title: "Test",
					description: "Test",
					rawExcerpt: "Test",
				},
			],
		});
		expect(() => parseExtractionResponse(response, sourceModel)).toThrow();
	});
});
