/**
 * Interface for session storage backends.
 * Allows swapping implementations (e.g., in-memory -> Redis) without changing consumers.
 */

import type {
	ConversationMessage,
	DiscussionSession,
	DiscussionType,
	SessionId,
} from "./types.js";

/**
 * Configuration for creating a new session
 */
export interface CreateSessionOptions {
	readonly topic: string;
	readonly discussionType: DiscussionType;
	readonly models: readonly string[];
	readonly systemPrompt: string;
	readonly initialUserMessage: string;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
	readonly allowed: boolean;
	readonly remainingRequests: number;
	readonly resetInMs: number;
}

/**
 * Interface for session storage implementations
 */
export interface ISessionStore {
	/**
	 * Create a new discussion session
	 */
	createSession(options: CreateSessionOptions): DiscussionSession;

	/**
	 * Get an existing session by ID (updates lastActiveAt for sliding TTL)
	 */
	getSession(id: SessionId): DiscussionSession | undefined;

	/**
	 * Add a user message to all model conversations in a session
	 * @returns true if successful, false if session not found
	 */
	addUserMessage(id: SessionId, message: string): boolean;

	/**
	 * Add an assistant response for a specific model
	 * @returns true if successful, false if session or model not found
	 */
	addAssistantMessage(id: SessionId, model: string, response: string): boolean;

	/**
	 * Get messages for a specific model (for API calls)
	 */
	getModelMessages(
		id: SessionId,
		model: string,
	): ConversationMessage[] | undefined;

	/**
	 * Delete a session
	 * @returns true if deleted, false if not found
	 */
	deleteSession(id: SessionId): boolean;

	/**
	 * Get current session count for monitoring
	 */
	getSessionCount(): number;

	/**
	 * Check and update rate limit for a session
	 */
	checkRateLimit(id: SessionId): RateLimitResult;

	/**
	 * Graceful shutdown - cleanup timers and resources
	 */
	shutdown(): void;
}
