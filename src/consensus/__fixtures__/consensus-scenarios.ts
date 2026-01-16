/**
 * Complete test scenarios for consensus analysis.
 * These represent end-to-end expectations from reviews to report.
 */

import type { ModelReviewResult } from "../../review-client";
import type { ConsensusType } from "../types";

/**
 * Scenario: Three models all agree on a critical security issue
 */
export interface UnanimousScenario {
	name: string;
	description: string;
	reviews: ModelReviewResult[];
	expectedClusters: number;
	expectedConsensusTypes: ConsensusType[];
	expectedDisagreements: number;
}

export const unanimousSecurityScenario: UnanimousScenario = {
	name: "unanimous-security",
	description: "All three models identify the same SQL injection vulnerability",
	reviews: [
		{
			model: "anthropic/claude-3.5-sonnet",
			review: `Critical: SQL Injection at src/api/users.ts:42. Use parameterized queries.`,
		},
		{
			model: "openai/gpt-4-turbo",
			review: `Found SQL injection vulnerability in src/api/users.ts line 42. Immediate fix required.`,
		},
		{
			model: "google/gemini-pro",
			review: `Security issue: SQL injection at users.ts:42. Recommend prepared statements.`,
		},
	],
	expectedClusters: 1,
	expectedConsensusTypes: ["unanimous"],
	expectedDisagreements: 0,
};

/**
 * Scenario: Majority agreement with one silent model
 */
export const majorityScenario: UnanimousScenario = {
	name: "majority-agreement",
	description: "Two models find an issue, one doesn't mention it",
	reviews: [
		{
			model: "anthropic/claude-3.5-sonnet",
			review: `Medium: N+1 query pattern in src/api/posts.ts lines 15-25.`,
		},
		{
			model: "openai/gpt-4-turbo",
			review: `Performance issue: posts.ts has N+1 queries around line 15-20.`,
		},
		{
			model: "google/gemini-pro",
			review: `Code looks good. No major issues found.`,
		},
	],
	expectedClusters: 1,
	expectedConsensusTypes: ["majority"],
	expectedDisagreements: 0,
};

/**
 * Scenario: Models disagree on severity/recommendation
 */
export const disagreementScenario: UnanimousScenario = {
	name: "severity-disagreement",
	description: "Models disagree on whether something is an issue",
	reviews: [
		{
			model: "anthropic/claude-3.5-sonnet",
			review: `Critical: The global state pattern in store.ts is dangerous and should be refactored immediately.`,
		},
		{
			model: "openai/gpt-4-turbo",
			review: `The global state in store.ts is a standard pattern and is fine for this use case.`,
		},
		{
			model: "google/gemini-pro",
			review: `Low priority: Consider moving away from global state in store.ts for better testing.`,
		},
	],
	expectedClusters: 1,
	expectedConsensusTypes: ["majority"], // Still cluster together
	expectedDisagreements: 1, // But flag the disagreement
};

/**
 * Scenario: Single model finds something unique
 */
export const singleModelScenario: UnanimousScenario = {
	name: "single-model-finding",
	description: "Only one model identifies an issue",
	reviews: [
		{
			model: "anthropic/claude-3.5-sonnet",
			review: `Low: Missing JSDoc on exported function at utils.ts:28.`,
		},
		{
			model: "openai/gpt-4-turbo",
			review: `Code looks clean, no issues.`,
		},
		{
			model: "google/gemini-pro",
			review: `Well-structured code. Good job!`,
		},
	],
	expectedClusters: 1,
	expectedConsensusTypes: ["single"],
	expectedDisagreements: 0,
};

/**
 * Scenario: Mixed findings with various consensus levels
 */
export const mixedScenario: UnanimousScenario = {
	name: "mixed-consensus",
	description: "Various findings with different agreement levels",
	reviews: [
		{
			model: "anthropic/claude-3.5-sonnet",
			review: `
Critical: SQL injection at users.ts:42
High: Missing input validation at users.ts:38
Medium: N+1 queries in posts.ts:15
Low: Magic numbers in pagination.ts:12
`,
		},
		{
			model: "openai/gpt-4-turbo",
			review: `
Critical: SQL injection vulnerability in users.ts:42
Critical: Auth bypass at auth.ts:28
Important: No input validation users.ts:38
`,
		},
		{
			model: "google/gemini-pro",
			review: `
High: SQL injection users.ts:42
High: Auth issues at auth.ts:28
Medium: Consider N+1 optimization in posts.ts
Low: Magic number 20 should be a constant
`,
		},
	],
	expectedClusters: 5, // SQL, auth, validation, N+1, magic numbers
	expectedConsensusTypes: [
		"unanimous",
		"majority",
		"majority",
		"majority",
		"single",
	],
	expectedDisagreements: 0,
};

/**
 * Edge case: All models have errors
 */
export const allErrorsScenario: UnanimousScenario = {
	name: "all-errors",
	description: "All models failed to produce reviews",
	reviews: [
		{ model: "anthropic/claude-3.5-sonnet", review: "", error: "Rate limited" },
		{ model: "openai/gpt-4-turbo", review: "", error: "Timeout" },
		{ model: "google/gemini-pro", review: "", error: "Service unavailable" },
	],
	expectedClusters: 0,
	expectedConsensusTypes: [],
	expectedDisagreements: 0,
};

/**
 * Edge case: Empty reviews (no issues found)
 */
export const noIssuesScenario: UnanimousScenario = {
	name: "no-issues",
	description: "All models approve the code with no findings",
	reviews: [
		{
			model: "anthropic/claude-3.5-sonnet",
			review: "Code looks great! No issues.",
		},
		{ model: "openai/gpt-4-turbo", review: "Clean code, well done." },
		{ model: "google/gemini-pro", review: "No problems found." },
	],
	expectedClusters: 0,
	expectedConsensusTypes: [],
	expectedDisagreements: 0,
};

/**
 * All test scenarios
 */
export const allScenarios: UnanimousScenario[] = [
	unanimousSecurityScenario,
	majorityScenario,
	disagreementScenario,
	singleModelScenario,
	mixedScenario,
	allErrorsScenario,
	noIssuesScenario,
];
