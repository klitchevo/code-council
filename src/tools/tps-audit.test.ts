import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TpsAnalysis } from "../prompts/tps-audit";
import type { ModelReviewResult, ReviewClient } from "../review-client";
import type { ScanResult } from "../utils/repo-scanner";
import * as repoScanner from "../utils/repo-scanner";
import {
	formatTpsAuditResults,
	handleTpsAudit,
	type TpsAuditResult,
} from "./tps-audit";

// Mock dependencies
vi.mock("../logger", () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("node:fs", () => ({
	existsSync: vi.fn().mockReturnValue(false),
	mkdirSync: vi.fn().mockImplementation(() => {
		throw new Error("mock fs error");
	}),
	writeFileSync: vi.fn(),
}));

// Use spyOn for scanRepository to preserve real implementations of other exports
const mockScanRepository = vi
	.spyOn(repoScanner, "scanRepository")
	.mockImplementation(vi.fn());

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

			const result = formatTpsAuditResults(auditResult);

			// HTML output should contain the data (either in HTML template or markdown fallback)
			expect(result).toContain("my-project");
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

	describe("handleTpsAudit", () => {
		const mockClient = {
			tpsAudit: vi.fn(),
			tpsAuditBatch: vi.fn(),
			tpsAuditSynthesize: vi.fn(),
		} as unknown as ReviewClient;

		const smallScanResult: ScanResult = {
			files: [{ path: "src/index.ts", content: "console.log('test');" }],
			skipped: [],
			warnings: [],
			stats: {
				totalFilesFound: 1,
				totalFilesIncluded: 1,
				totalSize: 100,
				tokenEstimate: 25, // Below 60K threshold
			},
			repoRoot: "/mock/repo/my-project",
		};

		// Create large file content that will force multiple batches
		// Token budget per batch is ~30000, so we need content exceeding that
		const largeContent = "x".repeat(150000); // ~37500 tokens per file
		const largeScanResult: ScanResult = {
			files: [
				{ path: "src/index.ts", content: largeContent },
				{ path: "src/utils.ts", content: largeContent },
			],
			skipped: [],
			warnings: [],
			stats: {
				totalFilesFound: 2,
				totalFilesIncluded: 2,
				totalSize: 300000,
				tokenEstimate: 75000, // Above 60K threshold
			},
			repoRoot: "/mock/repo/big-project",
		};

		const validAnalysisJson = JSON.stringify({
			scores: { overall: 75, flow: 80, waste: 70, quality: 78 },
			flowAnalysis: {
				entryPoints: [],
				diagram: "",
				pathways: [],
				observations: [],
			},
			bottlenecks: [],
			waste: {},
			jidoka: { score: 80, strengths: [], weaknesses: [] },
			recommendations: [],
			summary: { strengths: [], concerns: [], quickWins: [] },
		});

		beforeEach(() => {
			vi.clearAllMocks();
			mockScanRepository.mockReset();
			(mockClient.tpsAudit as ReturnType<typeof vi.fn>).mockReset();
			(mockClient.tpsAuditBatch as ReturnType<typeof vi.fn>).mockReset();
			(mockClient.tpsAuditSynthesize as ReturnType<typeof vi.fn>).mockReset();
		});

		it("should return system message when no files found", async () => {
			mockScanRepository.mockResolvedValue({
				files: [],
				skipped: [{ path: "test.ts", reason: "excluded" }],
				warnings: [],
				stats: {
					totalFilesFound: 1,
					totalFilesIncluded: 0,
					totalSize: 0,
					tokenEstimate: 0,
				},
				repoRoot: "/mock/repo",
			});

			const result = await handleTpsAudit(mockClient, ["model1"], {});

			expect(result.results[0]?.model).toBe("system");
			expect(result.results[0]?.review).toContain("No files found");
			expect(result.analysis).toBeNull();
		});

		it("should use single-pass for small codebases", async () => {
			mockScanRepository.mockResolvedValue(smallScanResult);
			(mockClient.tpsAudit as ReturnType<typeof vi.fn>).mockResolvedValue([
				{ model: "model1", review: validAnalysisJson },
			]);

			const result = await handleTpsAudit(mockClient, ["model1"], {});

			expect(mockClient.tpsAudit).toHaveBeenCalled();
			expect(mockClient.tpsAuditBatch).not.toHaveBeenCalled();
			expect(result.analysis).not.toBeNull();
			expect(result.analysis?.scores.overall).toBe(75);
		});

		it("should use batch processing for large codebases", async () => {
			mockScanRepository.mockResolvedValue(largeScanResult);
			// Real createFileBatches will be used - it will create batches based on files
			(mockClient.tpsAuditBatch as ReturnType<typeof vi.fn>).mockResolvedValue(
				validAnalysisJson,
			);
			(
				mockClient.tpsAuditSynthesize as ReturnType<typeof vi.fn>
			).mockResolvedValue(validAnalysisJson);

			await handleTpsAudit(mockClient, ["model1"], {});

			expect(mockClient.tpsAuditBatch).toHaveBeenCalled();
			expect(mockClient.tpsAuditSynthesize).toHaveBeenCalled();
		});

		it("should pass focus areas to client", async () => {
			mockScanRepository.mockResolvedValue(smallScanResult);
			(mockClient.tpsAudit as ReturnType<typeof vi.fn>).mockResolvedValue([
				{ model: "model1", review: validAnalysisJson },
			]);

			await handleTpsAudit(mockClient, ["model1"], {
				focus_areas: ["security", "performance"],
			});

			expect(mockClient.tpsAudit).toHaveBeenCalledWith(
				expect.any(String),
				["model1"],
				expect.objectContaining({
					focusAreas: ["security", "performance"],
				}),
			);
		});

		it("should handle scan with warnings", async () => {
			mockScanRepository.mockResolvedValue({
				...smallScanResult,
				warnings: ["Skipped sensitive file: .env"],
			});
			(mockClient.tpsAudit as ReturnType<typeof vi.fn>).mockResolvedValue([
				{ model: "model1", review: validAnalysisJson },
			]);

			const result = await handleTpsAudit(mockClient, ["model1"], {});

			expect(result.scanResult.warnings).toContain(
				"Skipped sensitive file: .env",
			);
		});

		it("should handle model errors gracefully", async () => {
			mockScanRepository.mockResolvedValue(smallScanResult);
			(mockClient.tpsAudit as ReturnType<typeof vi.fn>).mockResolvedValue([
				{ model: "model1", review: "", error: "API timeout" },
			]);

			const result = await handleTpsAudit(mockClient, ["model1"], {});

			expect(result.results[0]?.error).toBe("API timeout");
			expect(result.analysis).toBeNull();
		});

		it("should handle unparseable analysis", async () => {
			mockScanRepository.mockResolvedValue(smallScanResult);
			(mockClient.tpsAudit as ReturnType<typeof vi.fn>).mockResolvedValue([
				{ model: "model1", review: "Invalid JSON response" },
			]);

			const result = await handleTpsAudit(mockClient, ["model1"], {});

			expect(result.analysis).toBeNull();
		});

		it("should use default path when not provided", async () => {
			mockScanRepository.mockResolvedValue(smallScanResult);
			(mockClient.tpsAudit as ReturnType<typeof vi.fn>).mockResolvedValue([
				{ model: "model1", review: validAnalysisJson },
			]);

			await handleTpsAudit(mockClient, ["model1"], {});

			expect(mockScanRepository).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(Object),
			);
		});

		it("should respect output format option", async () => {
			mockScanRepository.mockResolvedValue(smallScanResult);
			(mockClient.tpsAudit as ReturnType<typeof vi.fn>).mockResolvedValue([
				{ model: "model1", review: validAnalysisJson },
			]);

			const result = await handleTpsAudit(mockClient, ["model1"], {
				output_format: "json",
			});

			expect(result.outputFormat).toBe("json");
		});

		it("should pass file types to scanner", async () => {
			mockScanRepository.mockResolvedValue(smallScanResult);
			(mockClient.tpsAudit as ReturnType<typeof vi.fn>).mockResolvedValue([
				{ model: "model1", review: validAnalysisJson },
			]);

			await handleTpsAudit(mockClient, ["model1"], {
				file_types: [".ts", ".tsx"],
			});

			expect(mockScanRepository).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					fileTypes: [".ts", ".tsx"],
				}),
			);
		});

		it("should handle batch synthesis failure gracefully", async () => {
			mockScanRepository.mockResolvedValue(largeScanResult);
			// Real createFileBatches will be used
			(mockClient.tpsAuditBatch as ReturnType<typeof vi.fn>).mockResolvedValue(
				validAnalysisJson,
			);
			(
				mockClient.tpsAuditSynthesize as ReturnType<typeof vi.fn>
			).mockRejectedValue(new Error("Synthesis failed"));

			const result = await handleTpsAudit(mockClient, ["model1"], {});

			// Should still return results even if synthesis fails
			expect(result.results).toBeDefined();
		});

		it("should handle batch analysis failure for individual batches", async () => {
			mockScanRepository.mockResolvedValue(largeScanResult);
			// Real createFileBatches will be used
			(mockClient.tpsAuditBatch as ReturnType<typeof vi.fn>)
				.mockResolvedValueOnce(validAnalysisJson)
				.mockRejectedValueOnce(new Error("Batch failed"));
			(
				mockClient.tpsAuditSynthesize as ReturnType<typeof vi.fn>
			).mockResolvedValue(validAnalysisJson);

			const result = await handleTpsAudit(mockClient, ["model1"], {});

			expect(result.results).toBeDefined();
		});
	});
});
