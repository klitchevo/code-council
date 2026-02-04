/**
 * Setup command handler for CLI mode
 * Generates GitHub Actions workflow and other setup files
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type CliResult, ExitCode, type ParsedCliArgs } from "../types";

/**
 * GitHub Actions workflow template for pr-comments format
 */
const WORKFLOW_TEMPLATE = `# Code Council PR Review
# Multi-model AI code review for pull requests

name: Code Council Review

on:
  pull_request:
    types: [opened, synchronize, ready_for_review, reopened]

# Prevent concurrent reviews on the same PR
concurrency:
  group: code-council-\${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  review:
    runs-on: ubuntu-latest
    if: github.event.pull_request.draft == false
    permissions:
      contents: read
      pull-requests: write
    timeout-minutes: 10

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Fetch base branch
        run: git fetch origin \${{ github.base_ref }}:\${{ github.base_ref }} || true

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run Code Council Review
        id: review
        env:
          OPENROUTER_API_KEY: \${{ secrets.OPENROUTER_API_KEY }}
        run: |
          # Run review with pr-comments format for inline comments
          if npx @klitchevo/code-council review git \\
              --review-type diff \\
              --format pr-comments > review.json; then
            echo "format=pr-comments" >> $GITHUB_OUTPUT
            echo "has_review=true" >> $GITHUB_OUTPUT
          else
            echo "pr-comments format failed, falling back to markdown"
            if npx @klitchevo/code-council review git \\
                --review-type diff \\
                --format markdown > review.md; then
              echo "format=markdown" >> $GITHUB_OUTPUT
              echo "has_review=true" >> $GITHUB_OUTPUT
            else
              echo "has_review=false" >> $GITHUB_OUTPUT
            fi
          fi

      - name: Clean Previous Code Council Reviews
        if: steps.review.outputs.has_review == 'true' && steps.review.outputs.format == 'pr-comments'
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          # Dismiss pending reviews to avoid "only one pending review" error
          gh api repos/\${{ github.repository }}/pulls/\${{ github.event.pull_request.number }}/reviews \\
            --jq '.[] | select(.state == "PENDING") | .id' | \\
          while read REVIEW_ID; do
            gh api repos/\${{ github.repository }}/pulls/\${{ github.event.pull_request.number }}/reviews/$REVIEW_ID \\
              --method DELETE 2>/dev/null || true
          done

          # Delete previous Code Council comments
          gh api repos/\${{ github.repository }}/pulls/\${{ github.event.pull_request.number }}/comments \\
            --jq '.[] | select(.body | contains("[CRITICAL]") or contains("[HIGH]") or contains("[MEDIUM]")) | .id' | \\
          while read COMMENT_ID; do
            gh api repos/\${{ github.repository }}/pulls/\${{ github.event.pull_request.number }}/comments/$COMMENT_ID \\
              --method DELETE 2>/dev/null || true
          done

      - name: Post Inline Review
        if: steps.review.outputs.has_review == 'true' && steps.review.outputs.format == 'pr-comments'
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          # Validate JSON
          if ! jq . review.json > /dev/null 2>&1; then
            echo "Invalid JSON in review.json"
            cat review.json
            exit 1
          fi

          # Try batch review first
          if gh api repos/\${{ github.repository }}/pulls/\${{ github.event.pull_request.number }}/reviews \\
              --method POST \\
              --input review.json 2>/dev/null; then
            echo "Review posted successfully"
          else
            echo "Batch review failed, falling back to individual comments"

            # Post summary as standalone review
            SUMMARY_BODY=$(jq -r '.body' review.json)
            gh api repos/\${{ github.repository }}/pulls/\${{ github.event.pull_request.number }}/reviews \\
              --method POST \\
              -f body="$SUMMARY_BODY" \\
              -f event="COMMENT" || true

            # Post individual inline comments
            COMMENT_COUNT=$(jq '.comments | length' review.json)
            for i in $(seq 0 $((COMMENT_COUNT - 1))); do
              PATH_VAL=$(jq -r ".comments[$i].path" review.json)
              LINE_VAL=$(jq -r ".comments[$i].line" review.json)
              BODY_VAL=$(jq -r ".comments[$i].body" review.json)

              gh api repos/\${{ github.repository }}/pulls/\${{ github.event.pull_request.number }}/comments \\
                --method POST \\
                -f path="$PATH_VAL" \\
                -F line="$LINE_VAL" \\
                -f body="$BODY_VAL" \\
                -f commit_id="\${{ github.event.pull_request.head.sha }}" 2>/dev/null || true
            done
          fi

      - name: Post Markdown Review (Fallback)
        if: steps.review.outputs.has_review == 'true' && steps.review.outputs.format == 'markdown'
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          REVIEW_BODY=$(cat review.md)
          gh api repos/\${{ github.repository }}/pulls/\${{ github.event.pull_request.number }}/reviews \\
            --method POST \\
            -f body="## Code Council Multi-Model Review

          $REVIEW_BODY

          ---
          *Reviewed by [Code Council](https://github.com/klitchevo/code-council)*" \\
            -f event="COMMENT"
`;

/**
 * Simple markdown-only workflow (no inline comments)
 */
const WORKFLOW_TEMPLATE_SIMPLE = `# Code Council PR Review
# Multi-model AI code review for pull requests

name: Code Council Review

on:
  pull_request:
    types: [opened, synchronize, ready_for_review, reopened]

concurrency:
  group: code-council-\${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  review:
    runs-on: ubuntu-latest
    if: github.event.pull_request.draft == false
    permissions:
      contents: read
      pull-requests: write
    timeout-minutes: 10

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Fetch base branch
        run: git fetch origin \${{ github.base_ref }}:\${{ github.base_ref }} || true

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run Code Council Review
        id: review
        env:
          OPENROUTER_API_KEY: \${{ secrets.OPENROUTER_API_KEY }}
        run: |
          npx @klitchevo/code-council review git \\
            --review-type diff \\
            --format markdown \\
            > review.md

          if [ -s review.md ]; then
            echo "has_review=true" >> $GITHUB_OUTPUT
          else
            echo "has_review=false" >> $GITHUB_OUTPUT
          fi

      - name: Post Review
        if: steps.review.outputs.has_review == 'true'
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          REVIEW_BODY=$(cat review.md)
          gh api repos/\${{ github.repository }}/pulls/\${{ github.event.pull_request.number }}/reviews \\
            --method POST \\
            -f body="## Code Council Review

          $REVIEW_BODY

          ---
          *Reviewed by [Code Council](https://github.com/klitchevo/code-council)*" \\
            -f event="COMMENT"
`;

/**
 * Show help for setup command
 */
function showSetupHelp(): CliResult {
	return {
		exitCode: ExitCode.SUCCESS,
		stdout: `
Code Council CLI - Setup Commands

Usage: npx @klitchevo/code-council setup <subcommand> [options]

Subcommands:
  workflow        Generate GitHub Actions workflow for PR reviews

Workflow Options:
  --simple        Use simple markdown format (no inline comments)
  --force, -f     Overwrite existing workflow file
  --path <dir>    Custom path for workflow (default: .github/workflows)

Examples:
  # Generate workflow with inline PR comments
  npx @klitchevo/code-council setup workflow

  # Generate simple markdown-only workflow
  npx @klitchevo/code-council setup workflow --simple

  # Overwrite existing workflow
  npx @klitchevo/code-council setup workflow --force

After setup:
  1. Add OPENROUTER_API_KEY to your repository secrets
  2. Open a pull request to see Code Council in action
`.trim(),
	};
}

/**
 * Handle setup workflow subcommand
 */
function handleSetupWorkflow(
	options: Record<string, string | boolean | string[]>,
): CliResult {
	const useSimple = options.simple === true;
	const force = options.force === true || options.f === true;
	const customPath = options.path as string | undefined;

	// Determine workflow directory
	const workflowDir = customPath || join(process.cwd(), ".github", "workflows");
	const workflowPath = join(workflowDir, "code-council-review.yml");

	// Check if file exists
	if (existsSync(workflowPath) && !force) {
		return {
			exitCode: ExitCode.ERROR,
			stderr: `Workflow file already exists: ${workflowPath}\nUse --force to overwrite.`,
		};
	}

	// Create directory if needed
	if (!existsSync(workflowDir)) {
		mkdirSync(workflowDir, { recursive: true });
	}

	// Write workflow file
	const template = useSimple ? WORKFLOW_TEMPLATE_SIMPLE : WORKFLOW_TEMPLATE;
	writeFileSync(workflowPath, template);

	const formatType = useSimple ? "markdown" : "inline PR comments";

	return {
		exitCode: ExitCode.SUCCESS,
		stdout: `Created GitHub Actions workflow: ${workflowPath}

Format: ${formatType}

Next steps:
  1. Add OPENROUTER_API_KEY to your repository secrets:
     Settings > Secrets and variables > Actions > New repository secret

  2. Commit and push the workflow file:
     git add ${workflowPath}
     git commit -m "feat: add Code Council PR review workflow"
     git push

  3. Open a pull request to see Code Council in action!
`,
	};
}

/**
 * Handle setup command
 */
export async function handleSetupCommand(
	args: ParsedCliArgs,
): Promise<CliResult> {
	const { subcommand, options } = args;

	// Show help
	if (options.help || options.h || !subcommand) {
		return showSetupHelp();
	}

	switch (subcommand) {
		case "workflow":
			return handleSetupWorkflow(options);

		default:
			return {
				exitCode: ExitCode.INVALID_ARGS,
				stderr: `Unknown setup subcommand: ${subcommand}\nRun 'code-council setup --help' for usage.`,
			};
	}
}
