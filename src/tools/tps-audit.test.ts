import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TpsAnalysis } from "../prompts/tps-audit";
import type { ModelReviewResult } from "../review-client";
import type { ScanResult } from "../utils/repo-scanner";
import { formatTpsAuditResults, type TpsAuditResult } from "./tps-audit";

// Mock dependencies
vi.mock("../logger", () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("../utils/repo-scanner", () => ({
	scanRepository: vi.fn(),
	aggregateFiles: vi.fn().mockReturnValue("aggregated content"),
}));

vi.mock("./factory", () => ({
	formatResultsAsHtml: vi.fn().mockReturnValue("<html>report</html>"),
	getTemplatesDir: vi.fn().mockReturnValue("/mock/templates"),
}));

describe("tps-audit tool", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("formatTpsAuditResults", () => {
		const mockScanResult: ScanResult = {
			files: [{ path: "src/index.ts", content: "console.log('test');" }],
			skipped: [],
			warnings: [],
			stats: {
				totalFilesFound: 10,
				totalFilesIncluded: 1,
				totalSize: 100,
				tokenEstimate: 25,
			},
			repoRoot: "/mock/repo/my-project",
		};

		const mockResults: ModelReviewResult[] = [
			{ model: "model-1", review: "Analysis results here" },
			{ model: "model-2", review: "More analysis" },
		];

		const mockAnalysis: TpsAnalysis = {
			scores: { overall: 75, flow: 80, waste: 70, quality: 78 },
			flowAnalysis: {
				entryPoints: ["src/index.ts"],
				diagram: "flow",
				pathways: ["path1"],
				observations: [],
			},
			bottlenecks: [],
			waste: {},
			jidoka: { score: 80, strengths: [], weaknesses: [] },
			recommendations: [],
			summary: {
				strengths: ["Good"],
				concerns: ["Bad"],
				quickWins: ["Quick"],
			},
		};

		it("should format as HTML by default", () => {
			const auditResult: TpsAuditResult = {
				results: mockResults,
				models: ["model-1", "model-2"],
				scanResult: mockScanResult,
				analysis: mockAnalysis,
				outputFormat: "html",
			};

			const { formatResultsAsHtml } = require("./factory");
			formatTpsAuditResults(auditResult);

			expect(formatResultsAsHtml).toHaveBeenCalled();
		});

		it("should format as JSON when specified", () => {
			const auditResult: TpsAuditResult = {
				results: mockResults,
				models: ["model-1", "model-2"],
				scanResult: mockScanResult,
				analysis: mockAnalysis,
				outputFormat: "json",
			};

			const result = formatTpsAuditResults(auditResult);
			const parsed = JSON.parse(result);

			expect(parsed.analysis).toBeDefined();
			expect(parsed.scanStats).toBeDefined();
			expect(parsed.modelResponses).toHaveLength(2);
		});

		it("should format as markdown when specified", () => {
			const auditResult: TpsAuditResult = {
				results: mockResults,
				models: ["model-1", "model-2"],
				scanResult: mockScanResult,
				analysis: mockAnalysis,
				outputFormat: "markdown",
			};

			const result = formatTpsAuditResults(auditResult);

			expect(result).toContain("# TPS Audit Report");
			expect(result).toContain("**Repository:**");
			expect(result).toContain("## Scores");
			expect(result).toContain("**Overall:** 75/100");
		});

		it("should include scan statistics in markdown", () => {
			const auditResult: TpsAuditResult = {
				results: mockResults,
				models: ["model-1"],
				scanResult: mockScanResult,
				analysis: mockAnalysis,
				outputFormat: "markdown",
			};

			const result = formatTpsAuditResults(auditResult);

			expect(result).toContain("**Files Analyzed:** 1");
			expect(result).toContain("**Token Estimate:** ~25");
		});

		it("should include warnings in markdown", () => {
			const resultWithWarnings: TpsAuditResult = {
				results: mockResults,
				models: ["model-1"],
				scanResult: {
					...mockScanResult,
					warnings: ["Skipped sensitive file: .env"],
				},
				analysis: mockAnalysis,
				outputFormat: "markdown",
			};

			const result = formatTpsAuditResults(resultWithWarnings);

			expect(result).toContain("## Warnings");
			expect(result).toContain("Skipped sensitive file");
		});

		it("should include model perspectives in markdown", () => {
			const auditResult: TpsAuditResult = {
				results: mockResults,
				models: ["model-1", "model-2"],
				scanResult: mockScanResult,
				analysis: mockAnalysis,
				outputFormat: "markdown",
			};

			const result = formatTpsAuditResults(auditResult);

			expect(result).toContain("## Model Perspectives");
			expect(result).toContain("### model-1");
			expect(result).toContain("### model-2");
		});

		it("should handle errors in model results", () => {
			const resultsWithError: TpsAuditResult = {
				results: [
					{ model: "model-1", review: "", error: "API timeout" },
					{ model: "model-2", review: "Success" },
				],
				models: ["model-1", "model-2"],
				scanResult: mockScanResult,
				analysis: null,
				outputFormat: "markdown",
			};

			const result = formatTpsAuditResults(resultsWithError);

			expect(result).toContain("**Error:** API timeout");
			expect(result).toContain("Success");
		});

		it("should handle null analysis gracefully", () => {
			const noAnalysis: TpsAuditResult = {
				results: mockResults,
				models: ["model-1"],
				scanResult: mockScanResult,
				analysis: null,
				outputFormat: "markdown",
			};

			const result = formatTpsAuditResults(noAnalysis);

			// Should still include basic info
			expect(result).toContain("# TPS Audit Report");
			expect(result).toContain("**Repository:**");
			// But should not have scores section
			expect(result).not.toContain("## Scores");
		});

		it("should include summary sections in markdown with analysis", () => {
			const auditResult: TpsAuditResult = {
				results: mockResults,
				models: ["model-1"],
				scanResult: mockScanResult,
				analysis: mockAnalysis,
				outputFormat: "markdown",
			};

			const result = formatTpsAuditResults(auditResult);

			expect(result).toContain("## Summary");
			expect(result).toContain("### Strengths");
			expect(result).toContain("### Concerns");
			expect(result).toContain("### Quick Wins");
		});
	});
});
