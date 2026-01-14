/**
 * In-memory implementation of ISessionStore.
 * Provides session management with TTL, rate limiting, and automatic cleanup.
 */

import { randomUUID } from "node:crypto";
import { SESSION_LIMITS } from "../constants.js";
import { logger } from "../logger.js";
import type {
	CreateSessionOptions,
	ISessionStore,
	RateLimitResult,
} from "./session-store.js";
import type {
	ConversationMessage,
	DiscussionSession,
	ModelConversation,
	RateLimitState,
	SessionId,
} from "./types.js";
import { toSessionId } from "./types.js";

/**
 * In-memory session store with TTL-based expiration and rate limiting
 */
export class InMemorySessionStore implements ISessionStore {
	private sessions: Record<string, DiscussionSession> = {};
	private rateLimits: Record<string, RateLimitState> = {};
	private cleanupInterval: NodeJS.Timeout | null = null;
	private readonly ttlMs: number;
	private readonly maxSessions: number;
	private readonly maxMessagesPerModel: number;
	private readonly rateLimitPerMinute: number;

	constructor(options?: {
		ttlMs?: number;
		maxSessions?: number;
		maxMessagesPerModel?: number;
		rateLimitPerMinute?: number;
		cleanupIntervalMs?: number;
	}) {
		this.ttlMs = options?.ttlMs ?? SESSION_LIMITS.TTL_MS;
		this.maxSessions = options?.maxSessions ?? SESSION_LIMITS.MAX_SESSIONS;
		this.maxMessagesPerModel =
			options?.maxMessagesPerModel ?? SESSION_LIMITS.MAX_MESSAGES_PER_MODEL;
		this.rateLimitPerMinute =
			options?.rateLimitPerMinute ?? SESSION_LIMITS.RATE_LIMIT_PER_MINUTE;

		const cleanupIntervalMs =
			options?.cleanupIntervalMs ?? SESSION_LIMITS.CLEANUP_INTERVAL_MS;
		this.startCleanupTimer(cleanupIntervalMs);
	}

	createSession(options: CreateSessionOptions): DiscussionSession {
		// Enforce max sessions limit
		const sessionCount = Object.keys(this.sessions).length;
		if (sessionCount >= this.maxSessions) {
			this.evictOldestSession();
		}

		const sessionId = toSessionId(randomUUID());
		const now = Date.now();

		// Initialize per-model conversations
		const modelConversations: Record<string, ModelConversation> = {};
		for (const model of options.models) {
			modelConversations[model] = {
				model,
				messages: [
					{ role: "system", content: options.systemPrompt, timestamp: now },
					{
						role: "user",
						content: options.initialUserMessage,
						timestamp: now,
					},
				],
				lastActive: now,
			};
		}

		const session: DiscussionSession = {
			id: sessionId,
			topic: options.topic,
			discussionType: options.discussionType,
			modelConversations,
			createdAt: now,
			lastActiveAt: now,
			models: [...options.models],
		};

		this.sessions[sessionId] = session;

		// Initialize rate limit state
		this.rateLimits[sessionId] = {
			sessionId,
			requestCount: 1, // Count the initial creation
			windowStart: now,
		};

		logger.info("Created discussion session", {
			sessionId,
			topic: options.topic,
			discussionType: options.discussionType,
			modelCount: options.models.length,
		});

		return session;
	}

	getSession(id: SessionId): DiscussionSession | undefined {
		const session = this.sessions[id];
		if (session) {
			// Update lastActiveAt for sliding TTL
			session.lastActiveAt = Date.now();
		}
		return session;
	}

	addUserMessage(id: SessionId, message: string): boolean {
		const session = this.sessions[id];
		if (!session) {
			return false;
		}

		const now = Date.now();
		session.lastActiveAt = now;

		for (const model of session.models) {
			const conversation = session.modelConversations[model];
			if (conversation) {
				// Enforce max messages limit (context windowing)
				if (conversation.messages.length >= this.maxMessagesPerModel) {
					const systemMsg = conversation.messages[0];
					if (systemMsg) {
						// Keep system message + most recent messages
						conversation.messages = [
							systemMsg,
							...conversation.messages.slice(-(this.maxMessagesPerModel - 2)),
						];
					}
				}

				conversation.messages.push({
					role: "user",
					content: message,
					timestamp: now,
				});
				conversation.lastActive = now;
			}
		}

		return true;
	}

	addAssistantMessage(id: SessionId, model: string, response: string): boolean {
		const session = this.sessions[id];
		if (!session) {
			return false;
		}

		const conversation = session.modelConversations[model];
		if (!conversation) {
			return false;
		}

		const now = Date.now();
		conversation.messages.push({
			role: "assistant",
			content: response,
			timestamp: now,
		});
		conversation.lastActive = now;
		session.lastActiveAt = now;

		return true;
	}

	getModelMessages(
		id: SessionId,
		model: string,
	): ConversationMessage[] | undefined {
		const session = this.sessions[id];
		if (!session) {
			return undefined;
		}

		// Update lastActiveAt for sliding TTL
		session.lastActiveAt = Date.now();

		return session.modelConversations[model]?.messages;
	}

	deleteSession(id: SessionId): boolean {
		const existed = id in this.sessions;
		if (existed) {
			delete this.sessions[id];
			delete this.rateLimits[id];
			logger.debug("Deleted session", { sessionId: id });
		}
		return existed;
	}

	getSessionCount(): number {
		return Object.keys(this.sessions).length;
	}

	checkRateLimit(id: SessionId): RateLimitResult {
		const now = Date.now();
		const windowMs = 60 * 1000; // 1 minute window

		const state = this.rateLimits[id];
		if (!state) {
			// Session doesn't exist or rate limit not initialized
			return {
				allowed: false,
				remainingRequests: 0,
				resetInMs: 0,
			};
		}

		// Check if we're in a new window
		if (now - state.windowStart >= windowMs) {
			// Reset the window
			state.requestCount = 0;
			state.windowStart = now;
		}

		const remaining = this.rateLimitPerMinute - state.requestCount;
		const resetInMs = windowMs - (now - state.windowStart);

		if (state.requestCount >= this.rateLimitPerMinute) {
			return {
				allowed: false,
				remainingRequests: 0,
				resetInMs,
			};
		}

		// Increment the counter
		state.requestCount++;

		return {
			allowed: true,
			remainingRequests: remaining - 1,
			resetInMs,
		};
	}

	shutdown(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}

		const sessionCount = Object.keys(this.sessions).length;
		this.sessions = {};
		this.rateLimits = {};

		logger.info("Session store shutdown", { clearedSessions: sessionCount });
	}

	/**
	 * Start the periodic cleanup timer
	 */
	private startCleanupTimer(intervalMs: number): void {
		this.cleanupInterval = setInterval(() => {
			this.cleanupExpiredSessions();
		}, intervalMs);

		// Prevent timer from keeping process alive
		this.cleanupInterval.unref();
	}

	/**
	 * Remove sessions that have exceeded the TTL
	 */
	private cleanupExpiredSessions(): void {
		const now = Date.now();
		let cleaned = 0;

		for (const sessionId of Object.keys(this.sessions)) {
			const session = this.sessions[sessionId];
			if (session && now - session.lastActiveAt > this.ttlMs) {
				delete this.sessions[sessionId];
				delete this.rateLimits[sessionId];
				cleaned++;
			}
		}

		if (cleaned > 0) {
			logger.info("Cleaned up expired sessions", { count: cleaned });
		}
	}

	/**
	 * Evict the oldest session when at capacity (LRU eviction)
	 */
	private evictOldestSession(): void {
		let oldestId: string | null = null;
		let oldestTime = Number.POSITIVE_INFINITY;

		for (const sessionId of Object.keys(this.sessions)) {
			const session = this.sessions[sessionId];
			if (session && session.lastActiveAt < oldestTime) {
				oldestTime = session.lastActiveAt;
				oldestId = sessionId;
			}
		}

		if (oldestId) {
			delete this.sessions[oldestId];
			delete this.rateLimits[oldestId];
			logger.warn("Evicted oldest session due to capacity", {
				sessionId: oldestId,
			});
		}
	}
}
