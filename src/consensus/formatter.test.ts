/**
 * Tests for the formatter module.
 */

import { describe, expect, it } from "vitest";
import { formatReport } from "./formatter";
import type { ConsensusReport, Disagreement, FindingCluster } from "./types";
import { toClusterId, toDisagreementId, toFindingId } from "./types";

// Helper to create a minimal valid report
function createReport(
	overrides: Partial<ConsensusReport> = {},
): ConsensusReport {
	return {
		version: "1.0",
		generatedAt: "2024-01-15T10:00:00Z",
		executionTimeMs: 500,
		participatingModels: ["model1", "model2"],
		modelWeights: { model1: 1.0, model2: 1.0 },
		thresholds: { high: 0.8, moderate: 0.5 },
		totalFindings: 3,
		stats: {
			unanimous: 1,
			majority: 1,
			minority: 0,
			single: 1,
			disagreements: 0,
		},
		highConfidence: [],
		moderateConfidence: [],
		lowConfidence: [],
		disagreements: [],
		metadata: {
			extractionModel: "anthropic/claude-3-haiku",
			extractionErrors: 0,
		},
		...overrides,
	};
}

// Helper to create a cluster
function createCluster(
	overrides: Partial<FindingCluster> = {},
): FindingCluster {
	return {
		id: toClusterId("test-cluster"),
		title: "Test Issue",
		category: "security",
		severity: "high",
		canonicalLocation: { file: "src/api.ts", line: 42 },
		findings: [
			{
				id: toFindingId("test-finding"),
				sourceModel: "model1",
				category: "security",
				severity: "high",
				title: "Test Issue",
				description: "This is a test issue",
				location: { file: "src/api.ts", line: 42 },
				suggestion: "Fix it",
				rawExcerpt: "raw",
				extractedAt: "2024-01-15T10:00:00Z",
			},
		],
		agreeingModels: ["model1", "model2"],
		silentModels: [],
		disagreingModels: [],
		confidence: 1.0,
		consensusType: "unanimous",
		...overrides,
	};
}

describe("formatReport", () => {
	describe("markdown format", () => {
		it("generates valid markdown with header", () => {
			const report = createReport();
			const output = formatReport(report, "markdown");

			expect(output).toContain("# Consensus Code Review Report");
			expect(output).toContain("*Generated: 2024-01-15T10:00:00Z*");
		});

		it("includes summary section", () => {
			const report = createReport();
			const output = formatReport(report, "markdown");

			expect(output).toContain("## Summary");
			expect(output).toContain("**Participating Models:** 2");
			expect(output).toContain("**Total Findings:** 3");
		});

		it("includes consensus distribution table", () => {
			const report = createReport();
			const output = formatReport(report, "markdown");

			expect(output).toContain("### Consensus Distribution");
			expect(output).toContain("✅ Unanimous | 1");
		});

		it("formats high confidence findings", () => {
			const report = createReport({
				highConfidence: [createCluster()],
			});
			const output = formatReport(report, "markdown");

			expect(output).toContain("## 🔥 High Confidence Findings");
			expect(output).toContain("🟠 Test Issue");
			expect(output).toContain("`src/api.ts:42`");
		});

		it("formats disagreements", () => {
			const disagreement: Disagreement = {
				id: toDisagreementId("test-disagreement"),
				clusterId: toClusterId("test-cluster"),
				topic: "Severity disagreement",
				category: "security",
				location: { file: "src/api.ts", line: 42 },
				positions: [
					{ model: "model1", stance: "critical", reasoning: "Very dangerous" },
					{ model: "model2", stance: "low", reasoning: "Not that bad" },
				],
				humanActionRequired: "Review to determine severity",
			};

			const report = createReport({
				disagreements: [disagreement],
				stats: { ...createReport().stats, disagreements: 1 },
			});
			const output = formatReport(report, "markdown");

			expect(output).toContain("## ⚔️ Disagreements Requiring Human Review");
			expect(output).toContain("Severity disagreement");
			expect(output).toContain("Review to determine severity");
		});

		it("includes metadata section", () => {
			const report = createReport();
			const output = formatReport(report, "markdown");

			expect(output).toContain("## Metadata");
			expect(output).toContain("`anthropic/claude-3-haiku`");
		});
	});

	describe("json format", () => {
		it("returns valid JSON", () => {
			const report = createReport();
			const output = formatReport(report, "json");

			const parsed = JSON.parse(output);
			expect(parsed.version).toBe("1.0");
			expect(parsed.participatingModels).toHaveLength(2);
		});

		it("preserves all report fields", () => {
			const report = createReport({
				highConfidence: [createCluster()],
			});
			const output = formatReport(report, "json");

			const parsed = JSON.parse(output);
			expect(parsed.highConfidence).toHaveLength(1);
			expect(parsed.highConfidence[0].title).toBe("Test Issue");
		});
	});

	describe("html format", () => {
		it("returns valid HTML document", () => {
			const report = createReport();
			const output = formatReport(report, "html");

			expect(output).toContain("<!DOCTYPE html>");
			expect(output).toContain("<html");
			expect(output).toContain("</html>");
		});

		it("includes CSS styles", () => {
			const report = createReport();
			const output = formatReport(report, "html");

			expect(output).toContain("<style>");
			expect(output).toContain("--critical:");
		});

		it("formats findings with severity classes", () => {
			const report = createReport({
				highConfidence: [createCluster({ severity: "critical" })],
			});
			const output = formatReport(report, "html");

			expect(output).toContain("severity-critical");
		});

		it("escapes HTML special characters", () => {
			const cluster = createCluster({
				title: "<script>alert('xss')</script>",
			});
			const report = createReport({
				highConfidence: [cluster],
			});
			const output = formatReport(report, "html");

			expect(output).not.toContain("<script>");
			expect(output).toContain("&lt;script&gt;");
		});

		it("formats disagreements section", () => {
			const disagreement: Disagreement = {
				id: toDisagreementId("test"),
				clusterId: toClusterId("test"),
				topic: "Test topic",
				category: "security",
				positions: [{ model: "m1", stance: "yes" }],
				humanActionRequired: "Review this",
			};

			const report = createReport({
				disagreements: [disagreement],
			});
			const output = formatReport(report, "html");

			expect(output).toContain("Disagreements Requiring Human Review");
			expect(output).toContain('class="disagreement"');
		});
	});

	describe("default format", () => {
		it("defaults to markdown", () => {
			const report = createReport();
			const output = formatReport(report);

			expect(output).toContain("# Consensus Code Review Report");
		});
	});
});
