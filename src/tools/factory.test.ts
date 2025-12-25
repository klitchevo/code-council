import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createReviewTool } from "./factory.js";

vi.mock("../logger", () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

interface MockServer {
	registerTool: ReturnType<typeof vi.fn>;
}

describe("factory", () => {
	let mockServer: MockServer;
	let mockRegisterTool: ReturnType<typeof vi.fn>;
	let registeredHandler: (input: Record<string, unknown>) => Promise<{
		content: Array<{ type: "text"; text: string }>;
		isError?: boolean;
	}>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockRegisterTool = vi.fn((_name, _schema, handler) => {
			registeredHandler = handler;
		});
		mockServer = {
			registerTool: mockRegisterTool,
		} as MockServer;
	});

	describe("createReviewTool", () => {
		it("should register a tool with the server", () => {
			const config = {
				name: "test_review",
				description: "Test review tool",
				inputSchema: {
					code: z.string(),
				},
				handler: vi.fn().mockResolvedValue({
					results: [],
					models: [],
				}),
			};

			createReviewTool(mockServer as any, config);

			expect(mockRegisterTool).toHaveBeenCalledTimes(1);
			const call = mockRegisterTool.mock.calls[0];
			expect(call?.[0]).toBe("test_review");
			expect(call?.[1].description).toBe("Test review tool");
			expect(typeof call?.[2]).toBe("function");
		});

		it("should format successful results", async () => {
			const config = {
				name: "test_review",
				description: "Test review",
				inputSchema: { code: z.string() },
				handler: vi.fn().mockResolvedValue({
					results: [
						{ model: "model1", review: "Good code" },
						{ model: "model2", review: "Looks fine" },
					],
					models: ["model1", "model2"],
				}),
			};

			createReviewTool(mockServer as any, config);

			const response = await registeredHandler({ code: "test" });

			expect(response.content[0]?.type).toBe("text");
			expect(response.content[0]?.text).toContain("test review Review Results");
			expect(response.content[0]?.text).toContain("(2 models)");
			expect(response.content[0]?.text).toContain("Review from `model1`");
			expect(response.content[0]?.text).toContain("Good code");
			expect(response.content[0]?.text).toContain("Review from `model2`");
			expect(response.content[0]?.text).toContain("Looks fine");
		});

		it("should include reviewType in title when provided", async () => {
			const config = {
				name: "review_frontend",
				description: "Frontend review",
				inputSchema: { code: z.string() },
				handler: vi.fn().mockResolvedValue({
					results: [{ model: "model1", review: "Good" }],
					models: ["model1"],
					reviewType: "accessibility",
				}),
			};

			createReviewTool(mockServer as any, config);

			const response = await registeredHandler({ code: "test" });

			expect(response.content[0]?.text).toContain("accessibility");
		});

		it("should format error results", async () => {
			const config = {
				name: "test_review",
				description: "Test review",
				inputSchema: { code: z.string() },
				handler: vi.fn().mockResolvedValue({
					results: [
						{ model: "model1", review: "Good", error: undefined },
						{ model: "model2", review: "", error: "API Error" },
					],
					models: ["model1", "model2"],
				}),
			};

			createReviewTool(mockServer as any, config);

			const response = await registeredHandler({ code: "test" });

			expect(response.content[0]?.text).toContain("Review from `model1`");
			expect(response.content[0]?.text).toContain("Good");
			expect(response.content[0]?.text).toContain("Review from `model2`");
			expect(response.content[0]?.text).toContain("**Error:** API Error");
		});

		it("should handle handler errors", async () => {
			const config = {
				name: "test_review",
				description: "Test review",
				inputSchema: { code: z.string() },
				handler: vi.fn().mockRejectedValue(new Error("Handler failed")),
			};

			createReviewTool(mockServer as any, config);

			const response = await registeredHandler({ code: "test" });

			expect(response.isError).toBe(true);
			expect(response.content[0]?.text).toContain("Handler failed");
		});

		it("should handle non-Error exceptions", async () => {
			const config = {
				name: "test_review",
				description: "Test review",
				inputSchema: { code: z.string() },
				handler: vi.fn().mockRejectedValue("String error"),
			};

			createReviewTool(mockServer as any, config);

			const response = await registeredHandler({ code: "test" });

			expect(response.isError).toBe(true);
		});

		it("should call handler with input", async () => {
			const handler = vi.fn().mockResolvedValue({
				results: [],
				models: [],
			});

			const config = {
				name: "test_review",
				description: "Test review",
				inputSchema: { code: z.string() },
				handler,
			};

			createReviewTool(mockServer as any, config);

			await registeredHandler({ code: "const x = 1;" });

			expect(handler).toHaveBeenCalledWith({ code: "const x = 1;" });
		});
	});
});
