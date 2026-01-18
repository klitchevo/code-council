/**
 * Tests for conversation-factory
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { ModelReviewResult } from "../review-client";
import type { ISessionStore } from "../session/session-store";
import type { SessionId } from "../session/types";
import {
	type ConversationResult,
	createConversationTool,
} from "./conversation-factory";

// Mock logger
vi.mock("../logger.js", () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

// Mock errors
vi.mock("../errors.js", () => ({
	formatError: vi.fn((error: unknown) => ({
		content: [
			{
				type: "text" as const,
				text: `Error: ${error instanceof Error ? error.message : String(error)}`,
			},
		],
		isError: true,
	})),
}));

interface MockServer {
	registerTool: ReturnType<typeof vi.fn>;
}

const createMockSessionStore = (): ISessionStore => ({
	createSession: vi.fn(),
	getSession: vi.fn(),
	addUserMessage: vi.fn(),
	addAssistantMessage: vi.fn(),
	getModelMessages: vi.fn(),
	deleteSession: vi.fn(),
	getSessionCount: vi.fn(),
	checkRateLimit: vi.fn(),
	shutdown: vi.fn(),
});

describe("conversation-factory", () => {
	let mockServer: MockServer;
	let mockSessionStore: ISessionStore;
	let registeredHandler: (input: Record<string, unknown>) => Promise<{
		content: Array<{ type: "text"; text: string }>;
		isError?: boolean;
	}>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockServer = {
			registerTool: vi.fn((_name, _schema, handler) => {
				registeredHandler = handler;
			}),
		};
		mockSessionStore = createMockSessionStore();
	});

	describe("createConversationTool", () => {
		it("registers a tool with the server", () => {
			const config = {
				name: "test_conversation",
				description: "Test conversation tool",
				inputSchema: {
					topic: z.string(),
				},
				handler: vi.fn().mockResolvedValue({
					results: [],
					models: [],
					sessionId: "session-123" as SessionId,
					isNewSession: true,
					topic: "test topic",
				}),
			};

			createConversationTool(mockServer as any, config, mockSessionStore);

			expect(mockServer.registerTool).toHaveBeenCalledTimes(1);
			const call = mockServer.registerTool.mock.calls[0];
			expect(call?.[0]).toBe("test_conversation");
			expect(call?.[1].description).toBe("Test conversation tool");
			expect(typeof call?.[2]).toBe("function");
		});

		it("formats new session results correctly", async () => {
			const results: ModelReviewResult[] = [
				{ model: "anthropic/claude-3-sonnet", review: "Good discussion point" },
				{ model: "openai/gpt-4", review: "I agree and add..." },
			];

			const config = {
				name: "council_discuss",
				description: "Council discussion",
				inputSchema: { topic: z.string() },
				handler: vi.fn().mockResolvedValue({
					results,
					models: ["anthropic/claude-3-sonnet", "openai/gpt-4"],
					sessionId: "session-abc" as SessionId,
					isNewSession: true,
					topic: "Test Topic",
				} satisfies ConversationResult),
			};

			createConversationTool(mockServer as any, config, mockSessionStore);

			const response = await registeredHandler({ topic: "test" });

			expect(response.content[0]?.type).toBe("text");
			const text = response.content[0]?.text ?? "";

			// Check new session header
			expect(text).toContain("# Council Discussion Started");
			expect(text).toContain("**Topic:** Test Topic");
			expect(text).toContain("**Session ID:** `session-abc`");
			expect(text).toContain(
				"_Use this session_id in subsequent calls to continue the discussion._",
			);

			// Check model responses
			expect(text).toContain("## claude-3-sonnet");
			expect(text).toContain("Good discussion point");
			expect(text).toContain("## gpt-4");
			expect(text).toContain("I agree and add...");

			// Check footer
			expect(text).toContain("_(include in your next message to continue)_");
		});

		it("formats continued session results correctly", async () => {
			const results: ModelReviewResult[] = [
				{ model: "anthropic/claude-3-sonnet", review: "Continuing..." },
			];

			const config = {
				name: "council_discuss",
				description: "Council discussion",
				inputSchema: { topic: z.string() },
				handler: vi.fn().mockResolvedValue({
					results,
					models: ["anthropic/claude-3-sonnet"],
					sessionId: "session-existing" as SessionId,
					isNewSession: false,
					topic: "Original Topic",
				} satisfies ConversationResult),
			};

			createConversationTool(mockServer as any, config, mockSessionStore);

			const response = await registeredHandler({ topic: "followup" });

			const text = response.content[0]?.text ?? "";

			// Check continued session header
			expect(text).toContain("# Council Discussion Continued");
			expect(text).toContain("**Session ID:** `session-existing`");
			expect(text).not.toContain("Council Discussion Started");
		});

		it("formats error results from models", async () => {
			const results: ModelReviewResult[] = [
				{ model: "anthropic/claude-3-sonnet", review: "Success response" },
				{ model: "openai/gpt-4", review: "", error: "API rate limit exceeded" },
			];

			const config = {
				name: "council_discuss",
				description: "Council discussion",
				inputSchema: { topic: z.string() },
				handler: vi.fn().mockResolvedValue({
					results,
					models: ["anthropic/claude-3-sonnet", "openai/gpt-4"],
					sessionId: "session-123" as SessionId,
					isNewSession: true,
					topic: "Test",
				} satisfies ConversationResult),
			};

			createConversationTool(mockServer as any, config, mockSessionStore);

			const response = await registeredHandler({ topic: "test" });

			const text = response.content[0]?.text ?? "";

			expect(text).toContain("Success response");
			expect(text).toContain("**Error:** API rate limit exceeded");
		});

		it("handles handler errors", async () => {
			const config = {
				name: "council_discuss",
				description: "Council discussion",
				inputSchema: { topic: z.string() },
				handler: vi.fn().mockRejectedValue(new Error("Handler failed")),
			};

			createConversationTool(mockServer as any, config, mockSessionStore);

			const response = await registeredHandler({ topic: "test" });

			expect(response.isError).toBe(true);
			expect(response.content[0]?.text).toContain("Handler failed");
		});

		it("handles non-Error exceptions", async () => {
			const config = {
				name: "council_discuss",
				description: "Council discussion",
				inputSchema: { topic: z.string() },
				handler: vi.fn().mockRejectedValue("string error"),
			};

			createConversationTool(mockServer as any, config, mockSessionStore);

			const response = await registeredHandler({ topic: "test" });

			expect(response.isError).toBe(true);
		});

		it("passes sessionStore to handler", async () => {
			const handler = vi.fn().mockResolvedValue({
				results: [],
				models: [],
				sessionId: "session-123" as SessionId,
				isNewSession: true,
				topic: "test",
			});

			const config = {
				name: "council_discuss",
				description: "Council discussion",
				inputSchema: { topic: z.string() },
				handler,
			};

			createConversationTool(mockServer as any, config, mockSessionStore);

			await registeredHandler({ topic: "test" });

			expect(handler).toHaveBeenCalledWith({ topic: "test" }, mockSessionStore);
		});

		it("extracts model name from full path", async () => {
			const results: ModelReviewResult[] = [
				{
					model: "anthropic/claude-3-sonnet-20240229",
					review: "Response",
				},
			];

			const config = {
				name: "council_discuss",
				description: "Council discussion",
				inputSchema: { topic: z.string() },
				handler: vi.fn().mockResolvedValue({
					results,
					models: ["anthropic/claude-3-sonnet-20240229"],
					sessionId: "session-123" as SessionId,
					isNewSession: true,
					topic: "Test",
				}),
			};

			createConversationTool(mockServer as any, config, mockSessionStore);

			const response = await registeredHandler({ topic: "test" });

			const text = response.content[0]?.text ?? "";
			// Should extract just the model name after the slash
			expect(text).toContain("## claude-3-sonnet-20240229");
			expect(text).not.toContain("## anthropic/claude-3-sonnet-20240229");
		});

		it("handles model without slash in name", async () => {
			const results: ModelReviewResult[] = [
				{ model: "local-model", review: "Response" },
			];

			const config = {
				name: "council_discuss",
				description: "Council discussion",
				inputSchema: { topic: z.string() },
				handler: vi.fn().mockResolvedValue({
					results,
					models: ["local-model"],
					sessionId: "session-123" as SessionId,
					isNewSession: true,
					topic: "Test",
				}),
			};

			createConversationTool(mockServer as any, config, mockSessionStore);

			const response = await registeredHandler({ topic: "test" });

			const text = response.content[0]?.text ?? "";
			expect(text).toContain("## local-model");
		});

		it("includes separators between model responses", async () => {
			const results: ModelReviewResult[] = [
				{ model: "model-1", review: "Response 1" },
				{ model: "model-2", review: "Response 2" },
				{ model: "model-3", review: "Response 3" },
			];

			const config = {
				name: "council_discuss",
				description: "Council discussion",
				inputSchema: { topic: z.string() },
				handler: vi.fn().mockResolvedValue({
					results,
					models: ["model-1", "model-2", "model-3"],
					sessionId: "session-123" as SessionId,
					isNewSession: true,
					topic: "Test",
				}),
			};

			createConversationTool(mockServer as any, config, mockSessionStore);

			const response = await registeredHandler({ topic: "test" });

			const text = response.content[0]?.text ?? "";
			// Check for separators between responses
			expect(text.match(/---/g)?.length).toBeGreaterThanOrEqual(3);
		});

		it("logs debug info on start", async () => {
			const { logger } = await import("../logger.js");

			const config = {
				name: "council_discuss",
				description: "Council discussion",
				inputSchema: { topic: z.string(), context: z.string().optional() },
				handler: vi.fn().mockResolvedValue({
					results: [],
					models: [],
					sessionId: "session-123" as SessionId,
					isNewSession: true,
					topic: "Test",
				}),
			};

			createConversationTool(mockServer as any, config, mockSessionStore);

			await registeredHandler({ topic: "test", context: "some context" });

			expect(logger.debug).toHaveBeenCalledWith("Starting council_discuss", {
				inputKeys: ["topic", "context"],
			});
		});

		it("logs info on completion", async () => {
			const { logger } = await import("../logger.js");

			const results: ModelReviewResult[] = [
				{ model: "model-1", review: "Success" },
				{ model: "model-2", review: "", error: "Failed" },
			];

			const config = {
				name: "council_discuss",
				description: "Council discussion",
				inputSchema: { topic: z.string() },
				handler: vi.fn().mockResolvedValue({
					results,
					models: ["model-1", "model-2"],
					sessionId: "session-123" as SessionId,
					isNewSession: true,
					topic: "Test",
				}),
			};

			createConversationTool(mockServer as any, config, mockSessionStore);

			await registeredHandler({ topic: "test" });

			expect(logger.info).toHaveBeenCalledWith("Completed council_discuss", {
				sessionId: "session-123",
				isNewSession: true,
				modelCount: 2,
				successCount: 1,
				errorCount: 1,
			});
		});

		it("logs error on failure", async () => {
			const { logger } = await import("../logger.js");

			const config = {
				name: "council_discuss",
				description: "Council discussion",
				inputSchema: { topic: z.string() },
				handler: vi.fn().mockRejectedValue(new Error("Handler failed")),
			};

			createConversationTool(mockServer as any, config, mockSessionStore);

			await registeredHandler({ topic: "test" });

			expect(logger.error).toHaveBeenCalled();
		});
	});
});
