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
          npx @klitchevo/code-council review git \\
            --review-type diff \\
            --format pr-comments \\
            > review.json 2>&1 || {
              # If pr-comments fails, fall back to markdown format
              echo "pr-comments format failed, falling back to markdown"
              npx @klitchevo/code-council review git \\
                --review-type diff \\
                --format markdown \\
                > review.md
              echo "format=markdown" >> $GITHUB_OUTPUT
              if [ -s review.md ]; then
                echo "has_review=true" >> $GITHUB_OUTPUT
              else
                echo "has_review=false" >> $GITHUB_OUTPUT
              fi
              exit 0
            }

          # Check if review JSON has content
          if [ -s review.json ] && [ "$(cat review.json | head -c 10)" != "Error" ]; then
            echo "has_review=true" >> $GITHUB_OUTPUT
            echo "format=pr-comments" >> $GITHUB_OUTPUT
          else
            echo "has_review=false" >> $GITHUB_OUTPUT
          fi

      - name: Post Inline Review
        if: steps.review.outputs.has_review == 'true' && steps.review.outputs.format == 'pr-comments'
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          # Post PR review with inline comments
          gh api repos/\${{ github.repository }}/pulls/\${{ github.event.pull_request.number }}/reviews \\
            --method POST \\
            --input review.json

      - name: Post Markdown Review (Fallback)
        if: steps.review.outputs.has_review == 'true' && steps.review.outputs.format == 'markdown'
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          # Read review content
          REVIEW_BODY=$(cat review.md)

          # Add header and footer
          FULL_REVIEW="## Code Council Multi-Model Review

          $REVIEW_BODY

          ---
          *Reviewed by [Code Council](https://github.com/klitchevo/code-council) using multiple AI models*"

          # Post as a PR review (not just a comment)
          gh api repos/\${{ github.repository }}/pulls/\${{ github.event.pull_request.number }}/reviews \\
            --method POST \\
            -f body="$FULL_REVIEW" \\
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
