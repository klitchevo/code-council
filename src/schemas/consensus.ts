/**
 * Zod schemas for consensus analysis validation.
 * Validates extracted findings and consensus configuration.
 */

import { z } from "zod";
import {
	CONSENSUS_TYPES,
	FINDING_CATEGORIES,
	FINDING_SEVERITIES,
	OUTPUT_FORMATS,
} from "../consensus/types";

/**
 * Schema for code location
 */
export const CodeLocationSchema = z.object({
	file: z.string().min(1, "File path cannot be empty"),
	line: z.number().int().positive().optional(),
	endLine: z.number().int().positive().optional(),
});

/**
 * Schema for a single finding extracted from a model's review
 */
export const FindingSchema = z.object({
	id: z.string().min(1),
	sourceModel: z.string().min(1),
	category: z.enum(FINDING_CATEGORIES),
	severity: z.enum(FINDING_SEVERITIES),
	title: z.string().min(1, "Title cannot be empty"),
	description: z.string().min(1, "Description cannot be empty"),
	location: CodeLocationSchema.optional(),
	suggestion: z.string().optional(),
	rawExcerpt: z.string().optional(), // Made optional - not all extractions include this
	extractedAt: z.string().datetime(),
	confidence: z.number().min(0).max(1).optional(),
});

/**
 * Schema for LLM extraction response (what the extraction prompt returns)
 */
/**
 * Transform severity to lowercase and validate
 */
const severitySchema = z
	.string()
	.transform((val) => val.toLowerCase())
	.pipe(z.enum(FINDING_SEVERITIES));

/**
 * Transform category to lowercase and validate
 */
const categorySchema = z
	.string()
	.transform((val) => val.toLowerCase())
	.pipe(z.enum(FINDING_CATEGORIES));

/**
 * Coerce string line numbers to integers (some models output "42" instead of 42)
 */
const lineNumberSchema = z
	.union([z.number(), z.string()])
	.transform((val) => {
		if (typeof val === "string") {
			const parsed = Number.parseInt(val, 10);
			return Number.isNaN(parsed) ? undefined : parsed;
		}
		return val;
	})
	.pipe(z.number().int().positive().optional())
	.nullish();

export const ExtractionResponseSchema = z.object({
	findings: z.array(
		z.object({
			category: categorySchema,
			severity: severitySchema,
			title: z.string(),
			description: z.string(),
			location: z
				.object({
					file: z.string(),
					line: lineNumberSchema,
					endLine: lineNumberSchema,
				})
				.nullish(),
			suggestion: z.string().nullish(),
			suggestedCode: z.string().nullish(),
			rawExcerpt: z.string().nullish(),
			confidence: z.number().min(0).max(1).nullish(),
		}),
	),
});

/**
 * Schema for disagreement position
 */
export const DisagreementPositionSchema = z.object({
	model: z.string().min(1),
	stance: z.string().min(1),
	reasoning: z.string().optional(),
});

/**
 * Schema for a finding cluster
 */
export const FindingClusterSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	category: z.enum(FINDING_CATEGORIES),
	severity: z.enum(FINDING_SEVERITIES),
	canonicalLocation: CodeLocationSchema.optional(),
	findings: z.array(FindingSchema),
	agreeingModels: z.array(z.string()),
	silentModels: z.array(z.string()),
	disagreingModels: z.array(z.string()),
	confidence: z.number().min(0).max(1),
	consensusType: z.enum(CONSENSUS_TYPES),
});

/**
 * Schema for a disagreement
 */
export const DisagreementSchema = z.object({
	id: z.string().min(1),
	clusterId: z.string().min(1),
	topic: z.string().min(1),
	category: z.enum(FINDING_CATEGORIES),
	location: CodeLocationSchema.optional(),
	positions: z.array(DisagreementPositionSchema),
	humanActionRequired: z.string().min(1),
});

/**
 * Schema for consensus report statistics
 */
export const ConsensusStatsSchema = z.object({
	unanimous: z.number().int().min(0),
	majority: z.number().int().min(0),
	minority: z.number().int().min(0),
	single: z.number().int().min(0),
	disagreements: z.number().int().min(0),
});

/**
 * Schema for complete consensus report
 */
export const ConsensusReportSchema = z.object({
	version: z.literal("1.0"),
	generatedAt: z.string().datetime(),
	executionTimeMs: z.number().int().min(0),
	participatingModels: z.array(z.string()),
	modelWeights: z.record(z.string(), z.number()),
	thresholds: z.object({
		high: z.number().min(0).max(1),
		moderate: z.number().min(0).max(1),
	}),
	totalFindings: z.number().int().min(0),
	stats: ConsensusStatsSchema,
	highConfidence: z.array(FindingClusterSchema),
	moderateConfidence: z.array(FindingClusterSchema),
	lowConfidence: z.array(FindingClusterSchema),
	disagreements: z.array(DisagreementSchema),
	metadata: z
		.object({
			extractionModel: z.string(),
			extractionErrors: z.number().int().min(0),
		})
		.optional(),
});

/**
 * Schema for consensus configuration
 */
export const ConsensusConfigSchema = z.object({
	enabled: z.boolean().default(false),
	modelWeights: z.record(z.string(), z.number()).default({}),
	highConfidenceThreshold: z.number().min(0).max(1).default(0.8),
	moderateConfidenceThreshold: z.number().min(0).max(1).default(0.5),
	extractionModel: z.string().default("anthropic/claude-3-haiku"),
	fallbackOnError: z.boolean().default(true),
	lineProximity: z.number().int().positive().default(5),
	similarityThreshold: z.number().min(0).max(1).default(0.7),
});

/**
 * Schema for consensus options (user-provided)
 */
export const ConsensusOptionsSchema = z.object({
	modelWeights: z.record(z.string(), z.number()).optional(),
	highConfidenceThreshold: z.number().min(0).max(1).optional(),
	moderateConfidenceThreshold: z.number().min(0).max(1).optional(),
	extractionModel: z.string().optional(),
	outputFormat: z.enum(OUTPUT_FORMATS).optional(),
});

/**
 * Type exports from schemas
 */
export type CodeLocationInput = z.infer<typeof CodeLocationSchema>;
export type FindingInput = z.infer<typeof FindingSchema>;
export type ExtractionResponse = z.infer<typeof ExtractionResponseSchema>;
export type FindingClusterInput = z.infer<typeof FindingClusterSchema>;
export type DisagreementInput = z.infer<typeof DisagreementSchema>;
export type ConsensusReportInput = z.infer<typeof ConsensusReportSchema>;
export type ConsensusConfigInput = z.infer<typeof ConsensusConfigSchema>;
export type ConsensusOptionsInput = z.infer<typeof ConsensusOptionsSchema>;
