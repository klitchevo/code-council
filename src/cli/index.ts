/**
 * CLI entry point and router for Code Council
 * Handles command parsing and routes to appropriate handlers
 */

import { handleReviewCommand } from "./commands/review";
import { handleSetupCommand } from "./commands/setup";
import { type CliResult, ExitCode, type ParsedCliArgs } from "./types";

/**
 * Parse CLI arguments into structured format
 */
export function parseArgs(argv: string[]): ParsedCliArgs {
	const args = argv.slice(2); // Skip node and script path
	const command = args[0] || "";
	const subcommand = args[1] && !args[1].startsWith("-") ? args[1] : undefined;

	const options: Record<string, string | boolean | string[]> = {};
	const positional: string[] = [];

	// Start parsing from after command (and subcommand if present)
	const startIdx = subcommand ? 2 : 1;

	for (let i = startIdx; i < args.length; i++) {
		const arg = args[i];
		if (!arg) continue;

		if (arg.startsWith("--")) {
			const key = arg.slice(2);
			if (!key) continue;

			// Check for --key=value format
			const eqIdx = key.indexOf("=");
			if (eqIdx !== -1) {
				const k = key.slice(0, eqIdx);
				const v = key.slice(eqIdx + 1);
				options[k] = v;
			} else {
				// Check if next arg is a value
				const nextArg = args[i + 1];
				if (nextArg && !nextArg.startsWith("-")) {
					options[key] = nextArg;
					i++;
				} else {
					options[key] = true;
				}
			}
		} else if (arg.startsWith("-") && arg.length === 2) {
			// Short flag like -h
			const key = arg.slice(1);
			const nextArg = args[i + 1];
			if (nextArg && !nextArg.startsWith("-")) {
				options[key] = nextArg;
				i++;
			} else {
				options[key] = true;
			}
		} else {
			positional.push(arg);
		}
	}

	return { command, subcommand, options, positional };
}

/**
 * Show main help
 */
function showHelp(): CliResult {
	return {
		exitCode: ExitCode.SUCCESS,
		stdout: `
Code Council - Multi-model AI code review CLI

Usage: npx @klitchevo/code-council <command> [options]

Commands:
  review <type>   Run a multi-model code review
  setup workflow  Generate GitHub Actions workflow for PR reviews
  init            Generate a configuration file
  (none)          Start the MCP server (requires OPENROUTER_API_KEY)

Review Types:
  code            Review code from stdin or file
  git             Review git changes
  frontend        Frontend-focused review
  backend         Backend-focused review
  plan            Review implementation plans

Options:
  --help, -h      Show help for command

Examples:
  # Generate GitHub Actions workflow
  npx @klitchevo/code-council setup workflow

  # Review staged git changes
  npx @klitchevo/code-council review git

  # Review code from stdin
  echo "const x = 1" | npx @klitchevo/code-council review code

  # Show review command help
  npx @klitchevo/code-council review --help

For MCP server usage, configure in your MCP client settings.
See: https://github.com/klitchevo/code-council
`.trim(),
	};
}

/**
 * Execute CLI command
 * Returns result or null if command should fall through to MCP server
 */
export async function runCli(argv: string[]): Promise<CliResult | null> {
	const parsed = parseArgs(argv);

	// Handle review command
	if (parsed.command === "review") {
		return handleReviewCommand(parsed);
	}

	// Handle setup command
	if (parsed.command === "setup") {
		return handleSetupCommand(parsed);
	}

	// Handle help
	if (
		parsed.command === "--help" ||
		parsed.command === "-h" ||
		(parsed.command === "" && parsed.options.help)
	) {
		return showHelp();
	}

	// Init command is handled in main index.ts (existing logic)
	// Return null to let the main entry point handle it
	if (parsed.command === "init") {
		return null;
	}

	// No CLI command, fall through to MCP server
	return null;
}

/**
 * Process CLI result - write output and exit
 */
export function processResult(result: CliResult): never {
	if (result.stdout) {
		process.stdout.write(result.stdout);
		// Ensure newline at end
		if (!result.stdout.endsWith("\n")) {
			process.stdout.write("\n");
		}
	}

	if (result.stderr) {
		process.stderr.write(result.stderr);
		if (!result.stderr.endsWith("\n")) {
			process.stderr.write("\n");
		}
	}

	process.exit(result.exitCode);
}
