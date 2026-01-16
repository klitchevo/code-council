/**
 * Expected Finding objects for testing extraction and normalization.
 * These match the sample-reviews.ts fixtures.
 */

import type { Finding, FindingCategory, FindingSeverity } from "../types";
import { toFindingId } from "../types";

/**
 * Helper to create a Finding with defaults
 */
export function createFinding(
	partial: Partial<Finding> & {
		sourceModel: string;
		category: FindingCategory;
		severity: FindingSeverity;
		title: string;
		description: string;
	},
): Finding {
	return {
		id: partial.id ?? toFindingId(`finding-${Date.now()}-${Math.random()}`),
		sourceModel: partial.sourceModel,
		category: partial.category,
		severity: partial.severity,
		title: partial.title,
		description: partial.description,
		location: partial.location,
		suggestion: partial.suggestion,
		rawExcerpt: partial.rawExcerpt ?? "",
		extractedAt: partial.extractedAt ?? new Date().toISOString(),
		confidence: partial.confidence,
	};
}

/**
 * Expected findings from Claude's security review
 */
export const expectedClaudeFindings: Partial<Finding>[] = [
	{
		sourceModel: "anthropic/claude-3.5-sonnet",
		category: "security",
		severity: "critical",
		title: "SQL Injection Vulnerability",
		location: { file: "src/api/users.ts", line: 42 },
	},
	{
		sourceModel: "anthropic/claude-3.5-sonnet",
		category: "security",
		severity: "high",
		title: "Missing Input Validation",
		location: { file: "src/api/users.ts", line: 38 },
	},
	{
		sourceModel: "anthropic/claude-3.5-sonnet",
		category: "performance",
		severity: "medium",
		title: "N+1 Query Pattern",
		location: { file: "src/api/posts.ts", line: 15, endLine: 25 },
	},
	{
		sourceModel: "anthropic/claude-3.5-sonnet",
		category: "maintainability",
		severity: "low",
		title: "Magic Numbers",
		location: { file: "src/utils/pagination.ts", line: 12 },
	},
];

/**
 * Expected findings from GPT-4 review
 */
export const expectedGpt4Findings: Partial<Finding>[] = [
	{
		sourceModel: "openai/gpt-4-turbo",
		category: "security",
		severity: "critical",
		title: "SQL Injection Risk",
		location: { file: "src/api/users.ts", line: 42 },
	},
	{
		sourceModel: "openai/gpt-4-turbo",
		category: "security",
		severity: "critical",
		title: "Authentication Bypass Possible",
		location: { file: "src/api/auth.ts", line: 28 },
	},
	{
		sourceModel: "openai/gpt-4-turbo",
		category: "security",
		severity: "high",
		title: "Input Validation Missing",
		location: { file: "src/api/users.ts", line: 38 },
	},
	{
		sourceModel: "openai/gpt-4-turbo",
		category: "security",
		severity: "high",
		title: "Error Messages Leak Information",
		location: { file: "src/api/users.ts", line: 55 },
	},
];

/**
 * Expected findings from Gemini review
 */
export const expectedGeminiFindings: Partial<Finding>[] = [
	{
		sourceModel: "google/gemini-pro",
		category: "security",
		severity: "high",
		title: "SQL Injection",
		location: { file: "src/api/users.ts", line: 42 },
	},
	{
		sourceModel: "google/gemini-pro",
		category: "security",
		severity: "high",
		title: "Session Management",
		location: { file: "src/api/auth.ts", line: 28 },
	},
	{
		sourceModel: "google/gemini-pro",
		category: "performance",
		severity: "medium",
		title: "Database Queries",
	},
	{
		sourceModel: "google/gemini-pro",
		category: "style",
		severity: "low",
		title: "Constants",
	},
	{
		sourceModel: "google/gemini-pro",
		category: "documentation",
		severity: "low",
		title: "Missing Types",
	},
];

/**
 * Findings that should cluster together (same underlying issue)
 */
export const sqlInjectionFindings: Partial<Finding>[] = [
	{
		sourceModel: "anthropic/claude-3.5-sonnet",
		category: "security",
		severity: "critical",
		title: "SQL Injection Vulnerability",
		location: { file: "src/api/users.ts", line: 42 },
	},
	{
		sourceModel: "openai/gpt-4-turbo",
		category: "security",
		severity: "critical",
		title: "SQL Injection Risk",
		location: { file: "src/api/users.ts", line: 42 },
	},
	{
		sourceModel: "google/gemini-pro",
		category: "security",
		severity: "high", // Different severity - not a disagreement, just different assessment
		title: "SQL Injection",
		location: { file: "src/api/users.ts", line: 42 },
	},
];

/**
 * Findings about auth that should cluster
 */
export const authFindings: Partial<Finding>[] = [
	{
		sourceModel: "openai/gpt-4-turbo",
		category: "security",
		severity: "critical",
		title: "Authentication Bypass Possible",
		location: { file: "src/api/auth.ts", line: 28 },
	},
	{
		sourceModel: "google/gemini-pro",
		category: "security",
		severity: "high",
		title: "Session Management",
		location: { file: "src/api/auth.ts", line: 28 },
	},
];

/**
 * Finding only mentioned by one model (should be "single" consensus type)
 */
export const uniqueFindings: Partial<Finding>[] = [
	{
		sourceModel: "openai/gpt-4-turbo",
		category: "security",
		severity: "high",
		title: "Error Messages Leak Information",
		location: { file: "src/api/users.ts", line: 55 },
	},
];
