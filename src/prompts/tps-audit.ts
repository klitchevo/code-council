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
export interface TpsAnalysis {
	scores: {
		overall: number; // 0-100
		flow: number; // 0-100
		waste: number; // 0-100 (higher = less waste)
		quality: number; // 0-100
	};
	flowAnalysis: {
		entryPoints: string[]; // Main entry files
		diagram: string; // ASCII flow diagram
		pathways: string[]; // Key data/control pathways
		observations: string[]; // Flow observations
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
		strengths: string[];
		weaknesses: string[];
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
		strengths: string[];
		concerns: string[];
		quickWins: string[];
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
 * Parse the TPS analysis from model response
 * Handles markdown code blocks and validates structure
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

		const parsed = JSON.parse(jsonStr) as TpsAnalysis;

		// Basic validation
		if (
			typeof parsed.scores?.overall !== "number" ||
			!Array.isArray(parsed.bottlenecks) ||
			!Array.isArray(parsed.recommendations)
		) {
			return null;
		}

		return parsed;
	} catch {
		return null;
	}
}
