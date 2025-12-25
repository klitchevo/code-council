/**
 * List configuration tool - shows current model configuration
 */

import {
	BACKEND_REVIEW_MODELS,
	CODE_REVIEW_MODELS,
	FRONTEND_REVIEW_MODELS,
	PLAN_REVIEW_MODELS,
} from "../config";

export async function handleListConfig() {
	const text = `## Current Configuration

**Code Review Models:**
${CODE_REVIEW_MODELS.map((m) => `- \`${m}\``).join("\n")}

**Frontend Review Models:**
${FRONTEND_REVIEW_MODELS.map((m) => `- \`${m}\``).join("\n")}

**Backend Review Models:**
${BACKEND_REVIEW_MODELS.map((m) => `- \`${m}\``).join("\n")}

**Plan Review Models:**
${PLAN_REVIEW_MODELS.map((m) => `- \`${m}\``).join("\n")}

To customize models, set environment variables in your MCP config:
- CODE_REVIEW_MODELS
- FRONTEND_REVIEW_MODELS
- BACKEND_REVIEW_MODELS
- PLAN_REVIEW_MODELS`;

	return {
		results: [],
		models: [],
		text,
	};
}
