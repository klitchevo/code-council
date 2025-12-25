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
			constructor(_config: any) {}
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
});
