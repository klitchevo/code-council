/**
 * Prompt templates for consensus analysis - extracting structured findings from reviews.
 * Used by ConsensusClient to parse free-form model reviews into Finding objects.
 */

import type { FindingCategory, FindingSeverity } from "../consensus/types";

/**
 * Categories for finding classification
 */
export const CATEGORY_DESCRIPTIONS: Record<FindingCategory, string> = {
	security:
		"Security vulnerabilities, authentication issues, data exposure, injection risks",
	performance:
		"Performance issues, inefficient algorithms, memory leaks, slow operations",
	bug: "Actual bugs, logic errors, edge cases, incorrect behavior",
	maintainability:
		"Code quality, readability, complexity, technical debt, code smells",
	accessibility: "Accessibility issues, WCAG compliance, screen reader support",
	architecture:
		"Design patterns, structure, coupling, separation of concerns, scalability",
	style: "Code style, formatting, naming conventions, consistency",
	documentation: "Missing or inadequate documentation, comments, type hints",
	testing: "Test coverage, test quality, missing tests, testability issues",
	other: "Issues that don't fit other categories",
};

/**
 * Severity level descriptions
 */
export const SEVERITY_DESCRIPTIONS: Record<FindingSeverity, string> = {
	critical:
		"Must fix immediately - security vulnerabilities, data loss, system crashes",
	high: "Should fix soon - significant bugs, major performance issues, security concerns",
	medium:
		"Should address - moderate issues affecting quality or maintainability",
	low: "Nice to fix - minor improvements, style issues, small optimizations",
	info: "Informational - suggestions, best practices, educational notes",
};

/**
 * System prompt for extracting findings from a model's review.
 * Uses YAML with block scalars to avoid JSON escape character issues.
 */
export const EXTRACTION_SYSTEM_PROMPT = `You are a precise extraction system. Your task is to parse a code review and extract individual findings into a structured YAML format.

## Output Format

You MUST respond with valid YAML matching this schema. Use block scalars (|) for multi-line text to avoid escape issues:

\`\`\`yaml
findings:
  - category: security
    severity: high
    title: |
      Short, descriptive title
    description: |
      Detailed explanation of the issue.
      Can span multiple lines.
    location:
      file: path/to/file.ts
      line: 42
      endLine: 45
    suggestion: |
      How to fix or improve
    confidence: 0.95
\`\`\`

## Available Values

**Categories**: security, performance, bug, maintainability, accessibility, architecture, style, documentation, testing, other

**Severities**: critical, high, medium, low, info

## Category Definitions

${Object.entries(CATEGORY_DESCRIPTIONS)
	.map(([cat, desc]) => `- **${cat}**: ${desc}`)
	.join("\n")}

## Severity Guidelines

${Object.entries(SEVERITY_DESCRIPTIONS)
	.map(([sev, desc]) => `- **${sev}**: ${desc}`)
	.join("\n")}

## Extraction Rules

1. **Be thorough**: Extract ALL distinct issues mentioned in the review
2. **Infer location**: If file paths or line numbers are mentioned, include them
3. **Normalize severity**: Map vague language to specific severity levels:
   - "critical", "severe", "urgent", "must fix" → critical
   - "important", "significant", "should fix" → high
   - "consider", "might want to", "could improve" → medium/low
   - "minor", "nitpick", "suggestion" → low/info
4. **Set confidence**: Higher (0.8-1.0) for clear, explicit issues; lower (0.5-0.7) for inferred or ambiguous ones
5. **Don't duplicate**: Each distinct issue should appear once
6. **Handle empty reviews**: If no issues found, return \`findings: []\`

## Important

- DO NOT add findings not present in the review
- DO NOT interpret or expand on the reviewer's points
- If the review is empty or only contains praise, return empty findings array
- Always respond with valid YAML
- Use block scalars (|) for any text that might contain special characters or multiple lines
- The location.line field is important - always include it when mentioned in the review`;

/**
 * Build the user message for finding extraction
 */
export function buildExtractionUserMessage(
	reviewText: string,
	modelName: string,
): string {
	return `Extract all findings from this code review by ${modelName}:

---
${reviewText}
---

Respond with ONLY valid YAML. Use block scalars (|) for multi-line text. No markdown code blocks or explanatory text.`;
}

/**
 * System prompt for similarity comparison between findings
 */
export const SIMILARITY_SYSTEM_PROMPT = `You are a precise comparison system. Your task is to determine if two code review findings are about the same underlying issue.

## Output Format

Respond with valid JSON:
{
  "isSimilar": true | false,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why they are or aren't similar"
}

## Similarity Criteria

Two findings are SIMILAR if they:
1. Reference the same location (file + line range within ±5 lines)
2. Describe the same type of issue (same category)
3. Would be fixed by the same code change

Two findings are DIFFERENT if they:
1. Are about different files or distant code locations
2. Describe fundamentally different types of issues
3. Would require separate fixes

## Edge Cases

- Same file, different issues → NOT similar
- Same issue described differently → SIMILAR
- Related issues that would be fixed together → SIMILAR
- General advice vs specific issue → NOT similar (unless about same location)`;

/**
 * Build user message for similarity comparison
 */
export function buildSimilarityUserMessage(
	finding1: {
		title: string;
		description: string;
		location?: { file: string; line?: number };
	},
	finding2: {
		title: string;
		description: string;
		location?: { file: string; line?: number };
	},
): string {
	const loc1 = finding1.location
		? `${finding1.location.file}${finding1.location.line ? `:${finding1.location.line}` : ""}`
		: "no location";
	const loc2 = finding2.location
		? `${finding2.location.file}${finding2.location.line ? `:${finding2.location.line}` : ""}`
		: "no location";

	return `Compare these two findings:

**Finding 1** (${loc1}):
Title: ${finding1.title}
Description: ${finding1.description}

**Finding 2** (${loc2}):
Title: ${finding2.title}
Description: ${finding2.description}

Are these about the same underlying issue? Respond with JSON only.`;
}

/**
 * System prompt for disagreement analysis
 */
export const DISAGREEMENT_SYSTEM_PROMPT = `You are analyzing disagreements between code reviewers. Your task is to identify when reviewers have contradictory opinions about the same code.

## Output Format

Respond with valid JSON:
{
  "hasDisagreement": true | false,
  "topic": "What the disagreement is about",
  "positions": [
    {
      "model": "model-name",
      "stance": "Their position on the issue",
      "reasoning": "Why they hold this position"
    }
  ],
  "humanActionRequired": "Why a human should review this disagreement"
}

## Disagreement Detection

A disagreement exists when:
1. One reviewer says something is a problem, another says it's fine
2. Reviewers suggest contradictory fixes
3. Reviewers assign very different severities (e.g., critical vs info)
4. One reviewer explicitly praises what another criticizes

NOT a disagreement:
- One reviewer mentions something others don't (that's "silent", not disagreement)
- Different wording for the same assessment
- Different but compatible suggestions`;

/**
 * Build user message for disagreement analysis
 */
export function buildDisagreementUserMessage(
	findings: Array<{
		sourceModel: string;
		title: string;
		description: string;
		severity: string;
		suggestion?: string;
	}>,
): string {
	const findingsText = findings
		.map(
			(f) => `**${f.sourceModel}** (${f.severity}):
Title: ${f.title}
Description: ${f.description}
${f.suggestion ? `Suggestion: ${f.suggestion}` : ""}`,
		)
		.join("\n\n");

	return `Analyze these findings from different reviewers about the same code area:

${findingsText}

Do these reviewers disagree about anything significant? Respond with JSON only.`;
}
