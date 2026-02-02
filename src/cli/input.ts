/**
 * Input handling for CLI mode
 * Reads from stdin or files with timeout support
 */

import { existsSync, readFileSync } from "node:fs";
import { type CliResult, ExitCode } from "./types";

/**
 * Default timeout for stdin reading (30 seconds)
 */
const STDIN_TIMEOUT_MS = 30_000;

/**
 * Read input from stdin with a timeout
 * Returns null if stdin is empty/tty or times out
 */
export async function readStdin(
	timeoutMs: number = STDIN_TIMEOUT_MS,
): Promise<string | null> {
	// Check if stdin is a TTY (interactive terminal with no piped input)
	if (process.stdin.isTTY) {
		return null;
	}

	return new Promise((resolve) => {
		const chunks: Buffer[] = [];
		let resolved = false;

		const timeout = setTimeout(() => {
			if (!resolved) {
				resolved = true;
				// Return whatever we have so far
				const content = Buffer.concat(chunks).toString("utf-8").trim();
				resolve(content || null);
			}
		}, timeoutMs);

		process.stdin.on("data", (chunk: Buffer) => {
			chunks.push(Buffer.from(chunk));
		});

		process.stdin.on("end", () => {
			if (!resolved) {
				clearTimeout(timeout);
				resolved = true;
				const content = Buffer.concat(chunks).toString("utf-8").trim();
				resolve(content || null);
			}
		});

		process.stdin.on("error", () => {
			if (!resolved) {
				clearTimeout(timeout);
				resolved = true;
				resolve(null);
			}
		});

		// Handle case where stdin is already closed
		process.stdin.resume();
	});
}

/**
 * Read input from a file
 */
export function readFile(filePath: string): CliResult | string {
	if (!existsSync(filePath)) {
		return {
			exitCode: ExitCode.INVALID_ARGS,
			stderr: `Error: File not found: ${filePath}`,
		};
	}

	try {
		const content = readFileSync(filePath, "utf-8").trim();
		if (!content) {
			return {
				exitCode: ExitCode.NO_INPUT,
				stderr: `Error: File is empty: ${filePath}`,
			};
		}
		return content;
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return {
			exitCode: ExitCode.ERROR,
			stderr: `Error reading file: ${message}`,
		};
	}
}

/**
 * Get input from either file or stdin
 * File takes precedence if specified
 */
export async function getInput(filePath?: string): Promise<CliResult | string> {
	// If file specified, read from file
	if (filePath) {
		return readFile(filePath);
	}

	// Otherwise read from stdin
	const stdinContent = await readStdin();
	if (!stdinContent) {
		return {
			exitCode: ExitCode.NO_INPUT,
			stderr:
				"Error: No input provided. Pipe content to stdin or use --file flag.",
		};
	}

	return stdinContent;
}
