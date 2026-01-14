/**
 * Type definitions for multi-turn discussion sessions.
 * Uses const assertions as single source of truth for unions (reusable in Zod).
 */

/**
 * Valid message roles in a conversation
 */
export const MESSAGE_ROLES = ["system", "user", "assistant"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

/**
 * Types of discussions supported by the council
 */
export const DISCUSSION_TYPES = [
	"code_review",
	"plan_review",
	"general",
] as const;
export type DiscussionType = (typeof DISCUSSION_TYPES)[number];

/**
 * Branded type for session IDs to prevent accidental misuse
 */
declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };
export type SessionId = Brand<string, "SessionId">;

/**
 * Helper to create a SessionId from a string (use after UUID validation)
 */
export function toSessionId(id: string): SessionId {
	return id as SessionId;
}

/**
 * A single message in the conversation
 */
export interface ConversationMessage {
	readonly role: MessageRole;
	readonly content: string;
	readonly timestamp: number;
}

/**
 * Per-model conversation state
 */
export interface ModelConversation {
	readonly model: string;
	messages: ConversationMessage[]; // mutable for appending
	lastActive: number;
}

/**
 * Complete session state for a discussion
 */
export interface DiscussionSession {
	readonly id: SessionId;
	readonly topic: string;
	readonly discussionType: DiscussionType;
	readonly modelConversations: Record<string, ModelConversation>; // Record for JSON compatibility
	readonly createdAt: number;
	lastActiveAt: number;
	readonly models: readonly string[];
}

/**
 * Rate limiting state for a session
 */
export interface RateLimitState {
	readonly sessionId: SessionId;
	requestCount: number;
	windowStart: number;
}
