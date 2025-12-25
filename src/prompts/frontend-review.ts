/**
 * Prompt templates for frontend code review
 */

export const SYSTEM_PROMPT = `You are an expert frontend developer and UX specialist. Review frontend code for best practices.`;

export function buildUserMessage(
	code: string,
	reviewType: string = "full",
	framework?: string,
	context?: string,
): string {
	const focusArea = getFocusArea(reviewType);
	const frameworkContext = framework ? `Framework: ${framework}\n` : "";
	const additionalContext = context ? `${context}\n` : "";

	return `${frameworkContext}${additionalContext}${focusArea}

Code to review:
\`\`\`
${code}
\`\`\``;
}

function getFocusArea(reviewType: string): string {
	switch (reviewType) {
		case "accessibility":
			return "Focus specifically on accessibility (WCAG compliance, ARIA labels, keyboard navigation, screen reader support).";
		case "performance":
			return "Focus specifically on frontend performance (bundle size, render optimization, lazy loading, Core Web Vitals).";
		case "ux":
			return "Focus specifically on user experience (intuitive design, error handling, loading states, responsive design).";
		default:
			return "Provide a comprehensive frontend review covering accessibility, performance, and user experience.";
	}
}
