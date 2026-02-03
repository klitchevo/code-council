/**
 * Review command handler for CLI mode
 * Handles all review subcommands: code, git, frontend, backend, plan
 */

import { initializeConfig } from "../../config";
import {
	buildConsensusReport,
	formatForHostExtraction,
} from "../../consensus/builder";
import { mapClustersToComments } from "../../consensus/comment-mapper";
import { ConsensusClient } from "../../consensus/consensus-client";
import {
	formatPrComments,
	serializePrReview,
} from "../../consensus/pr-comment-formatter";
import type { ModelReviewResult } from "../../review-client";
import { ReviewClient } from "../../review-client";
import { handleGitReview } from "../../tools/review-git";
import { parseUnifiedDiff } from "../../utils/diff-parser";
import { getInput } from "../input";
import {
	type BackendReviewType,
	type CliResult,
	ExitCode,
	type FrontendReviewType,
	type GitReviewType,
	type OutputFormat,
	type ParsedCliArgs,
	type PlanReviewType,
	type ReviewType,
} from "../types";

/**
 * Default models if none specified via CLI
 */
const DEFAULT_CLI_MODELS = [
	"minimax/minimax-m2.1",
	"z-ai/glm-4.7",
	"moonshotai/kimi-k2.5",
	"deepseek/deepseek-v3.2",
];

/**
 * Show help for review command
 */
function showReviewHelp(): CliResult {
	return {
		exitCode: ExitCode.SUCCESS,
		stdout: `
Code Council CLI - Multi-model AI code review

Usage: npx @klitchevo/code-council review <type> [options]

Review Types:
  code       Review code from stdin or file
  git        Review git changes (staged, unstaged, diff, commit)
  frontend   Frontend-focused review (accessibility, performance, UX)
  backend    Backend-focused review (security, performance, architecture)
  plan       Review implementation plans before coding

Common Options:
  --models "<m1>,<m2>"    Override default models (comma-separated)
  --format <format>       Output format: markdown (default), json, html, pr-comments
  --context "<text>"      Additional context for the review
  --file <path>           Read input from file instead of stdin
  --help, -h              Show this help message

Git Review Options:
  --review-type <type>    staged (default), unstaged, diff, commit
  --commit <hash>         Commit hash (required for commit review type)

Frontend Review Options:
  --framework <name>      Framework: react, vue, svelte, etc.
  --review-type <type>    full (default), accessibility, performance, ux

Backend Review Options:
  --language <name>       Language: node, python, go, rust, etc.
  --review-type <type>    full (default), security, performance, architecture

Plan Review Options:
  --review-type <type>    full (default), feasibility, completeness, risks, timeline

Code Review Options:
  --language <name>       Programming language of the code

Examples:
  # Review git changes (staged by default)
  npx @klitchevo/code-council review git

  # Review git diff against main branch
  npx @klitchevo/code-council review git --review-type diff

  # Review code from stdin
  echo "function foo() {}" | npx @klitchevo/code-council review code

  # Review code from file with custom models
  npx @klitchevo/code-council review code --file src/main.ts \\
    --models "anthropic/claude-sonnet-4.5,openai/gpt-4o"

  # Frontend review with framework context
  cat Component.tsx | npx @klitchevo/code-council review frontend \\
    --framework react --review-type accessibility

  # Review implementation plan
  cat PLAN.md | npx @klitchevo/code-council review plan --context "New auth system"

Environment Variables:
  OPENROUTER_API_KEY      Required. Your OpenRouter API key.
`.trim(),
	};
}

/**
 * Parse models from comma-separated string
 */
function parseModels(modelsArg: string | undefined): string[] {
	if (!modelsArg) {
		return DEFAULT_CLI_MODELS;
	}
	const models = modelsArg
		.split(",")
		.map((m) => m.trim())
		.filter((m) => m.length > 0);
	return models.length > 0 ? models : DEFAULT_CLI_MODELS;
}

/**
 * Handle review command
 */
export async function handleReviewCommand(
	args: ParsedCliArgs,
): Promise<CliResult> {
	const { subcommand, options } = args;

	// Show help
	if (options.help || options.h || !subcommand) {
		return showReviewHelp();
	}

	// Validate API key
	const apiKey = process.env.OPENROUTER_API_KEY;
	if (!apiKey) {
		return {
			exitCode: ExitCode.API_ERROR,
			stderr:
				"Error: OPENROUTER_API_KEY environment variable is required.\n" +
				"Set it in your environment or GitHub Actions secrets.",
		};
	}

	// Initialize config (loads from file if exists)
	await initializeConfig();

	// Parse common options
	const models = parseModels(options.models as string | undefined);
	const format = (options.format as OutputFormat) || "markdown";
	const context = options.context as string | undefined;
	const filePath = options.file as string | undefined;

	// Create review client
	const client = new ReviewClient(apiKey);

	try {
		// Route to appropriate handler
		switch (subcommand as ReviewType) {
			case "code":
				return handleCliCodeReview(
					client,
					models,
					format,
					context,
					filePath,
					options,
				);

			case "git":
				return handleCliGitReview(client, models, format, context, options);

			case "frontend":
				return handleCliFrontendReview(
					client,
					models,
					format,
					context,
					filePath,
					options,
				);

			case "backend":
				return handleCliBackendReview(
					client,
					models,
					format,
					context,
					filePath,
					options,
				);

			case "plan":
				return handleCliPlanReview(
					client,
					models,
					format,
					context,
					filePath,
					options,
				);

			default:
				return {
					exitCode: ExitCode.INVALID_ARGS,
					stderr: `Error: Unknown review type: ${subcommand}\nRun 'code-council review --help' for usage.`,
				};
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return {
			exitCode: ExitCode.API_ERROR,
			stderr: `Error: ${message}`,
		};
	}
}

/**
 * Handle code review via CLI
 * Calls ReviewClient directly to use CLI-specified models
 */
async function handleCliCodeReview(
	client: ReviewClient,
	models: string[],
	format: OutputFormat,
	context: string | undefined,
	filePath: string | undefined,
	options: Record<string, string | boolean | string[]>,
): Promise<CliResult> {
	// Get input
	const inputResult = await getInput(filePath);
	if (typeof inputResult !== "string") {
		return inputResult;
	}

	const language = options.language as string | undefined;
	const fullContext = language
		? `Language: ${language}${context ? `\n${context}` : ""}`
		: context;

	// Call ReviewClient directly with CLI models
	const results = await client.reviewCode(inputResult, models, fullContext);

	return formatReviewOutput(results, format);
}

/**
 * Handle git review via CLI
 */
async function handleCliGitReview(
	client: ReviewClient,
	models: string[],
	format: OutputFormat,
	context: string | undefined,
	options: Record<string, string | boolean | string[]>,
): Promise<CliResult> {
	const reviewType = (options["review-type"] as GitReviewType) || "staged";
	const commitHash = options.commit as string | undefined;

	// Validate commit hash for commit review type
	if (reviewType === "commit" && !commitHash) {
		return {
			exitCode: ExitCode.INVALID_ARGS,
			stderr:
				"Error: --commit <hash> is required when --review-type is 'commit'",
		};
	}

	// handleGitReview already accepts models as parameter
	const result = await handleGitReview(client, models, {
		review_type: reviewType,
		commit_hash: commitHash,
		context,
		output_format: format,
	});

	// Handle pr-comments format specially - needs consensus building
	if (format === "pr-comments") {
		return formatPrCommentsOutput(result.results, result.diffText, client);
	}

	return formatReviewOutput(result.results, format);
}

/**
 * Handle frontend review via CLI
 * Calls ReviewClient directly to use CLI-specified models
 */
async function handleCliFrontendReview(
	client: ReviewClient,
	models: string[],
	format: OutputFormat,
	context: string | undefined,
	filePath: string | undefined,
	options: Record<string, string | boolean | string[]>,
): Promise<CliResult> {
	// Get input
	const inputResult = await getInput(filePath);
	if (typeof inputResult !== "string") {
		return inputResult;
	}

	const framework = options.framework as string | undefined;
	const reviewType = (options["review-type"] as FrontendReviewType) || "full";

	// Call ReviewClient directly with CLI models
	const results = await client.reviewFrontend(inputResult, models, {
		framework,
		reviewType,
		context,
	});

	return formatReviewOutput(results, format);
}

/**
 * Handle backend review via CLI
 * Calls ReviewClient directly to use CLI-specified models
 */
async function handleCliBackendReview(
	client: ReviewClient,
	models: string[],
	format: OutputFormat,
	context: string | undefined,
	filePath: string | undefined,
	options: Record<string, string | boolean | string[]>,
): Promise<CliResult> {
	// Get input
	const inputResult = await getInput(filePath);
	if (typeof inputResult !== "string") {
		return inputResult;
	}

	const language = options.language as string | undefined;
	const reviewType = (options["review-type"] as BackendReviewType) || "full";

	// Call ReviewClient directly with CLI models
	const results = await client.reviewBackend(inputResult, models, {
		language,
		reviewType,
		context,
	});

	return formatReviewOutput(results, format);
}

/**
 * Handle plan review via CLI
 * Calls ReviewClient directly to use CLI-specified models
 */
async function handleCliPlanReview(
	client: ReviewClient,
	models: string[],
	format: OutputFormat,
	context: string | undefined,
	filePath: string | undefined,
	options: Record<string, string | boolean | string[]>,
): Promise<CliResult> {
	// Get input
	const inputResult = await getInput(filePath);
	if (typeof inputResult !== "string") {
		return inputResult;
	}

	const reviewType = (options["review-type"] as PlanReviewType) || "full";

	// Call ReviewClient directly with CLI models
	const results = await client.reviewPlan(inputResult, models, {
		reviewType,
		context,
	});

	return formatReviewOutput(results, format);
}

/**
 * Format review results for CLI output
 * Uses host extraction format for consistent multi-model output
 */
function formatReviewOutput(
	results: Array<{ model: string; review: string; error?: string }>,
	format: OutputFormat,
): CliResult {
	// Use the existing formatForHostExtraction which produces nice output
	const { formatted } = formatForHostExtraction(results, format);

	return {
		exitCode: ExitCode.SUCCESS,
		stdout: formatted,
	};
}

/**
 * Format review results as GitHub PR comments
 * Builds full consensus report and maps findings to diff lines
 */
async function formatPrCommentsOutput(
	results: ModelReviewResult[],
	diffText: string,
	reviewClient: ReviewClient,
): Promise<CliResult> {
	// 1. Build full consensus report (not host extraction)
	const consensusClient = new ConsensusClient(reviewClient);
	const { report } = await buildConsensusReport(results, consensusClient, {
		outputFormat: "json", // Internal format, we'll reformat for PR
	});

	// 2. Parse diff to get changed lines
	const parsedDiff = parseUnifiedDiff(diffText);

	// 3. Collect all finding clusters
	const allClusters = [
		...report.highConfidence,
		...report.moderateConfidence,
		...report.lowConfidence,
	];

	// 4. Map findings to diff line positions
	const mappingResult = mapClustersToComments(allClusters, parsedDiff);

	// 5. Format as GitHub API JSON
	const prReview = formatPrComments(report, mappingResult);

	return {
		exitCode: ExitCode.SUCCESS,
		stdout: serializePrReview(prReview),
	};
}
