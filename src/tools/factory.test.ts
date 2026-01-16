import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
	createReviewTool,
	escapeHtml,
	formatResultsAsHtml,
	getTemplatesDir,
} from "./factory.js";

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

		it("should format successful results with host extraction format", async () => {
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
			// Now uses host extraction format
			expect(response.content[0]?.text).toContain(
				"# Multi-Model Code Review Results",
			);
			expect(response.content[0]?.text).toContain("2 models participated");
			expect(response.content[0]?.text).toContain("Review from `model1`");
			expect(response.content[0]?.text).toContain("Good code");
			expect(response.content[0]?.text).toContain("Review from `model2`");
			expect(response.content[0]?.text).toContain("Looks fine");
		});

		it("should format results with host extraction (reviewType ignored in new format)", async () => {
			const config = {
				name: "review_frontend",
				description: "Frontend review",
				inputSchema: { code: z.string() },
				handler: vi.fn().mockResolvedValue({
					results: [{ model: "model1", review: "Good accessibility" }],
					models: ["model1"],
					reviewType: "accessibility", // Note: reviewType is no longer used in the title
				}),
			};

			createReviewTool(mockServer as any, config);

			const response = await registeredHandler({ code: "test" });

			// Host extraction format includes the review content
			expect(response.content[0]?.text).toContain("Review from `model1`");
			expect(response.content[0]?.text).toContain("Good accessibility");
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

	describe("escapeHtml", () => {
		it("should escape ampersands", () => {
			expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
		});

		it("should escape less than signs", () => {
			expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
		});

		it("should escape greater than signs", () => {
			expect(escapeHtml("a > b")).toBe("a &gt; b");
		});

		it("should escape double quotes", () => {
			expect(escapeHtml('attr="value"')).toBe("attr=&quot;value&quot;");
		});

		it("should escape single quotes", () => {
			expect(escapeHtml("it's")).toBe("it&#039;s");
		});

		it("should escape all special characters together", () => {
			const input = "<script>alert(\"XSS & 'attack'\")</script>";
			const expected =
				"&lt;script&gt;alert(&quot;XSS &amp; &#039;attack&#039;&quot;)&lt;/script&gt;";
			expect(escapeHtml(input)).toBe(expected);
		});

		it("should handle empty strings", () => {
			expect(escapeHtml("")).toBe("");
		});

		it("should handle strings without special characters", () => {
			expect(escapeHtml("hello world")).toBe("hello world");
		});
	});

	describe("formatResultsAsHtml", () => {
		it("should read template and inject data", () => {
			const results = [
				{ model: "model1", review: "Good code" },
				{ model: "model2", review: "Needs work" },
			];

			// Use actual template path
			const templatePath = getTemplatesDir() + "/tps-report.html";
			const html = formatResultsAsHtml(results, templatePath, {
				repoName: "test-repo",
				analysis: { scores: { overall: 75 } },
			});

			// Should contain the data
			expect(html).toContain("test-repo");
			expect(html).toContain("model1");
			expect(html).toContain("model2");
		});

		it("should handle missing template by falling back to markdown", () => {
			const results = [{ model: "model1", review: "Review content" }];

			// Use non-existent template
			const html = formatResultsAsHtml(results, "/nonexistent/template.html", {
				repoName: "test",
			});

			// Should fall back to markdown format
			expect(html).toContain("## Review from `model1`");
			expect(html).toContain("Review content");
		});

		it("should handle error results", () => {
			const results = [{ model: "model1", review: "", error: "API Error" }];

			const html = formatResultsAsHtml(results, "/nonexistent/template.html");

			// Fallback markdown should show error
			expect(html).toContain("**Error:** API Error");
		});

		it("should use default repo name when not provided", () => {
			const results = [{ model: "model1", review: "Test" }];

			const templatePath = getTemplatesDir() + "/tps-report.html";
			const html = formatResultsAsHtml(results, templatePath);

			expect(html).toContain("Unknown Repository");
		});
	});

	describe("getTemplatesDir", () => {
		it("should return a path ending with templates", () => {
			const dir = getTemplatesDir();

			expect(dir).toContain("templates");
		});

		it("should return a consistent path", () => {
			const dir1 = getTemplatesDir();
			const dir2 = getTemplatesDir();

			expect(dir1).toBe(dir2);
		});
	});
});
