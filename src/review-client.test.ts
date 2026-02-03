import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenRouterError } from "./errors.js";
import { ReviewClient } from "./review-client.js";

// Mock the OpenRouter SDK
vi.mock("@openrouter/sdk", () => {
	const mockSend = vi.fn();
	return {
		OpenRouter: class MockOpenRouter {
			chat = {
				send: mockSend,
			};
		},
	};
});

// Mock the logger
vi.mock("./logger", () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

describe("ReviewClient", () => {
	let client: ReviewClient;
	let mockChatSend: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
		client = new ReviewClient("test-api-key");
		// Get the mock chat.send function
		mockChatSend = (client as any).client.chat.send;
	});

	describe("constructor", () => {
		it("should create a ReviewClient instance", () => {
			expect(client).toBeInstanceOf(ReviewClient);
		});
	});

	describe("reviewCode", () => {
		it("should return reviews from all models", async () => {
			mockChatSend.mockResolvedValue({
				choices: [{ message: { content: "This code looks good!" } }],
			});

			const results = await client.reviewCode(
				"const x = 1;",
				["model1", "model2"],
				"Test code",
			);

			expect(results).toHaveLength(2);
			expect(results[0]).toEqual({
				model: "model1",
				review: "This code looks good!",
			});
			expect(results[1]).toEqual({
				model: "model2",
				review: "This code looks good!",
			});
		});

		it("should handle array content responses", async () => {
			mockChatSend.mockResolvedValue({
				choices: [
					{
						message: {
							content: [
								{ type: "text", text: "Part 1" },
								{ type: "text", text: "Part 2" },
							],
						},
					},
				],
			});

			const results = await client.reviewCode("const x = 1;", ["model1"]);

			expect(results[0]?.review).toBe("Part 1\nPart 2");
		});

		it("should handle errors from individual models", async () => {
			mockChatSend
				.mockResolvedValueOnce({
					choices: [{ message: { content: "Good code" } }],
				})
				.mockRejectedValueOnce(new Error("API Error"));

			const results = await client.reviewCode("const x = 1;", [
				"model1",
				"model2",
			]);

			expect(results).toHaveLength(2);
			expect(results[0]?.error).toBeUndefined();
			expect(results[1]?.error).toBeDefined();
		});

		it("should throw OpenRouterError when no content is returned", async () => {
			mockChatSend.mockResolvedValue({
				choices: [{ message: { content: null } }],
			});

			const results = await client.reviewCode("const x = 1;", ["model1"]);

			expect(results[0]?.error).toContain("No response content from model");
		});
	});

	describe("reviewFrontend", () => {
		it("should review frontend code with default options", async () => {
			mockChatSend.mockResolvedValue({
				choices: [{ message: { content: "Frontend review" } }],
			});

			const results = await client.reviewFrontend("<button>Click me</button>", [
				"model1",
			]);

			expect(results[0]?.review).toBe("Frontend review");
		});

		it("should accept framework and reviewType options", async () => {
			mockChatSend.mockResolvedValue({
				choices: [{ message: { content: "Accessibility review" } }],
			});

			const results = await client.reviewFrontend(
				"<button>Click me</button>",
				["model1"],
				{
					framework: "react",
					reviewType: "accessibility",
					context: "Login button",
				},
			);

			expect(results[0]?.review).toBe("Accessibility review");
		});

		it("should handle all review types", async () => {
			mockChatSend.mockResolvedValue({
				choices: [{ message: { content: "Review" } }],
			});

			for (const reviewType of [
				"accessibility",
				"performance",
				"ux",
				"full",
			] as const) {
				await client.reviewFrontend("<div>Test</div>", ["model1"], {
					reviewType,
				});
			}

			expect(mockChatSend).toHaveBeenCalledTimes(4);
		});
	});

	describe("reviewBackend", () => {
		it("should review backend code with default options", async () => {
			mockChatSend.mockResolvedValue({
				choices: [{ message: { content: "Backend review" } }],
			});

			const results = await client.reviewBackend("app.get('/api', handler)", [
				"model1",
			]);

			expect(results[0]?.review).toBe("Backend review");
		});

		it("should accept language and reviewType options", async () => {
			mockChatSend.mockResolvedValue({
				choices: [{ message: { content: "Security review" } }],
			});

			const results = await client.reviewBackend(
				"app.get('/api', handler)",
				["model1"],
				{
					language: "node",
					reviewType: "security",
					context: "API endpoint",
				},
			);

			expect(results[0]?.review).toBe("Security review");
		});

		it("should handle all review types", async () => {
			mockChatSend.mockResolvedValue({
				choices: [{ message: { content: "Review" } }],
			});

			for (const reviewType of [
				"security",
				"performance",
				"architecture",
				"full",
			] as const) {
				await client.reviewBackend("const x = 1;", ["model1"], { reviewType });
			}

			expect(mockChatSend).toHaveBeenCalledTimes(4);
		});
	});

	describe("reviewPlan", () => {
		it("should review implementation plan with default options", async () => {
			mockChatSend.mockResolvedValue({
				choices: [{ message: { content: "Plan review" } }],
			});

			const results = await client.reviewPlan("Step 1: Create database", [
				"model1",
			]);

			expect(results[0]?.review).toBe("Plan review");
		});

		it("should accept reviewType and context options", async () => {
			mockChatSend.mockResolvedValue({
				choices: [{ message: { content: "Feasibility review" } }],
			});

			const results = await client.reviewPlan(
				"Step 1: Create database",
				["model1"],
				{
					reviewType: "feasibility",
					context: "2 week timeline",
				},
			);

			expect(results[0]?.review).toBe("Feasibility review");
		});

		it("should handle all review types", async () => {
			mockChatSend.mockResolvedValue({
				choices: [{ message: { content: "Review" } }],
			});

			for (const reviewType of [
				"feasibility",
				"completeness",
				"risks",
				"timeline",
				"full",
			] as const) {
				await client.reviewPlan("Test plan", ["model1"], { reviewType });
			}

			expect(mockChatSend).toHaveBeenCalledTimes(5);
		});
	});

	describe("error handling", () => {
		it("should preserve OpenRouterError", async () => {
			const originalError = new OpenRouterError("Rate limit", 429, true);
			mockChatSend.mockRejectedValue(originalError);

			const results = await client.reviewCode("const x = 1;", ["model1"]);

			expect(results[0]?.error).toBeDefined();
		});

		it("should convert generic errors to OpenRouterError", async () => {
			mockChatSend.mockRejectedValue(new Error("Network error"));

			const results = await client.reviewCode("const x = 1;", ["model1"]);

			expect(results[0]?.error).toContain("Network error");
		});

		it("should detect rate limit errors", async () => {
			mockChatSend.mockRejectedValue(new Error("429 rate limit exceeded"));

			const results = await client.reviewCode("const x = 1;", ["model1"]);

			expect(results[0]?.error).toBeDefined();
		});

		it("should handle non-Error objects", async () => {
			mockChatSend.mockRejectedValue("String error");

			const results = await client.reviewCode("const x = 1;", ["model1"]);

			expect(results[0]?.error).toBeDefined();
		});
	});

	describe("chatMultiTurn", () => {
		it("should send messages with conversation history", async () => {
			mockChatSend.mockResolvedValue({
				choices: [{ message: { content: "Response to follow-up" } }],
			});

			const messages = [
				{ role: "system" as const, content: "You are helpful" },
				{ role: "user" as const, content: "Hello" },
				{ role: "assistant" as const, content: "Hi there!" },
				{ role: "user" as const, content: "Follow-up question" },
			];

			const result = await client.chatMultiTurn("model1", messages);

			expect(result).toBe("Response to follow-up");
			expect(mockChatSend).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "model1",
					messages: expect.arrayContaining([
						expect.objectContaining({ role: "system" }),
						expect.objectContaining({ role: "user" }),
					]),
				}),
			);
		});

		it("should handle array content in multi-turn responses", async () => {
			mockChatSend.mockResolvedValue({
				choices: [
					{
						message: {
							content: [
								{ type: "text", text: "Part A" },
								{ type: "text", text: "Part B" },
							],
						},
					},
				],
			});

			const result = await client.chatMultiTurn("model1", [
				{ role: "user", content: "test" },
			]);

			expect(result).toBe("Part A\nPart B");
		});

		it("should throw OpenRouterError when no content returned", async () => {
			mockChatSend.mockResolvedValue({
				choices: [{ message: { content: null } }],
			});

			await expect(
				client.chatMultiTurn("model1", [{ role: "user", content: "test" }]),
			).rejects.toThrow(OpenRouterError);
		});

		it("should handle timeout errors", async () => {
			const abortError = new Error("abort");
			abortError.name = "AbortError";
			mockChatSend.mockRejectedValue(abortError);

			await expect(
				client.chatMultiTurn("model1", [{ role: "user", content: "test" }]),
			).rejects.toThrow(/timed out/);
		});

		it("should detect rate limit errors in multi-turn", async () => {
			mockChatSend.mockRejectedValue(new Error("429 rate limit exceeded"));

			await expect(
				client.chatMultiTurn("model1", [{ role: "user", content: "test" }]),
			).rejects.toThrow(OpenRouterError);
		});

		it("should preserve OpenRouterError in multi-turn", async () => {
			const originalError = new OpenRouterError("Custom error", 500);
			mockChatSend.mockRejectedValue(originalError);

			await expect(
				client.chatMultiTurn("model1", [{ role: "user", content: "test" }]),
			).rejects.toThrow(originalError);
		});
	});

	describe("discussWithCouncil", () => {
		it("should call chatMultiTurn for each model", async () => {
			mockChatSend.mockResolvedValue({
				choices: [{ message: { content: "Model response" } }],
			});

			const getMessages = (model: string) => [
				{ role: "system" as const, content: `You are ${model}` },
				{ role: "user" as const, content: "Discuss this" },
			];

			const results = await client.discussWithCouncil(
				["model1", "model2"],
				getMessages,
			);

			expect(results).toHaveLength(2);
			expect(results[0]?.model).toBe("model1");
			expect(results[1]?.model).toBe("model2");
			expect(mockChatSend).toHaveBeenCalledTimes(2);
		});

		it("should handle errors from individual models in council", async () => {
			mockChatSend
				.mockResolvedValueOnce({
					choices: [{ message: { content: "Good response" } }],
				})
				.mockRejectedValueOnce(new Error("Model error"));

			const getMessages = () => [{ role: "user" as const, content: "test" }];

			const results = await client.discussWithCouncil(
				["model1", "model2"],
				getMessages,
			);

			expect(results).toHaveLength(2);
			expect(results[0]?.review).toBe("Good response");
			expect(results[1]?.error).toBeDefined();
		});
	});

	describe("tpsAudit", () => {
		it("should perform TPS audit with all models", async () => {
			mockChatSend.mockResolvedValue({
				choices: [{ message: { content: '{"scores": {"overall": 75}}' } }],
			});

			const results = await client.tpsAudit(
				"=== FILE: index.ts ===\nconsole.log('test');",
				["model1", "model2"],
				{ repoName: "test-repo", focusAreas: ["security"] },
			);

			expect(results).toHaveLength(2);
			expect(mockChatSend).toHaveBeenCalledTimes(2);
		});

		it("should work without options", async () => {
			mockChatSend.mockResolvedValue({
				choices: [{ message: { content: '{"scores": {"overall": 50}}' } }],
			});

			const results = await client.tpsAudit("test content", ["model1"]);

			expect(results).toHaveLength(1);
		});
	});

	describe("tpsAuditBatch", () => {
		it("should process a single batch", async () => {
			mockChatSend.mockResolvedValue({
				choices: [{ message: { content: '{"scores": {"overall": 60}}' } }],
			});

			const result = await client.tpsAuditBatch(
				"batch content",
				"model1",
				0,
				3,
				{ repoName: "test-repo" },
			);

			expect(result).toContain("scores");
			expect(mockChatSend).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "model1",
				}),
			);
		});

		it("should replace batch index placeholders in system prompt", async () => {
			mockChatSend.mockResolvedValue({
				choices: [{ message: { content: '{"scores": {}}' } }],
			});

			await client.tpsAuditBatch("content", "model1", 1, 5);

			// Verify the system prompt was modified correctly
			const call = mockChatSend?.mock?.calls?.[0]?.[0];
			const systemMessage = call?.messages?.find(
				(m: any) => m.role === "system",
			);
			expect(systemMessage?.content).toContain("batch 2 of 5");
		});
	});

	describe("tpsAuditSynthesize", () => {
		it("should synthesize batch results", async () => {
			mockChatSend.mockResolvedValue({
				choices: [
					{ message: { content: '{"scores": {"overall": 70, "flow": 65}}' } },
				],
			});

			const batchResults = [
				{
					batchIndex: 0,
					tokenCount: 1000,
					analysis: {
						scores: { overall: 60, flow: 55, waste: 65, quality: 60 },
						flowAnalysis: {
							entryPoints: [],
							diagram: "",
							pathways: [],
							observations: [],
						},
						bottlenecks: [],
						waste: {},
						jidoka: { score: 70, strengths: [], weaknesses: [] },
						recommendations: [],
						summary: { strengths: [], concerns: [], quickWins: [] },
					},
					rawResponse: "",
				},
				{
					batchIndex: 1,
					tokenCount: 2000,
					analysis: null,
					rawResponse: "Some raw response that failed to parse",
				},
			];

			const result = await client.tpsAuditSynthesize(
				batchResults,
				"model1",
				"test-repo",
			);

			expect(result).toContain("scores");
		});

		it("should work without repo name", async () => {
			mockChatSend.mockResolvedValue({
				choices: [{ message: { content: '{"scores": {}}' } }],
			});

			const batchResults = [
				{
					batchIndex: 0,
					tokenCount: 1000,
					analysis: {
						scores: { overall: 70, flow: 75, waste: 65, quality: 70 },
						flowAnalysis: {
							entryPoints: [],
							diagram: "",
							pathways: [],
							observations: [],
						},
						bottlenecks: [],
						waste: {},
						jidoka: { score: 70, strengths: [], weaknesses: [] },
						recommendations: [],
						summary: { strengths: [], concerns: [], quickWins: [] },
					},
					rawResponse: "",
				},
			];

			await client.tpsAuditSynthesize(batchResults, "model1");

			expect(mockChatSend).toHaveBeenCalled();
		});
	});
});
