/**
 * Prompt templates for Toyota Production System (TPS) audit
 * Analyzes codebases using lean manufacturing principles
 */

/**
 * The seven types of waste (Muda) in software development
 */
export type WasteType =
	| "defects" // Bugs, errors, rework
	| "overproduction" // Building features not needed
	| "waiting" // Blocking operations, slow tests
	| "non_utilized_talent" // Manual tasks that could be automated
	| "transportation" // Unnecessary data movement
	| "inventory" // Dead code, unused dependencies
	| "motion" // Context switching, cognitive overhead
	| "extra_processing"; // Over-engineering, premature optimization

/**
 * TPS Analysis output structure
 * AI must return JSON matching this interface
 */
// Allow both strings and rich objects for flexible model output
// biome-ignore lint/suspicious/noExplicitAny: Models return varied formats
type FlexibleItem = string | Record<string, any>;

export interface TpsAnalysis {
	scores: {
		overall: number; // 0-100
		flow: number; // 0-100
		waste: number; // 0-100 (higher = less waste)
		quality: number; // 0-100
	};
	flowAnalysis: {
		entryPoints: FlexibleItem[]; // Main entry files (string or {path, description})
		diagram: string; // ASCII flow diagram
		pathways: FlexibleItem[]; // Key data/control pathways (string or {name, from, to, bottlenecks})
		observations: FlexibleItem[]; // Flow observations
	};
	bottlenecks: Array<{
		id: string;
		severity: "critical" | "high" | "medium" | "low";
		location: string; // File:line or file path
		title: string;
		description: string;
		impact: string;
		suggestion: string;
	}>;
	waste: {
		[K in WasteType]?: Array<{
			location: string;
			description: string;
			suggestion: string;
			effort: "trivial" | "small" | "medium" | "large";
		}>;
	};
	jidoka: {
		// Built-in quality
		score: number;
		strengths: FlexibleItem[];
		weaknesses: FlexibleItem[];
	};
	recommendations: Array<{
		priority: number; // 1 = highest
		title: string;
		description: string;
		effort: "trivial" | "small" | "medium" | "large";
		impact: "low" | "medium" | "high" | "critical";
		category: "flow" | "waste" | "quality" | "automation" | "architecture";
	}>;
	summary: {
		strengths: FlexibleItem[];
		concerns: FlexibleItem[];
		quickWins: FlexibleItem[];
	};
}

export const SYSTEM_PROMPT = `You are an expert Toyota Production System (TPS) consultant analyzing software codebases. Your role is to "walk the production line" - examining how code flows from input to output, identifying waste (muda), spotting bottlenecks, and suggesting continuous improvement (kaizen).

## TPS Principles for Software

### 1. FLOW (Nagare)
Analyze how data and control flow through the system:
- Identify entry points and exit points
- Map the critical paths
- Look for smooth, uninterrupted flow
- Identify where flow is blocked or redirected
- Check for single-piece flow vs batch processing

### 2. WASTE (Muda) - The 7 Wastes in Software
Identify instances of each waste type:

**Defects**: Bugs, error-prone code, missing validation
**Overproduction**: Features nobody uses, over-engineered solutions
**Waiting**: Blocking I/O, synchronous when async would work, slow tests
**Non-utilized Talent**: Manual tasks that could be automated, repetitive code
**Transportation**: Unnecessary data transformation, excessive API calls
**Inventory**: Dead code, unused imports/exports, stale dependencies
**Motion**: Complex navigation, scattered related code, poor organization
**Extra-processing**: Premature optimization, unnecessary abstraction layers

### 3. BOTTLENECKS
Identify constraints that limit throughput:
- Synchronous operations that block
- Single points of failure
- Resource contention
- N+1 queries or API calls
- Sequential operations that could be parallel

### 4. PULL vs PUSH
Evaluate if work is demand-driven:
- Lazy evaluation vs eager computation
- On-demand loading vs preloading everything
- Event-driven vs polling
- Streaming vs buffering all data

### 5. JIDOKA (Built-in Quality)
Assess quality mechanisms:
- Error handling and recovery
- Validation at boundaries
- Fail-fast patterns
- Type safety usage
- Test coverage signals

### 6. STANDARDIZATION
Look for consistency:
- Code style consistency
- Pattern usage consistency
- Error handling patterns
- Naming conventions
- File organization

## Scoring Guidelines

**Overall Score (0-100)**:
- 90-100: Exceptional flow, minimal waste, excellent quality
- 70-89: Good practices, some waste, room for improvement
- 50-69: Average, significant waste or flow issues
- 30-49: Poor flow, excessive waste, quality concerns
- 0-29: Critical issues, major redesign needed

**Flow Score**: How smoothly does data/control move through the system?
**Waste Score**: Higher = less waste (100 = no waste identified)
**Quality Score**: Built-in quality mechanisms, error handling, type safety

## Output Requirements

You MUST respond with valid JSON matching the TpsAnalysis interface. Do not include any text before or after the JSON.

Focus on:
1. Actionable findings with specific file/line references
2. Prioritized recommendations (quick wins first)
3. Concrete suggestions, not vague advice
4. Balanced assessment - acknowledge strengths too
5. Effort estimates for recommendations`;

/**
 * Build the user message for TPS audit
 */
export function buildUserMessage(
	aggregatedContent: string,
	options?: {
		focusAreas?: string[];
		repoName?: string;
		additionalContext?: string;
	},
): string {
	const parts: string[] = [];

	if (options?.repoName) {
		parts.push(`## Repository: ${options.repoName}`);
	}

	if (options?.focusAreas && options.focusAreas.length > 0) {
		parts.push(
			`## Focus Areas\nPay special attention to: ${options.focusAreas.join(", ")}`,
		);
	}

	if (options?.additionalContext) {
		parts.push(`## Additional Context\n${options.additionalContext}`);
	}

	parts.push(`## Codebase to Audit

Analyze this codebase using Toyota Production System principles. Walk the production line from entry points through to outputs. Identify waste, bottlenecks, and improvement opportunities.

${aggregatedContent}

## Response Format

Respond with ONLY valid JSON matching the TpsAnalysis interface. Include:
- Scores for overall, flow, waste, and quality (0-100)
- Flow analysis with entry points and pathways
- Specific bottlenecks with locations and suggestions
- Waste items categorized by the 7 types
- Jidoka (built-in quality) assessment
- Prioritized recommendations
- Summary with strengths, concerns, and quick wins

Your JSON response:`);

	return parts.join("\n\n");
}

/**
 * System prompt for batch analysis - slightly modified to note partial view
 */
export const BATCH_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

IMPORTANT: You are analyzing a BATCH of files from a larger codebase. This is batch {{BATCH_INDEX}} of {{TOTAL_BATCHES}}.
- Focus on what you can observe in this batch
- Note any cross-cutting concerns you see
- Your analysis will be combined with other batches for a final report
- Score this batch independently based on what you observe`;

/**
 * Build the user message for a batch analysis
 */
export function buildBatchUserMessage(
	aggregatedContent: string,
	batchIndex: number,
	totalBatches: number,
	options?: {
		focusAreas?: string[];
		repoName?: string;
	},
): string {
	const baseMessage = buildUserMessage(aggregatedContent, options);
	return `[BATCH ${batchIndex + 1} of ${totalBatches}]\n\n${baseMessage}`;
}

/**
 * System prompt for synthesizing multiple batch analyses into a final report
 */
export const SYNTHESIS_SYSTEM_PROMPT = `You are a TPS (Toyota Production System) consultant synthesizing multiple batch analyses of a codebase into a unified report.

You will receive multiple TPS analysis JSON objects, each analyzing a different portion of the codebase. Your job is to:

1. **Aggregate Scores**: Calculate weighted averages based on batch sizes
2. **Merge Findings**: Combine bottlenecks, waste items, and recommendations, removing duplicates
3. **Identify Patterns**: Note patterns that appear across multiple batches
4. **Prioritize**: Re-prioritize recommendations based on the full picture
5. **Synthesize Summary**: Create a cohesive summary of the entire codebase

Output a single unified TpsAnalysis JSON that represents the whole codebase.

Guidelines:
- If multiple batches mention the same issue, increase its priority
- Cross-batch patterns are often more important than single-batch issues
- Flow analysis should try to connect entry points across batches
- Be concise - don't repeat the same finding multiple times
- Final scores should reflect the overall health, not just average`;

/**
 * Build the synthesis user message
 */
export function buildSynthesisUserMessage(
	batchResults: Array<{
		batchIndex: number;
		tokenCount: number;
		analysis: TpsAnalysis | null;
		rawResponse: string;
	}>,
	repoName?: string,
): string {
	const parts: string[] = [];

	if (repoName) {
		parts.push(`## Repository: ${repoName}`);
	}

	parts.push(`## Batch Analyses to Synthesize

You have ${batchResults.length} batch analyses to combine into a final report.`);

	for (const batch of batchResults) {
		parts.push(
			`### Batch ${batch.batchIndex + 1} (~${batch.tokenCount} tokens)`,
		);
		if (batch.analysis) {
			parts.push("```json");
			parts.push(JSON.stringify(batch.analysis, null, 2));
			parts.push("```");
		} else {
			parts.push("*Analysis failed to parse. Raw response:*");
			parts.push(
				batch.rawResponse.substring(0, 1000) +
					(batch.rawResponse.length > 1000 ? "..." : ""),
			);
		}
	}

	parts.push(`## Response Format

Synthesize all batches into a single unified TpsAnalysis JSON.
- Combine and deduplicate findings
- Recalculate overall scores based on all batches
- Prioritize issues that appear in multiple batches
- Create a cohesive summary

Your unified JSON response:`);

	return parts.join("\n\n");
}

/**
 * Parse the TPS analysis from model response
 * Handles markdown code blocks and validates structure
 * Normalizes different response formats to standard TpsAnalysis
 */
export function parseTpsAnalysis(response: string): TpsAnalysis | null {
	try {
		// Remove markdown code blocks if present
		let jsonStr = response.trim();

		if (jsonStr.startsWith("```json")) {
			jsonStr = jsonStr.slice(7);
		} else if (jsonStr.startsWith("```")) {
			jsonStr = jsonStr.slice(3);
		}

		if (jsonStr.endsWith("```")) {
			jsonStr = jsonStr.slice(0, -3);
		}

		jsonStr = jsonStr.trim();

		const raw = JSON.parse(jsonStr) as Record<string, unknown>;

		// Normalize scores - models return in different formats
		const scores = normalizeScores(raw);
		if (!scores) {
			return null;
		}

		// Build normalized analysis
		const analysis: TpsAnalysis = {
			scores,
			flowAnalysis: normalizeFlowAnalysis(raw),
			bottlenecks: normalizeBottlenecks(raw),
			waste: normalizeWaste(raw),
			jidoka: normalizeJidoka(raw),
			recommendations: normalizeRecommendations(raw),
			summary: normalizeSummary(raw),
		};

		return analysis;
	} catch {
		return null;
	}
}

/**
 * Normalize scores from various model formats
 */
function normalizeScores(
	raw: Record<string, unknown>,
): TpsAnalysis["scores"] | null {
	// Format 1: scores object with named fields
	if (raw.scores && typeof raw.scores === "object") {
		const s = raw.scores as Record<string, unknown>;
		return {
			overall: toNumber(s.overall) ?? toNumber(raw.overallScore) ?? 0,
			flow: toNumber(s.flow) ?? 0,
			waste: toNumber(s.waste) ?? 0,
			quality: toNumber(s.quality) ?? 0,
		};
	}

	// Format 2: flat fields like overallScore, flowScore, etc.
	if (typeof raw.overallScore === "number" || typeof raw.overall === "number") {
		return {
			overall: toNumber(raw.overallScore) ?? toNumber(raw.overall) ?? 0,
			flow: toNumber(raw.flowScore) ?? toNumber(raw.flow) ?? 0,
			waste: toNumber(raw.wasteScore) ?? toNumber(raw.waste) ?? 0,
			quality: toNumber(raw.qualityScore) ?? toNumber(raw.quality) ?? 0,
		};
	}

	return null;
}

function toNumber(val: unknown): number | null {
	if (typeof val === "number") return val;
	if (typeof val === "string") {
		const n = parseFloat(val);
		return isNaN(n) ? null : n;
	}
	return null;
}

function normalizeFlowAnalysis(
	raw: Record<string, unknown>,
): TpsAnalysis["flowAnalysis"] {
	const flow = raw.flowAnalysis as Record<string, unknown> | undefined;
	if (!flow) {
		return { entryPoints: [], diagram: "", pathways: [], observations: [] };
	}

	return {
		entryPoints: normalizeStringArray(flow.entryPoints) as FlexibleItem[],
		diagram: typeof flow.diagram === "string" ? flow.diagram : "",
		pathways: normalizeStringArray(flow.pathways) as FlexibleItem[],
		observations: normalizeStringArray(flow.observations) as FlexibleItem[],
	};
}

function normalizeWaste(raw: Record<string, unknown>): TpsAnalysis["waste"] {
	const waste = raw.waste as Record<string, unknown> | undefined;
	if (!waste || typeof waste !== "object") {
		return {};
	}
	// Return as-is since it's a mapped type
	return waste as TpsAnalysis["waste"];
}

function normalizeJidoka(raw: Record<string, unknown>): TpsAnalysis["jidoka"] {
	const jidoka = raw.jidoka as Record<string, unknown> | undefined;
	if (!jidoka) {
		return { score: 0, strengths: [], weaknesses: [] };
	}

	return {
		score: toNumber(jidoka.score) ?? 0,
		strengths: normalizeStringArray(jidoka.strengths) as FlexibleItem[],
		weaknesses: normalizeStringArray(jidoka.weaknesses) as FlexibleItem[],
	};
}

function normalizeBottlenecks(
	raw: Record<string, unknown>,
): TpsAnalysis["bottlenecks"] {
	const bottlenecks = raw.bottlenecks;
	if (Array.isArray(bottlenecks)) {
		return bottlenecks as TpsAnalysis["bottlenecks"];
	}
	return [];
}

function normalizeRecommendations(
	raw: Record<string, unknown>,
): TpsAnalysis["recommendations"] {
	const recs = raw.recommendations;
	if (Array.isArray(recs)) {
		return recs as TpsAnalysis["recommendations"];
	}
	return [];
}

function normalizeSummary(
	raw: Record<string, unknown>,
): TpsAnalysis["summary"] {
	const summary = raw.summary as Record<string, unknown> | undefined;
	if (!summary) {
		return { strengths: [], concerns: [], quickWins: [] };
	}

	return {
		strengths: normalizeStringArray(summary.strengths) as FlexibleItem[],
		concerns: normalizeStringArray(summary.concerns) as FlexibleItem[],
		quickWins: normalizeStringArray(summary.quickWins) as FlexibleItem[],
	};
}

/**
 * Normalize array values - keep objects as-is for rich formatting in templates
 * The HTML template has smart formatters that handle both strings and objects
 */
function normalizeStringArray(val: unknown): unknown[] {
	if (Array.isArray(val)) {
		return val;
	}
	return [];
}
