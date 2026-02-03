import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InMemorySessionStore } from "./in-memory-store";
import { toSessionId } from "./types";

describe("InMemorySessionStore", () => {
	let store: InMemorySessionStore;

	beforeEach(() => {
		store = new InMemorySessionStore({
			ttlMs: 1000, // 1 second for testing
			maxSessions: 3,
			maxMessagesPerModel: 5,
			rateLimitPerMinute: 3,
			cleanupIntervalMs: 100000, // Long interval to prevent auto-cleanup
		});
	});

	afterEach(() => {
		store.shutdown();
	});

	describe("createSession", () => {
		it("should create a new session with correct structure", () => {
			const session = store.createSession({
				topic: "Test topic",
				discussionType: "code_review",
				models: ["model1", "model2"],
				systemPrompt: "You are a helpful assistant",
				initialUserMessage: "Hello, world!",
			});

			expect(session.id).toBeDefined();
			expect(session.topic).toBe("Test topic");
			expect(session.discussionType).toBe("code_review");
			expect(session.models).toEqual(["model1", "model2"]);
			expect(session.modelConversations.model1).toBeDefined();
			expect(session.modelConversations.model2).toBeDefined();
			expect(session.modelConversations.model1?.messages).toHaveLength(2);
			expect(session.modelConversations.model1?.messages[0]?.role).toBe(
				"system",
			);
			expect(session.modelConversations.model1?.messages[1]?.role).toBe("user");
		});

		it("should evict oldest session when at capacity", () => {
			// Create 3 sessions (max capacity)
			const session1 = store.createSession({
				topic: "Topic 1",
				discussionType: "general",
				models: ["model1"],
				systemPrompt: "System",
				initialUserMessage: "Message 1",
			});

			const session2 = store.createSession({
				topic: "Topic 2",
				discussionType: "general",
				models: ["model1"],
				systemPrompt: "System",
				initialUserMessage: "Message 2",
			});

			const session3 = store.createSession({
				topic: "Topic 3",
				discussionType: "general",
				models: ["model1"],
				systemPrompt: "System",
				initialUserMessage: "Message 3",
			});

			expect(store.getSessionCount()).toBe(3);

			// Create 4th session - should evict oldest
			const session4 = store.createSession({
				topic: "Topic 4",
				discussionType: "general",
				models: ["model1"],
				systemPrompt: "System",
				initialUserMessage: "Message 4",
			});

			expect(store.getSessionCount()).toBe(3);
			expect(store.getSession(session1.id)).toBeUndefined();
			expect(store.getSession(session2.id)).toBeDefined();
			expect(store.getSession(session3.id)).toBeDefined();
			expect(store.getSession(session4.id)).toBeDefined();
		});
	});

	describe("getSession", () => {
		it("should return undefined for non-existent session", () => {
			const result = store.getSession(toSessionId("non-existent-id"));
			expect(result).toBeUndefined();
		});

		it("should update lastActiveAt on access (sliding TTL)", async () => {
			const session = store.createSession({
				topic: "Test",
				discussionType: "general",
				models: ["model1"],
				systemPrompt: "System",
				initialUserMessage: "Hello",
			});

			const originalLastActiveAt = session.lastActiveAt;

			// Wait a bit to allow time to pass
			await new Promise((r) => setTimeout(r, 5));

			const retrieved = store.getSession(session.id);
			expect(retrieved?.lastActiveAt).toBeGreaterThanOrEqual(
				originalLastActiveAt,
			);
		});
	});

	describe("addUserMessage", () => {
		it("should add user message to all model conversations", () => {
			const session = store.createSession({
				topic: "Test",
				discussionType: "general",
				models: ["model1", "model2"],
				systemPrompt: "System",
				initialUserMessage: "Hello",
			});

			const result = store.addUserMessage(session.id, "Follow-up question");
			expect(result).toBe(true);

			const messages1 = store.getModelMessages(session.id, "model1");
			const messages2 = store.getModelMessages(session.id, "model2");

			expect(messages1).toHaveLength(3);
			expect(messages2).toHaveLength(3);
			expect(messages1?.[2]?.content).toBe("Follow-up question");
			expect(messages2?.[2]?.content).toBe("Follow-up question");
		});

		it("should return false for non-existent session", () => {
			const result = store.addUserMessage(
				toSessionId("non-existent"),
				"Message",
			);
			expect(result).toBe(false);
		});

		it("should enforce max messages limit with context windowing", () => {
			const session = store.createSession({
				topic: "Test",
				discussionType: "general",
				models: ["model1"],
				systemPrompt: "System prompt",
				initialUserMessage: "Initial message",
			});

			// Add messages to reach limit
			for (let i = 0; i < 10; i++) {
				store.addUserMessage(session.id, `User message ${i}`);
				store.addAssistantMessage(session.id, "model1", `Response ${i}`);
			}

			const messages = store.getModelMessages(session.id, "model1");

			// Context windowing happens on addUserMessage, but addAssistantMessage
			// can push one beyond the limit. After truncation + user + assistant = maxMessages + 1
			expect(messages?.length).toBeLessThanOrEqual(6);
			// System message should be preserved
			expect(messages?.[0]?.role).toBe("system");
			expect(messages?.[0]?.content).toBe("System prompt");
		});
	});

	describe("addAssistantMessage", () => {
		it("should add assistant message to specific model", () => {
			const session = store.createSession({
				topic: "Test",
				discussionType: "general",
				models: ["model1", "model2"],
				systemPrompt: "System",
				initialUserMessage: "Hello",
			});

			const result = store.addAssistantMessage(
				session.id,
				"model1",
				"Response from model1",
			);
			expect(result).toBe(true);

			const messages1 = store.getModelMessages(session.id, "model1");
			const messages2 = store.getModelMessages(session.id, "model2");

			expect(messages1).toHaveLength(3);
			expect(messages2).toHaveLength(2);
			expect(messages1?.[2]?.content).toBe("Response from model1");
		});

		it("should return false for non-existent model", () => {
			const session = store.createSession({
				topic: "Test",
				discussionType: "general",
				models: ["model1"],
				systemPrompt: "System",
				initialUserMessage: "Hello",
			});

			const result = store.addAssistantMessage(
				session.id,
				"non-existent-model",
				"Response",
			);
			expect(result).toBe(false);
		});
	});

	describe("deleteSession", () => {
		it("should delete existing session", () => {
			const session = store.createSession({
				topic: "Test",
				discussionType: "general",
				models: ["model1"],
				systemPrompt: "System",
				initialUserMessage: "Hello",
			});

			expect(store.getSessionCount()).toBe(1);

			const result = store.deleteSession(session.id);
			expect(result).toBe(true);
			expect(store.getSessionCount()).toBe(0);
			expect(store.getSession(session.id)).toBeUndefined();
		});

		it("should return false for non-existent session", () => {
			const result = store.deleteSession(toSessionId("non-existent"));
			expect(result).toBe(false);
		});
	});

	describe("checkRateLimit", () => {
		it("should allow requests within limit", () => {
			const session = store.createSession({
				topic: "Test",
				discussionType: "general",
				models: ["model1"],
				systemPrompt: "System",
				initialUserMessage: "Hello",
			});

			// First request (creation counted as 1)
			const result1 = store.checkRateLimit(session.id);
			expect(result1.allowed).toBe(true);
			expect(result1.remainingRequests).toBe(1);

			const result2 = store.checkRateLimit(session.id);
			expect(result2.allowed).toBe(true);
			expect(result2.remainingRequests).toBe(0);
		});

		it("should deny requests over limit", () => {
			const session = store.createSession({
				topic: "Test",
				discussionType: "general",
				models: ["model1"],
				systemPrompt: "System",
				initialUserMessage: "Hello",
			});

			// Exhaust rate limit (limit is 3, creation counts as 1)
			store.checkRateLimit(session.id);
			store.checkRateLimit(session.id);

			const result = store.checkRateLimit(session.id);
			expect(result.allowed).toBe(false);
			expect(result.remainingRequests).toBe(0);
		});

		it("should return not allowed for non-existent session", () => {
			const result = store.checkRateLimit(toSessionId("non-existent"));
			expect(result.allowed).toBe(false);
		});
	});

	describe("shutdown", () => {
		it("should clear all sessions", () => {
			store.createSession({
				topic: "Test 1",
				discussionType: "general",
				models: ["model1"],
				systemPrompt: "System",
				initialUserMessage: "Hello",
			});

			store.createSession({
				topic: "Test 2",
				discussionType: "general",
				models: ["model1"],
				systemPrompt: "System",
				initialUserMessage: "Hello",
			});

			expect(store.getSessionCount()).toBe(2);

			store.shutdown();

			expect(store.getSessionCount()).toBe(0);
		});
	});

	describe("session expiration", () => {
		it("should expire sessions after TTL", async () => {
			// Create store with very short TTL
			const shortTtlStore = new InMemorySessionStore({
				ttlMs: 50,
				cleanupIntervalMs: 25,
			});

			const session = shortTtlStore.createSession({
				topic: "Test",
				discussionType: "general",
				models: ["model1"],
				systemPrompt: "System",
				initialUserMessage: "Hello",
			});

			expect(shortTtlStore.getSession(session.id)).toBeDefined();

			// Wait for TTL + cleanup interval
			await new Promise((r) => setTimeout(r, 100));

			expect(shortTtlStore.getSession(session.id)).toBeUndefined();

			shortTtlStore.shutdown();
		});
	});
});
