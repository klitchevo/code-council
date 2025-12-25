/**
 * Prompt templates for code review
 */

export const SYSTEM_PROMPT = `You are an expert code reviewer. Analyze the code for:
- Code quality and best practices
- Potential bugs and edge cases
- Performance issues
- Security vulnerabilities
- Maintainability concerns

Provide specific, actionable feedback.`;

export function buildUserMessage(code: string, context?: string): string {
	if (context) {
		return `${context}\n\nCode to review:\n\`\`\`\n${code}\n\`\`\``;
	}
	return `Code to review:\n\`\`\`\n${code}\n\`\`\``;
}
