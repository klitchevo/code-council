/**
 * Tests for ConsensusClient
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConsensusExtractionError } from "../errors";
import type { ModelReviewResult, ReviewClient } from "../review-client";
import { ConsensusClient } from "./consensus-client";
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

// Mock extractor
vi.mock("./extractor", () => ({
	extractFindings: vi.fn(),
	extractAllFindings: vi.fn(),
}));

// Mock normalizer
vi.mock("./normalizer", () => ({
	normalizeFindings: vi.fn((findings: Finding[]) => findings),
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

describe("ConsensusClient", () => {
	let mockReviewClient: ReviewClient;
	let consensusClient: ConsensusClient;

	beforeEach(() => {
		vi.clearAllMocks();
		mockReviewClient = createMockReviewClient();
		consensusClient = new ConsensusClient(mockReviewClient);
	});

	describe("constructor", () => {
		it("creates client with default extraction model", () => {
			const client = new ConsensusClient(mockReviewClient);
			expect(client.getExtractionModel()).toBe("anthropic/claude-3-haiku");
		});

		it("creates client with custom extraction model", () => {
			const client = new ConsensusClient(
				mockReviewClient,
				"openai/gpt-4-turbo",
			);
			expect(client.getExtractionModel()).toBe("openai/gpt-4-turbo");
		});
	});

	describe("getExtractionModel", () => {
		it("returns current extraction model", () => {
			expect(consensusClient.getExtractionModel()).toBe(
				"anthropic/claude-3-haiku",
			);
		});
	});

	describe("setExtractionModel", () => {
		it("updates extraction model", () => {
			consensusClient.setExtractionModel("anthropic/claude-3-sonnet");
			expect(consensusClient.getExtractionModel()).toBe(
				"anthropic/claude-3-sonnet",
			);
		});
	});

	describe("extractFindings", () => {
		it("returns empty array for review with error", async () => {
			const review: ModelReviewResult = {
				model: "test-model",
				review: "",
				error: "API Error",
			};

			const result = await consensusClient.extractFindings(review);
			expect(result).toEqual([]);
		});

		it("returns empty array for review with no content", async () => {
			const review: ModelReviewResult = {
				model: "test-model",
				review: "",
			};

			const result = await consensusClient.extractFindings(review);
			expect(result).toEqual([]);
		});

		it("extracts findings from valid review", async () => {
			const { extractFindings } = await import("./extractor");
			const mockFindings = [createMockFinding()];
			(extractFindings as ReturnType<typeof vi.fn>).mockResolvedValue(
				mockFindings,
			);

			const review: ModelReviewResult = {
				model: "test-model",
				review: "Found SQL injection vulnerability in user input handling.",
			};

			const result = await consensusClient.extractFindings(review);
			expect(result).toEqual(mockFindings);
		});

		it("normalizes extracted findings", async () => {
			const { extractFindings } = await import("./extractor");
			const { normalizeFindings } = await import("./normalizer");

			const mockFindings = [createMockFinding()];
			(extractFindings as ReturnType<typeof vi.fn>).mockResolvedValue(
				mockFindings,
			);

			const review: ModelReviewResult = {
				model: "test-model",
				review: "Found security issue",
			};

			await consensusClient.extractFindings(review);
			expect(normalizeFindings).toHaveBeenCalledWith(mockFindings);
		});

		it("re-throws ConsensusExtractionError", async () => {
			const { extractFindings } = await import("./extractor");
			const error = new ConsensusExtractionError(
				"Extraction failed",
				"test-model",
			);
			(extractFindings as ReturnType<typeof vi.fn>).mockRejectedValue(error);

			const review: ModelReviewResult = {
				model: "test-model",
				review: "Some review content",
			};

			await expect(consensusClient.extractFindings(review)).rejects.toThrow(
				ConsensusExtractionError,
			);
		});

		it("wraps other errors in ConsensusExtractionError", async () => {
			const { extractFindings } = await import("./extractor");
			(extractFindings as ReturnType<typeof vi.fn>).mockRejectedValue(
				new Error("Unknown error"),
			);

			const review: ModelReviewResult = {
				model: "test-model",
				review: "Some review content",
			};

			await expect(consensusClient.extractFindings(review)).rejects.toThrow(
				ConsensusExtractionError,
			);
		});

		it("handles non-Error exceptions", async () => {
			const { extractFindings } = await import("./extractor");
			(extractFindings as ReturnType<typeof vi.fn>).mockRejectedValue(
				"string error",
			);

			const review: ModelReviewResult = {
				model: "test-model",
				review: "Some review content",
			};

			await expect(consensusClient.extractFindings(review)).rejects.toThrow(
				ConsensusExtractionError,
			);
		});
	});

	describe("extractAllFindings", () => {
		it("extracts findings from multiple reviews", async () => {
			const { extractAllFindings } = await import("./extractor");
			const mockResults = new Map([
				["model-1", [createMockFinding({ sourceModel: "model-1" })]],
				["model-2", [createMockFinding({ sourceModel: "model-2" })]],
			]);

			(extractAllFindings as ReturnType<typeof vi.fn>).mockResolvedValue({
				results: mockResults,
				errors: [],
			});

			const reviews: ModelReviewResult[] = [
				{ model: "model-1", review: "Review 1" },
				{ model: "model-2", review: "Review 2" },
			];

			const result = await consensusClient.extractAllFindings(reviews);

			expect(result.findings.size).toBe(2);
			expect(result.errors).toHaveLength(0);
			expect(result.totalFindings).toBe(2);
		});

		it("returns errors for failed extractions", async () => {
			const { extractAllFindings } = await import("./extractor");
			const mockResults = new Map([
				["model-1", [createMockFinding({ sourceModel: "model-1" })]],
			]);

			(extractAllFindings as ReturnType<typeof vi.fn>).mockResolvedValue({
				results: mockResults,
				errors: [{ model: "model-2", error: "Extraction failed" }],
			});

			const reviews: ModelReviewResult[] = [
				{ model: "model-1", review: "Review 1" },
				{ model: "model-2", review: "Review 2" },
			];

			const result = await consensusClient.extractAllFindings(reviews);

			expect(result.findings.size).toBe(1);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toEqual({
				model: "model-2",
				error: "Extraction failed",
			});
		});

		it("normalizes all findings", async () => {
			const { extractAllFindings } = await import("./extractor");
			const { normalizeFindings } = await import("./normalizer");

			const finding1 = createMockFinding({ sourceModel: "model-1" });
			const finding2 = createMockFinding({ sourceModel: "model-2" });
			const mockResults = new Map([
				["model-1", [finding1]],
				["model-2", [finding2]],
			]);

			(extractAllFindings as ReturnType<typeof vi.fn>).mockResolvedValue({
				results: mockResults,
				errors: [],
			});

			const reviews: ModelReviewResult[] = [
				{ model: "model-1", review: "Review 1" },
				{ model: "model-2", review: "Review 2" },
			];

			await consensusClient.extractAllFindings(reviews);

			expect(normalizeFindings).toHaveBeenCalledWith([finding1]);
			expect(normalizeFindings).toHaveBeenCalledWith([finding2]);
		});

		it("calculates correct total findings count", async () => {
			const { extractAllFindings } = await import("./extractor");

			const mockResults = new Map([
				[
					"model-1",
					[
						createMockFinding({ id: toFindingId("f1") }),
						createMockFinding({ id: toFindingId("f2") }),
					],
				],
				[
					"model-2",
					[
						createMockFinding({ id: toFindingId("f3") }),
						createMockFinding({ id: toFindingId("f4") }),
						createMockFinding({ id: toFindingId("f5") }),
					],
				],
			]);

			(extractAllFindings as ReturnType<typeof vi.fn>).mockResolvedValue({
				results: mockResults,
				errors: [],
			});

			const reviews: ModelReviewResult[] = [
				{ model: "model-1", review: "Review 1" },
				{ model: "model-2", review: "Review 2" },
			];

			const result = await consensusClient.extractAllFindings(reviews);
			expect(result.totalFindings).toBe(5);
		});
	});

	describe("getAllFindingsFlat", () => {
		it("returns flattened array of all findings", async () => {
			const { extractAllFindings } = await import("./extractor");

			const finding1 = createMockFinding({
				id: toFindingId("f1"),
				sourceModel: "model-1",
			});
			const finding2 = createMockFinding({
				id: toFindingId("f2"),
				sourceModel: "model-1",
			});
			const finding3 = createMockFinding({
				id: toFindingId("f3"),
				sourceModel: "model-2",
			});

			const mockResults = new Map([
				["model-1", [finding1, finding2]],
				["model-2", [finding3]],
			]);

			(extractAllFindings as ReturnType<typeof vi.fn>).mockResolvedValue({
				results: mockResults,
				errors: [],
			});

			const reviews: ModelReviewResult[] = [
				{ model: "model-1", review: "Review 1" },
				{ model: "model-2", review: "Review 2" },
			];

			const result = await consensusClient.getAllFindingsFlat(reviews);

			expect(result.findings).toHaveLength(3);
			expect(result.errors).toHaveLength(0);
		});

		it("returns errors alongside findings", async () => {
			const { extractAllFindings } = await import("./extractor");

			const finding1 = createMockFinding({ sourceModel: "model-1" });
			const mockResults = new Map([["model-1", [finding1]]]);

			(extractAllFindings as ReturnType<typeof vi.fn>).mockResolvedValue({
				results: mockResults,
				errors: [{ model: "model-2", error: "Failed" }],
			});

			const reviews: ModelReviewResult[] = [
				{ model: "model-1", review: "Review 1" },
				{ model: "model-2", review: "Review 2" },
			];

			const result = await consensusClient.getAllFindingsFlat(reviews);

			expect(result.findings).toHaveLength(1);
			expect(result.errors).toHaveLength(1);
		});

		it("handles empty results", async () => {
			const { extractAllFindings } = await import("./extractor");

			(extractAllFindings as ReturnType<typeof vi.fn>).mockResolvedValue({
				results: new Map(),
				errors: [],
			});

			const reviews: ModelReviewResult[] = [];

			const result = await consensusClient.getAllFindingsFlat(reviews);

			expect(result.findings).toHaveLength(0);
			expect(result.errors).toHaveLength(0);
		});
	});

	describe("internal chat method", () => {
		it("uses chatMultiTurn for extraction calls", async () => {
			const { extractFindings } = await import("./extractor");

			// Capture the chat function passed to extractFindings
			let capturedChatFn: ((s: string, u: string) => Promise<string>) | null =
				null;
			(extractFindings as ReturnType<typeof vi.fn>).mockImplementation(
				async (
					_review: string,
					_model: string,
					chatFn: (s: string, u: string) => Promise<string>,
				) => {
					capturedChatFn = chatFn;
					return [];
				},
			);

			const review: ModelReviewResult = {
				model: "test-model",
				review: "Some review",
			};

			await consensusClient.extractFindings(review);

			expect(capturedChatFn).not.toBeNull();

			// Call the captured chat function
			(
				mockReviewClient.chatMultiTurn as ReturnType<typeof vi.fn>
			).mockResolvedValue("response");
			await capturedChatFn!("system prompt", "user message");

			expect(mockReviewClient.chatMultiTurn).toHaveBeenCalledWith(
				"anthropic/claude-3-haiku",
				[
					{ role: "system", content: "system prompt" },
					{ role: "user", content: "user message" },
				],
			);
		});
	});
});
