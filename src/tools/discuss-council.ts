/**
 * Council discussion tool - multi-turn conversations with AI council
 */

import { z } from "zod";
import { getDiscussionModels } from "../config.js";
import { SESSION_LIMITS } from "../constants.js";
import { ValidationError } from "../errors.js";
import { logger } from "../logger.js";
import { buildInitialMessage, getSystemPrompt } from "../prompts/discussion.js";
import type { ChatMessage, ReviewClient } from "../review-client.js";
import type { ISessionStore } from "../session/session-store.js";
import {
	DISCUSSION_TYPES,
	type DiscussionType,
	type SessionId,
	toSessionId,
} from "../session/types.js";
import type { ConversationResult } from "./conversation-factory.js";

/**
 * Schema for discuss_with_council tool input
 */
export const discussCouncilSchema = {
	message: z
		.string()
		.min(1, "Message cannot be empty")
		.max(
			SESSION_LIMITS.MAX_MESSAGE_LENGTH,
			`Message exceeds maximum length of ${SESSION_LIMITS.MAX_MESSAGE_LENGTH} characters`,
		)
		.describe("Your message or question for the council"),
	session_id: z
		.string()
		.uuid("Invalid session ID format")
		.optional()
		.describe(
			"Session ID to continue an existing discussion. Omit to start a new discussion.",
		),
	discussion_type: z
		.enum(DISCUSSION_TYPES)
		.optional()
		.describe(
			"Type of discussion (only used when starting new session). " +
				"'code_review' for code-related discussions, 'plan_review' for architecture/planning, " +
				"'general' for other topics. Default: general",
		),
	context: z
		.string()
		.max(
			SESSION_LIMITS.MAX_MESSAGE_LENGTH,
			`Context exceeds maximum length of ${SESSION_LIMITS.MAX_MESSAGE_LENGTH} characters`,
		)
		.optional()
		.describe(
			"Additional context for new discussions (code snippets, plan details, etc.)",
		),
};

/**
 * Input type for the discuss_with_council tool
 */
export interface DiscussCouncilInput {
	message: string;
	session_id?: string;
	discussion_type?: DiscussionType;
	context?: string;
}

/**
 * Handle council discussion - start new or continue existing session
 */
export async function handleDiscussCouncil(
	client: ReviewClient,
	input: Record<string, unknown>,
	sessionStore: ISessionStore,
): Promise<ConversationResult> {
	const { message, session_id, discussion_type, context } =
		input as unknown as DiscussCouncilInput;

	// Determine if this is a new or continued session
	let sessionId: SessionId | undefined;
	let isNewSession = false;

	if (session_id) {
		sessionId = toSessionId(session_id);
		const existingSession = sessionStore.getSession(sessionId);

		if (!existingSession) {
			throw new ValidationError(
				`Session not found: ${session_id}. It may have expired or been deleted.`,
				"session_id",
			);
		}

		// Check rate limit for existing session
		const rateLimitResult = sessionStore.checkRateLimit(sessionId);
		if (!rateLimitResult.allowed) {
			throw new ValidationError(
				`Rate limit exceeded. Please wait ${Math.ceil(rateLimitResult.resetInMs / 1000)} seconds before sending another message.`,
				"session_id",
			);
		}

		// Add user message to existing session
		sessionStore.addUserMessage(sessionId, message);

		logger.info("Continuing council discussion", {
			sessionId,
			modelCount: existingSession.models.length,
		});
	} else {
		// Create new session
		isNewSession = true;
		const type: DiscussionType = discussion_type || "general";
		const systemPrompt = getSystemPrompt(type);
		const initialMessage = buildInitialMessage(message, type, context);

		// Truncate topic to first 100 chars for display
		const topic = message.length > 100 ? `${message.slice(0, 97)}...` : message;

		const session = sessionStore.createSession({
			topic,
			discussionType: type,
			models: getDiscussionModels(),
			systemPrompt,
			initialUserMessage: initialMessage,
		});

		sessionId = session.id;

		logger.info("Started new council discussion", {
			sessionId,
			discussionType: type,
			modelCount: getDiscussionModels().length,
		});
	}

	// Get the session (will update lastActiveAt)
	const session = sessionStore.getSession(sessionId);
	if (!session) {
		throw new ValidationError("Session was unexpectedly deleted", "session_id");
	}

	// Capture sessionId for closure (guaranteed defined at this point)
	const currentSessionId = sessionId;

	// Get responses from all models in parallel
	const results = await client.discussWithCouncil(session.models, (model) => {
		const messages = sessionStore.getModelMessages(currentSessionId, model);
		if (!messages) {
			throw new Error(`No messages found for model ${model}`);
		}
		return messages as ChatMessage[];
	});

	// Store assistant responses for each model
	for (const result of results) {
		if (!result.error && result.review) {
			sessionStore.addAssistantMessage(sessionId, result.model, result.review);
		}
	}

	return {
		results,
		models: session.models,
		sessionId,
		isNewSession,
		topic: session.topic,
	};
}
