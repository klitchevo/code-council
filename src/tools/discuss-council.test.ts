import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "../errors.js";
import type { ReviewClient } from "../review-client.js";
import { InMemorySessionStore } from "../session/in-memory-store.js";
import type { ISessionStore } from "../session/session-store.js";
import {
	discussCouncilSchema,
	handleDiscussCouncil,
} from "./discuss-council.js";

vi.mock("../logger", () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("../config", () => ({
	DISCUSSION_MODELS: ["model1", "model2"],
}));

describe("discuss-council tool", () => {
	let mockClient: Pick<ReviewClient, "discussWithCouncil"> &
		Partial<ReviewClient>;
	let sessionStore: ISessionStore;

	beforeEach(() => {
		vi.clearAllMocks();
		sessionStore = new InMemorySessionStore({
			ttlMs: 60000,
			maxSessions: 10,
			rateLimitPerMinute: 10,
			cleanupIntervalMs: 100000,
		});
		mockClient = {
			discussWithCouncil: vi.fn().mockResolvedValue([
				{ model: "model1", review: "Response from model1" },
				{ model: "model2", review: "Response from model2" },
			]),
		} as Pick<ReviewClient, "discussWithCouncil"> & Partial<ReviewClient>;
	});

	afterEach(() => {
		sessionStore.shutdown();
	});

	describe("discussCouncilSchema", () => {
		it("should have required message field", () => {
			expect(discussCouncilSchema.message).toBeDefined();
		});

		it("should have optional session_id field", () => {
			expect(discussCouncilSchema.session_id).toBeDefined();
		});

		it("should have optional discussion_type field", () => {
			expect(discussCouncilSchema.discussion_type).toBeDefined();
		});

		it("should have optional context field", () => {
			expect(discussCouncilSchema.context).toBeDefined();
		});
	});

	describe("handleDiscussCouncil", () => {
		describe("new session", () => {
			it("should create new session with minimal input", async () => {
				const result = await handleDiscussCouncil(
					mockClient as ReviewClient,
					{
						message: "Hello, council!",
					},
					sessionStore,
				);

				expect(result.isNewSession).toBe(true);
				expect(result.sessionId).toBeDefined();
				expect(result.results).toHaveLength(2);
				expect(result.models).toEqual(["model1", "model2"]);
				expect(result.topic).toBe("Hello, council!");
			});

			it("should use provided discussion_type", async () => {
				const result = await handleDiscussCouncil(
					mockClient as ReviewClient,
					{
						message: "Review this code",
						discussion_type: "code_review",
					},
					sessionStore,
				);

				expect(result.isNewSession).toBe(true);
				const session = sessionStore.getSession(result.sessionId);
				expect(session?.discussionType).toBe("code_review");
			});

			it("should default to general discussion type", async () => {
				const result = await handleDiscussCouncil(
					mockClient as ReviewClient,
					{
						message: "General question",
					},
					sessionStore,
				);

				const session = sessionStore.getSession(result.sessionId);
				expect(session?.discussionType).toBe("general");
			});

			it("should include context in initial message", async () => {
				await handleDiscussCouncil(
					mockClient as ReviewClient,
					{
						message: "Review this",
						context: "```code here```",
					},
					sessionStore,
				);

				expect(mockClient.discussWithCouncil).toHaveBeenCalled();
			});

			it("should truncate long topics", async () => {
				const longMessage = "x".repeat(200);
				const result = await handleDiscussCouncil(
					mockClient as ReviewClient,
					{
						message: longMessage,
					},
					sessionStore,
				);

				expect(result.topic.length).toBeLessThanOrEqual(100);
				expect(result.topic.endsWith("...")).toBe(true);
			});
		});

		describe("continue session", () => {
			it("should continue existing session", async () => {
				// Start a new session
				const firstResult = await handleDiscussCouncil(
					mockClient as ReviewClient,
					{
						message: "First message",
					},
					sessionStore,
				);

				expect(firstResult.isNewSession).toBe(true);

				// Continue the session
				const secondResult = await handleDiscussCouncil(
					mockClient as ReviewClient,
					{
						message: "Follow-up question",
						session_id: firstResult.sessionId,
					},
					sessionStore,
				);

				expect(secondResult.isNewSession).toBe(false);
				expect(secondResult.sessionId).toBe(firstResult.sessionId);
			});

			it("should throw error for non-existent session", async () => {
				await expect(
					handleDiscussCouncil(
						mockClient as ReviewClient,
						{
							message: "Follow-up",
							session_id: "00000000-0000-0000-0000-000000000000",
						},
						sessionStore,
					),
				).rejects.toThrow(ValidationError);
			});

			it("should store assistant responses in session", async () => {
				const result = await handleDiscussCouncil(
					mockClient as ReviewClient,
					{
						message: "First message",
					},
					sessionStore,
				);

				const messages = sessionStore.getModelMessages(
					result.sessionId,
					"model1",
				);

				// Should have: system, user, assistant
				expect(messages?.length).toBeGreaterThanOrEqual(3);
				expect(messages?.some((m) => m.role === "assistant")).toBe(true);
			});
		});

		describe("rate limiting", () => {
			it("should enforce rate limiting on continued sessions", async () => {
				// Create store with very low rate limit
				const limitedStore = new InMemorySessionStore({
					ttlMs: 60000,
					rateLimitPerMinute: 2,
					cleanupIntervalMs: 100000,
				});

				// First message (creates session, counts as 1)
				const result = await handleDiscussCouncil(
					mockClient as ReviewClient,
					{
						message: "First",
					},
					limitedStore,
				);

				// Second message (should work)
				await handleDiscussCouncil(
					mockClient as ReviewClient,
					{
						message: "Second",
						session_id: result.sessionId,
					},
					limitedStore,
				);

				// Third message should be rate limited
				await expect(
					handleDiscussCouncil(
						mockClient as ReviewClient,
						{
							message: "Third",
							session_id: result.sessionId,
						},
						limitedStore,
					),
				).rejects.toThrow(/rate limit/i);

				limitedStore.shutdown();
			});
		});

		describe("error handling", () => {
			it("should handle model errors gracefully", async () => {
				mockClient.discussWithCouncil = vi.fn().mockResolvedValue([
					{ model: "model1", review: "Success" },
					{ model: "model2", review: "", error: "Model failed" },
				]);

				const result = await handleDiscussCouncil(
					mockClient as ReviewClient,
					{
						message: "Test",
					},
					sessionStore,
				);

				expect(result.results).toHaveLength(2);
				expect(result.results[0]!.review).toBe("Success");
				expect(result.results[1]!.error).toBe("Model failed");
			});
		});
	});
});
