/**
 * Prompt templates for backend code review
 */

export const SYSTEM_PROMPT = `You are an expert backend developer and security specialist. Review backend code for security, performance, and architecture.`;

export function buildUserMessage(
	code: string,
	reviewType: string = "full",
	language?: string,
	context?: string,
): string {
	const focusArea = getFocusArea(reviewType);
	const languageContext = language ? `Language/Framework: ${language}\n` : "";
	const additionalContext = context ? `${context}\n` : "";

	return `${languageContext}${additionalContext}${focusArea}

Code to review:
\`\`\`
${code}
\`\`\``;
}

function getFocusArea(reviewType: string): string {
	switch (reviewType) {
		case "security":
			return "Focus specifically on security (authentication, authorization, input validation, SQL injection, XSS, CSRF, secrets management).";
		case "performance":
			return "Focus specifically on backend performance (database queries, caching, async operations, resource usage, scalability).";
		case "architecture":
			return "Focus specifically on architecture (design patterns, separation of concerns, modularity, maintainability, scalability).";
		default:
			return "Provide a comprehensive backend review covering security, performance, and architecture.";
	}
}
