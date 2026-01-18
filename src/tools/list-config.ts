/**
 * List configuration tool - shows current model configuration
 */

import {
	getBackendReviewModels,
	getCodeReviewModels,
	getConsensusConfig,
	getDiscussionModels,
	getFrontendReviewModels,
	getPlanReviewModels,
	getTpsAuditModels,
} from "../config";

export async function handleListConfig() {
	const consensusConfig = getConsensusConfig();
	const consensusSection = `
## Consensus Analysis

**Status:** ${consensusConfig.enabled ? "✅ Enabled" : "❌ Disabled"}
${
	consensusConfig.enabled
		? `
**Extraction Model:** \`${consensusConfig.extractionModel}\`
**High Confidence Threshold:** ${consensusConfig.highConfidenceThreshold * 100}%
**Moderate Confidence Threshold:** ${consensusConfig.moderateConfidenceThreshold * 100}%
**Fallback on Error:** ${consensusConfig.fallbackOnError ? "Yes" : "No"}
${
	Object.keys(consensusConfig.modelWeights).length > 0
		? `**Custom Model Weights:**\n${Object.entries(consensusConfig.modelWeights)
				.map(([m, w]) => `- \`${m}\`: ${w}`)
				.join("\n")}`
		: "*Using equal weights for all models*"
}`
		: `
To enable consensus analysis, set \`ENABLE_CONSENSUS=true\``
}`;

	const text = `## Current Configuration

**Code Review Models:**
${getCodeReviewModels()
	.map((m) => `- \`${m}\``)
	.join("\n")}

**Frontend Review Models:**
${getFrontendReviewModels()
	.map((m) => `- \`${m}\``)
	.join("\n")}

**Backend Review Models:**
${getBackendReviewModels()
	.map((m) => `- \`${m}\``)
	.join("\n")}

**Plan Review Models:**
${getPlanReviewModels()
	.map((m) => `- \`${m}\``)
	.join("\n")}

**Discussion Models:**
${getDiscussionModels()
	.map((m) => `- \`${m}\``)
	.join("\n")}

**TPS Audit Models:**
${getTpsAuditModels()
	.map((m) => `- \`${m}\``)
	.join("\n")}
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
