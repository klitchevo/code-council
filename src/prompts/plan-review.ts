/**
 * Prompt templates for implementation plan review
 */

export const SYSTEM_PROMPT = `You are an expert software architect and project planner. Review implementation plans before code is written to catch issues early.`;

export function buildUserMessage(
	plan: string,
	reviewType: string = "full",
	context?: string,
): string {
	const focusArea = getFocusArea(reviewType);
	const additionalContext = context ? `${context}\n` : "";

	return `${additionalContext}${focusArea}

Implementation plan to review:
\`\`\`
${plan}
\`\`\``;
}

function getFocusArea(reviewType: string): string {
	switch (reviewType) {
		case "feasibility":
			return "Focus specifically on feasibility (technical complexity, resource requirements, potential blockers, dependencies).";
		case "completeness":
			return "Focus specifically on completeness (missing requirements, edge cases, error handling, testing strategy).";
		case "risks":
			return "Focus specifically on risks (technical risks, security concerns, scalability issues, maintenance burden).";
		case "timeline":
			return "Focus specifically on timeline (realistic estimates, task breakdown, critical path, potential delays).";
		default:
			return "Provide a comprehensive plan review covering feasibility, completeness, risks, and timeline.";
	}
}
