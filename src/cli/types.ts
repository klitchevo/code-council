/**
 * CLI types and constants for Code Council CLI mode
 */

/**
 * Exit codes for CLI operations
 * Following standard conventions for shell scripts
 */
export const ExitCode = {
	/** Successful execution */
	SUCCESS: 0,
	/** General error */
	ERROR: 1,
	/** No input provided */
	NO_INPUT: 2,
	/** API error (OpenRouter failure, etc.) */
	API_ERROR: 3,
	/** Invalid arguments */
	INVALID_ARGS: 4,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

/**
 * Supported review types for the CLI
 */
export type ReviewType = "code" | "git" | "frontend" | "backend" | "plan";

/**
 * Git review subtypes
 */
export type GitReviewType = "staged" | "unstaged" | "diff" | "commit";

/**
 * Output formats for review results
 */
export type OutputFormat = "markdown" | "json" | "html";

/**
 * Frontend review focus areas
 */
export type FrontendReviewType =
	| "accessibility"
	| "performance"
	| "ux"
	| "full";

/**
 * Backend review focus areas
 */
export type BackendReviewType =
	| "security"
	| "performance"
	| "architecture"
	| "full";

/**
 * Plan review focus areas
 */
export type PlanReviewType =
	| "feasibility"
	| "completeness"
	| "risks"
	| "timeline"
	| "full";

/**
 * Common CLI options shared across commands
 */
export interface CommonCliOptions {
	/** Override default models (comma-separated) */
	models?: string[];
	/** Output format */
	format: OutputFormat;
	/** Additional context for the review */
	context?: string;
	/** Path to input file (alternative to stdin) */
	file?: string;
	/** Show help */
	help?: boolean;
}

/**
 * Options specific to git review
 */
export interface GitReviewCliOptions extends CommonCliOptions {
	/** Type of git review */
	reviewType: GitReviewType;
	/** Commit hash for commit review type */
	commit?: string;
}

/**
 * Options specific to frontend review
 */
export interface FrontendReviewCliOptions extends CommonCliOptions {
	/** Frontend framework */
	framework?: string;
	/** Review focus area */
	reviewType: FrontendReviewType;
}

/**
 * Options specific to backend review
 */
export interface BackendReviewCliOptions extends CommonCliOptions {
	/** Programming language */
	language?: string;
	/** Review focus area */
	reviewType: BackendReviewType;
}

/**
 * Options specific to plan review
 */
export interface PlanReviewCliOptions extends CommonCliOptions {
	/** Review focus area */
	reviewType: PlanReviewType;
}

/**
 * Options specific to code review
 */
export interface CodeReviewCliOptions extends CommonCliOptions {
	/** Programming language */
	language?: string;
}

/**
 * Parsed CLI arguments structure
 */
export interface ParsedCliArgs {
	/** The command (e.g., "review", "init") */
	command: string;
	/** The subcommand (e.g., "code", "git", "frontend") */
	subcommand?: string;
	/** Named options parsed from flags */
	options: Record<string, string | boolean | string[]>;
	/** Positional arguments */
	positional: string[];
}

/**
 * Result from CLI execution
 */
export interface CliResult {
	/** Exit code to return */
	exitCode: ExitCodeValue;
	/** Output to write to stdout (if any) */
	stdout?: string;
	/** Error message to write to stderr (if any) */
	stderr?: string;
}
