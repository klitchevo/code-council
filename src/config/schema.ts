/**
 * Zod schemas for validating code-council configuration
 */

import { z } from "zod";

/**
 * Schema for model arrays
 */
const modelArraySchema = z
	.array(z.string().min(1))
	.optional()
	.describe("Array of OpenRouter model IDs");

/**
 * Schema for models configuration
 */
export const ModelsConfigSchema = z
	.object({
		defaultModels: modelArraySchema,
		codeReview: modelArraySchema,
		frontendReview: modelArraySchema,
		backendReview: modelArraySchema,
		planReview: modelArraySchema,
		discussion: modelArraySchema,
		tpsAudit: modelArraySchema,
	})
	.optional();

/**
 * Schema for consensus configuration
 */
export const ConsensusConfigSchema = z
	.object({
		enabled: z.boolean().optional(),
		modelWeights: z.record(z.string(), z.number().positive()).optional(),
		highConfidenceThreshold: z.number().min(0).max(1).optional(),
		moderateConfidenceThreshold: z.number().min(0).max(1).optional(),
		extractionModel: z.string().min(1).optional(),
		fallbackOnError: z.boolean().optional(),
		hostExtraction: z.boolean().optional(),
	})
	.optional();

/**
 * Schema for LLM configuration
 */
export const LLMConfigSchema = z
	.object({
		temperature: z.number().min(0).max(2).optional(),
		maxTokens: z.number().int().positive().optional(),
	})
	.optional();

/**
 * Schema for session configuration
 */
export const SessionConfigSchema = z
	.object({
		maxSessions: z.number().int().positive().optional(),
		maxMessagesPerModel: z.number().int().positive().optional(),
		ttlMs: z.number().int().positive().optional(),
		rateLimitPerMinute: z.number().int().positive().optional(),
	})
	.optional();

/**
 * Schema for input limits configuration
 */
export const InputLimitsConfigSchema = z
	.object({
		maxCodeLength: z.number().int().positive().optional(),
		maxContextLength: z.number().int().positive().optional(),
		maxModels: z.number().int().positive().optional(),
	})
	.optional();

/**
 * Complete schema for code-council configuration
 */
export const CodeCouncilConfigSchema = z.object({
	models: ModelsConfigSchema,
	consensus: ConsensusConfigSchema,
	llm: LLMConfigSchema,
	session: SessionConfigSchema,
	inputLimits: InputLimitsConfigSchema,
});

/**
 * Inferred type from the Zod schema
 */
export type CodeCouncilConfigFromSchema = z.infer<
	typeof CodeCouncilConfigSchema
>;
