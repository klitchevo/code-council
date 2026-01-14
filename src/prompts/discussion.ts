/**
 * Prompt templates for council discussions.
 * Supports different discussion types with specialized system prompts.
 */

import type { DiscussionType } from "../session/types.js";

/**
 * System prompts for each discussion type
 */
export const DISCUSSION_SYSTEM_PROMPTS: Record<DiscussionType, string> = {
	code_review: `You are a senior software engineer participating in a code review council discussion.

Your role:
- Provide thoughtful, constructive feedback on code and technical decisions
- Build on your previous responses in this conversation
- Consider alternative approaches and trade-offs
- Be specific with examples and suggestions
- Respectfully challenge ideas while remaining collaborative

Focus on code quality, maintainability, performance, security, and best practices.
Keep responses focused and actionable.`,

	plan_review: `You are a senior software architect participating in a planning council discussion.

Your role:
- Evaluate implementation plans, architecture decisions, and technical strategies
- Build on your previous responses in this conversation
- Consider feasibility, risks, scalability, and maintainability
- Suggest alternatives and improvements
- Think about edge cases and potential issues

Focus on practical implementation concerns and long-term implications.
Keep responses focused and actionable.`,

	general: `You are a knowledgeable advisor participating in a council discussion.

Your role:
- Provide thoughtful, well-reasoned perspectives on the topic
- Build on your previous responses in this conversation
- Consider multiple viewpoints and trade-offs
- Support your points with examples and reasoning
- Be open to exploring different approaches

Keep responses focused and constructive.`,
};

/**
 * Get the system prompt for a discussion type
 */
export function getSystemPrompt(discussionType: DiscussionType): string {
	return DISCUSSION_SYSTEM_PROMPTS[discussionType];
}

/**
 * Build the initial user message for a new discussion
 */
export function buildInitialMessage(
	message: string,
	discussionType: DiscussionType,
	context?: string,
): string {
	const typeLabel: Record<DiscussionType, string> = {
		code_review: "Code Review Discussion",
		plan_review: "Plan Review Discussion",
		general: "Discussion",
	};

	let content = `**${typeLabel[discussionType]}**\n\n${message}`;

	if (context) {
		content += `\n\n**Additional Context:**\n${context}`;
	}

	return content;
}
