/**
 * List configuration tool - shows current model configuration
 */

import {
	BACKEND_REVIEW_MODELS,
	CODE_REVIEW_MODELS,
	CONSENSUS_CONFIG,
	DISCUSSION_MODELS,
	FRONTEND_REVIEW_MODELS,
	PLAN_REVIEW_MODELS,
	TPS_AUDIT_MODELS,
} from "../config";

export async function handleListConfig() {
	const consensusSection = `
## Consensus Analysis

**Status:** ${CONSENSUS_CONFIG.enabled ? "✅ Enabled" : "❌ Disabled"}
${
	CONSENSUS_CONFIG.enabled
		? `
**Extraction Model:** \`${CONSENSUS_CONFIG.extractionModel}\`
**High Confidence Threshold:** ${CONSENSUS_CONFIG.highConfidenceThreshold * 100}%
**Moderate Confidence Threshold:** ${CONSENSUS_CONFIG.moderateConfidenceThreshold * 100}%
**Fallback on Error:** ${CONSENSUS_CONFIG.fallbackOnError ? "Yes" : "No"}
${
	Object.keys(CONSENSUS_CONFIG.modelWeights).length > 0
		? `**Custom Model Weights:**\n${Object.entries(
				CONSENSUS_CONFIG.modelWeights,
			)
				.map(([m, w]) => `- \`${m}\`: ${w}`)
				.join("\n")}`
		: "*Using equal weights for all models*"
}`
		: `
To enable consensus analysis, set \`ENABLE_CONSENSUS=true\``
}`;

	const text = `## Current Configuration

**Code Review Models:**
${CODE_REVIEW_MODELS.map((m) => `- \`${m}\``).join("\n")}

**Frontend Review Models:**
${FRONTEND_REVIEW_MODELS.map((m) => `- \`${m}\``).join("\n")}

**Backend Review Models:**
${BACKEND_REVIEW_MODELS.map((m) => `- \`${m}\``).join("\n")}

**Plan Review Models:**
${PLAN_REVIEW_MODELS.map((m) => `- \`${m}\``).join("\n")}

**Discussion Models:**
${DISCUSSION_MODELS.map((m) => `- \`${m}\``).join("\n")}

**TPS Audit Models:**
${TPS_AUDIT_MODELS.map((m) => `- \`${m}\``).join("\n")}
${consensusSection}

## Environment Variables

**Model Configuration:**
- \`CODE_REVIEW_MODELS\` - JSON array of models
- \`FRONTEND_REVIEW_MODELS\` - JSON array of models
- \`BACKEND_REVIEW_MODELS\` - JSON array of models
- \`PLAN_REVIEW_MODELS\` - JSON array of models
- \`DISCUSSION_MODELS\` - JSON array of models
- \`TPS_AUDIT_MODELS\` - JSON array of models

**Consensus Configuration:**
- \`ENABLE_CONSENSUS\` - Set to "true" to enable
- \`MODEL_WEIGHTS\` - JSON object of model weights
- \`HIGH_CONFIDENCE_THRESHOLD\` - Default 0.8
- \`MODERATE_CONFIDENCE_THRESHOLD\` - Default 0.5
- \`CONSENSUS_EXTRACTION_MODEL\` - Default anthropic/claude-3-haiku
- \`CONSENSUS_FALLBACK_ON_ERROR\` - Default true`;

	return {
		results: [],
		models: [],
		text,
	};
}
