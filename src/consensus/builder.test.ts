/**
 * Tests for consensus builder
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModelReviewResult, ReviewClient } from "../review-client";
import {
	buildConsensus,
	buildConsensusReport,
	formatForHostExtraction,
} from "./builder";
import type { ConsensusClient } from "./consensus-client";
import type { Finding } from "./types";
import { toFindingId } from "./types";

// Mock logger
vi.mock("../logger", () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

// Mock consensus-client
vi.mock("./consensus-client", () => ({
	ConsensusClient: vi.fn().mockImplementation(() => ({
		getAllFindingsFlat: vi.fn(),
		getExtractionModel: vi.fn(() => "anthropic/claude-3-haiku"),
	})),
}));

// Mock clustering
vi.mock("./clustering", () => ({
	clusterFindings: vi.fn(() => []),
	groupByConfidence: vi.fn(() => ({
		highConfidence: [],
		moderateConfidence: [],
		lowConfidence: [],
	})),
}));

// Mock scoring
vi.mock("./scoring", () => ({
	scoreClusters: vi.fn((clusters) => clusters),
	detectAllDisagreements: vi.fn(() => []),
	calculateStats: vi.fn(() => ({
		unanimous: 0,
		majority: 0,
		minority: 0,
		single: 0,
		disagreements: 0,
	})),
}));

// Mock formatter
vi.mock("./formatter", () => ({
	formatReport: vi.fn(() => "# Formatted Report"),
}));

const createMockFinding = (overrides: Partial<Finding> = {}): Finding => ({
	id: toFindingId("finding-test-123"),
	sourceModel: "test-model",
	category: "security",
	severity: "high",
	title: "Test Finding",
	description: "Test description",
	rawExcerpt: "Test excerpt",
	extractedAt: new Date().toISOString(),
	...overrides,
});

const createMockReviewClient = () => {
	return {
		chatMultiTurn: vi.fn(),
		reviewCode: vi.fn(),
		reviewFrontend: vi.fn(),
		reviewBackend: vi.fn(),
		reviewPlan: vi.fn(),
	} as unknown as ReviewClient;
};

describe("consensus/builder", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("buildConsensusReport", () => {
		it("builds a complete consensus report", async () => {
			const mockConsensusClient = {
				getAllFindingsFlat: vi.fn().mockResolvedValue({
					findings: [createMockFinding()],
					errors: [],
				}),
				getExtractionModel: vi.fn(() => "anthropic/claude-3-haiku"),
			} as unknown as ConsensusClient;

			const reviews: ModelReviewResult[] = [
				{ model: "model-1", review: "Found security issue" },
				{ model: "model-2", review: "Found bug" },
			];

			const result = await buildConsensusReport(reviews, mockConsensusClient);

			expect(result.report.version).toBe("1.0");
			expect(result.report.participatingModels).toEqual(["model-1", "model-2"]);
			expect(result.report.generatedAt).toBeDefined();
			expect(result.formatted).toBeDefined();
		});

		it("uses default options when not provided", async () => {
			const mockConsensusClient = {
				getAllFindingsFlat: vi.fn().mockResolvedValue({
					findings: [],
					errors: [],
				}),
				getExtractionModel: vi.fn(() => "anthropic/claude-3-haiku"),
			} as unknown as ConsensusClient;

			const reviews: ModelReviewResult[] = [
				{ model: "model-1", review: "Review" },
			];

			const result = await buildConsensusReport(reviews, mockConsensusClient);

			expect(result.report.thresholds.high).toBe(0.7);
			expect(result.report.thresholds.moderate).toBe(0.33);
		});

		it("uses custom options when provided", async () => {
			const mockConsensusClient = {
				getAllFindingsFlat: vi.fn().mockResolvedValue({
					findings: [],
					errors: [],
				}),
				getExtractionModel: vi.fn(() => "anthropic/claude-3-haiku"),
			} as unknown as ConsensusClient;

			const reviews: ModelReviewResult[] = [
				{ model: "model-1", review: "Review" },
			];

			const result = await buildConsensusReport(reviews, mockConsensusClient, {
				highConfidenceThreshold: 0.9,
				moderateConfidenceThreshold: 0.6,
				modelWeights: { "model-1": 1.5 },
			});

			expect(result.report.thresholds.high).toBe(0.9);
			expect(result.report.thresholds.moderate).toBe(0.6);
			expect(result.report.modelWeights).toEqual({ "model-1": 1.5 });
		});

		it("handles partial extraction failures", async () => {
			const mockConsensusClient = {
				getAllFindingsFlat: vi.fn().mockResolvedValue({
					findings: [createMockFinding()],
					errors: [{ model: "model-2", error: "Failed" }],
				}),
				getExtractionModel: vi.fn(() => "anthropic/claude-3-haiku"),
			} as unknown as ConsensusClient;

			const reviews: ModelReviewResult[] = [
				{ model: "model-1", review: "Review" },
				{ model: "model-2", review: "Review" },
			];

			const result = await buildConsensusReport(reviews, mockConsensusClient);

			// Should still build report with available findings
			expect(result.report.participatingModels).toHaveLength(2);
			expect(result.report.metadata?.extractionErrors).toBe(1);
		});

		it("includes extraction metadata", async () => {
			const mockConsensusClient = {
				getAllFindingsFlat: vi.fn().mockResolvedValue({
					findings: [createMockFinding()],
					errors: [{ model: "model-2", error: "Failed" }],
				}),
				getExtractionModel: vi.fn(() => "custom/extraction-model"),
			} as unknown as ConsensusClient;

			const reviews: ModelReviewResult[] = [
				{ model: "model-1", review: "Review" },
				{ model: "model-2", review: "Review" },
			];

			const result = await buildConsensusReport(reviews, mockConsensusClient);

			expect(result.report.metadata?.extractionModel).toBe(
				"custom/extraction-model",
			);
			expect(result.report.metadata?.extractionErrors).toBe(1);
		});

		it("calculates execution time", async () => {
			const mockConsensusClient = {
				getAllFindingsFlat: vi.fn().mockResolvedValue({
					findings: [],
					errors: [],
				}),
				getExtractionModel: vi.fn(() => "anthropic/claude-3-haiku"),
			} as unknown as ConsensusClient;

			const reviews: ModelReviewResult[] = [
				{ model: "model-1", review: "Review" },
			];

			const result = await buildConsensusReport(reviews, mockConsensusClient);

			expect(result.report.executionTimeMs).toBeGreaterThanOrEqual(0);
		});
	});

	describe("formatForHostExtraction", () => {
		it("formats reviews for host extraction in markdown", () => {
			const reviews: ModelReviewResult[] = [
				{ model: "anthropic/claude-3-sonnet", review: "Good code quality" },
				{ model: "openai/gpt-4", review: "Found potential issues" },
			];

			const result = formatForHostExtraction(reviews, "markdown");

			expect(result.formatted).toContain("# Multi-Model Code Review Results");
			expect(result.formatted).toContain("2 models participated");
			expect(result.formatted).toContain(
				"## Review from `anthropic/claude-3-sonnet`",
			);
			expect(result.formatted).toContain("Good code quality");
			expect(result.formatted).toContain("## Review from `openai/gpt-4`");
			expect(result.formatted).toContain("Found potential issues");
		});

		it("formats reviews for host extraction in JSON", () => {
			const reviews: ModelReviewResult[] = [
				{ model: "model-1", review: "Review content" },
			];

			const result = formatForHostExtraction(reviews, "json");

			const parsed = JSON.parse(result.formatted);
			expect(parsed.mode).toBe("host_extraction");
			expect(parsed.reviews).toHaveLength(1);
			expect(parsed.reviews[0].model).toBe("model-1");
			expect(parsed.reviews[0].review).toBe("Review content");
		});

		it("handles reviews with errors", () => {
			const reviews: ModelReviewResult[] = [
				{ model: "model-1", review: "Success" },
				{ model: "model-2", review: "", error: "API Error" },
			];

			const result = formatForHostExtraction(reviews, "markdown");

			expect(result.formatted).toContain("Success");
			expect(result.formatted).toContain("**Error:** API Error");
		});

		it("includes instructions for analysis", () => {
			const reviews: ModelReviewResult[] = [
				{ model: "model-1", review: "Review" },
			];

			const result = formatForHostExtraction(reviews, "markdown");

			expect(result.formatted).toContain("## Instructions for Analysis");
			expect(result.formatted).toContain("High-confidence findings");
			expect(result.formatted).toContain("Medium-confidence findings");
			expect(result.formatted).toContain("Disagreements");
		});

		it("returns minimal report for host extraction", () => {
			const reviews: ModelReviewResult[] = [
				{ model: "model-1", review: "Review" },
			];

			const result = formatForHostExtraction(reviews);

			expect(result.report.metadata?.extractionModel).toBe("host");
			expect(result.report.totalFindings).toBe(0);
		});

		it("defaults to markdown format", () => {
			const reviews: ModelReviewResult[] = [
				{ model: "model-1", review: "Review" },
			];

			const result = formatForHostExtraction(reviews);

			expect(result.formatted).toContain("# Multi-Model Code Review Results");
		});

		it("includes category and severity descriptions in JSON format", () => {
			const reviews: ModelReviewResult[] = [
				{ model: "model-1", review: "Review" },
			];

			const result = formatForHostExtraction(reviews, "json");

			const parsed = JSON.parse(result.formatted);
			expect(parsed.categories).toBeDefined();
			expect(parsed.severities).toBeDefined();
		});
	});

	describe("buildConsensus", () => {
		it("uses host extraction mode by default", async () => {
			const reviews: ModelReviewResult[] = [
				{ model: "model-1", review: "Review content" },
			];

			const mockReviewClient = createMockReviewClient();

			const result = await buildConsensus(reviews, mockReviewClient);

			// Host extraction mode returns formatted reviews, not API-extracted findings
			expect(result.report.metadata?.extractionModel).toBe("host");
			expect(result.formatted).toContain("# Multi-Model Code Review Results");
		});

		it("passes output format to host extraction", async () => {
			const reviews: ModelReviewResult[] = [
				{ model: "model-1", review: "Review" },
			];

			const mockReviewClient = createMockReviewClient();

			const result = await buildConsensus(reviews, mockReviewClient, {
				outputFormat: "json",
			});

			// JSON format should be parseable
			expect(() => JSON.parse(result.formatted)).not.toThrow();
		});
	});
});
