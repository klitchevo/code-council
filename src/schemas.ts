/**
 * Zod schemas for input validation across all tools.
 * Validates structure and types, not arbitrary limits.
 */

import { z } from "zod";

/**
 * Schema for code review input
 */
export const CodeReviewSchema = z.object({
	code: z.string().min(1, "Code cannot be empty"),
	language: z.string().optional(),
	context: z.string().optional(),
});

/**
 * Schema for frontend review input
 */
export const FrontendReviewSchema = z.object({
	code: z.string().min(1, "Code cannot be empty"),
	framework: z.string().optional(),
	review_type: z
		.enum(["accessibility", "performance", "ux", "full"])
		.optional(),
	context: z.string().optional(),
});

/**
 * Schema for backend review input
 */
export const BackendReviewSchema = z.object({
	code: z.string().min(1, "Code cannot be empty"),
	language: z.string().optional(),
	review_type: z
		.enum(["security", "performance", "architecture", "full"])
		.optional(),
	context: z.string().optional(),
});

/**
 * Schema for plan review input
 */
export const PlanReviewSchema = z.object({
	plan: z.string().min(1, "Plan cannot be empty"),
	review_type: z
		.enum(["feasibility", "completeness", "risks", "timeline", "full"])
		.optional(),
	context: z.string().optional(),
});

export type CodeReviewInput = z.infer<typeof CodeReviewSchema>;
export type FrontendReviewInput = z.infer<typeof FrontendReviewSchema>;
export type BackendReviewInput = z.infer<typeof BackendReviewSchema>;
export type PlanReviewInput = z.infer<typeof PlanReviewSchema>;
