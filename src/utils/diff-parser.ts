/**
 * Parser for unified diff format.
 * Extracts changed files and line numbers from git diff output.
 */

/**
 * A single hunk in a diff file
 */
export interface DiffHunk {
	readonly oldStart: number;
	readonly oldCount: number;
	readonly newStart: number;
	readonly newCount: number;
}

/**
 * A file in the diff with its hunks and changed lines
 */
export interface DiffFile {
	readonly oldPath: string;
	readonly newPath: string;
	readonly hunks: readonly DiffHunk[];
	/** Line numbers that were added or modified in the new file */
	readonly changedLines: ReadonlySet<number>;
}

/**
 * Result of parsing a unified diff
 */
export interface ParsedDiff {
	readonly files: readonly DiffFile[];
}

/**
 * Parse a unified diff string into structured data
 *
 * @param diffText - The raw unified diff output from git
 * @returns Parsed diff with files and changed line information
 */
export function parseUnifiedDiff(diffText: string): ParsedDiff {
	if (!diffText || diffText.trim().length === 0) {
		return { files: [] };
	}

	const files: DiffFile[] = [];
	const lines = diffText.split("\n");

	let currentFile: {
		oldPath: string;
		newPath: string;
		hunks: DiffHunk[];
		changedLines: Set<number>;
	} | null = null;

	let i = 0;
	while (i < lines.length) {
		const line = lines[i] ?? "";

		// Start of a new file diff
		if (line.startsWith("diff --git")) {
			// Save previous file if exists
			if (currentFile) {
				files.push({
					oldPath: currentFile.oldPath,
					newPath: currentFile.newPath,
					hunks: currentFile.hunks,
					changedLines: new Set(currentFile.changedLines),
				});
			}

			// Extract paths from diff --git a/path b/path
			const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
			if (match && match[1] && match[2]) {
				currentFile = {
					oldPath: match[1],
					newPath: match[2],
					hunks: [],
					changedLines: new Set(),
				};
			}
			i++;
			continue;
		}

		// Alternative path extraction from --- and +++ lines
		if (line.startsWith("--- ") && currentFile) {
			const path = line.slice(4);
			if (path !== "/dev/null" && path.startsWith("a/")) {
				currentFile.oldPath = path.slice(2);
			}
			i++;
			continue;
		}

		if (line.startsWith("+++ ") && currentFile) {
			const path = line.slice(4);
			if (path !== "/dev/null" && path.startsWith("b/")) {
				currentFile.newPath = path.slice(2);
			}
			i++;
			continue;
		}

		// Parse hunk header: @@ -old,count +new,count @@
		if (line.startsWith("@@") && currentFile) {
			const hunkMatch = line.match(
				/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/,
			);
			if (hunkMatch && hunkMatch[1] && hunkMatch[3]) {
				const hunk: DiffHunk = {
					oldStart: parseInt(hunkMatch[1], 10),
					oldCount: hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1,
					newStart: parseInt(hunkMatch[3], 10),
					newCount: hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1,
				};
				currentFile.hunks.push(hunk);

				// Process hunk content to find changed lines
				let newLineNum = hunk.newStart;
				i++;

				while (i < lines.length) {
					const contentLine = lines[i] ?? "";

					// Stop at next hunk or file
					if (
						contentLine.startsWith("@@") ||
						contentLine.startsWith("diff --git")
					) {
						break;
					}

					if (contentLine.startsWith("+") && !contentLine.startsWith("+++")) {
						// Added line - track this line number
						currentFile.changedLines.add(newLineNum);
						newLineNum++;
					} else if (
						contentLine.startsWith("-") &&
						!contentLine.startsWith("---")
					) {
						// Removed line - doesn't increment new line number
					} else if (contentLine.startsWith(" ") || contentLine === "") {
						// Context line or empty - increment new line number
						newLineNum++;
					} else if (contentLine.startsWith("\\")) {
						// "\ No newline at end of file" - skip
					} else {
						// Unknown line format, treat as context
						newLineNum++;
					}

					i++;
				}
				continue;
			}
		}

		i++;
	}

	// Save last file
	if (currentFile) {
		files.push({
			oldPath: currentFile.oldPath,
			newPath: currentFile.newPath,
			hunks: currentFile.hunks,
			changedLines: new Set(currentFile.changedLines),
		});
	}

	return { files };
}

/**
 * Normalize a file path for comparison
 * Handles various path formats: ./path, src/path, path
 */
export function normalizePath(path: string): string {
	let normalized = path;

	// Remove leading ./
	if (normalized.startsWith("./")) {
		normalized = normalized.slice(2);
	}

	// Remove leading /
	if (normalized.startsWith("/")) {
		normalized = normalized.slice(1);
	}

	return normalized;
}

/**
 * Get the set of changed line numbers for a specific file
 *
 * @param diff - The parsed diff
 * @param filePath - The file path to look up (will be normalized)
 * @returns Set of changed line numbers, or undefined if file not in diff
 */
export function getChangedLinesForFile(
	diff: ParsedDiff,
	filePath: string,
): ReadonlySet<number> | undefined {
	const normalizedTarget = normalizePath(filePath);

	for (const file of diff.files) {
		const normalizedOld = normalizePath(file.oldPath);
		const normalizedNew = normalizePath(file.newPath);

		if (
			normalizedNew === normalizedTarget ||
			normalizedOld === normalizedTarget
		) {
			return file.changedLines;
		}
	}

	return undefined;
}

/**
 * Check if a specific line was changed in a file
 *
 * @param diff - The parsed diff
 * @param filePath - The file path to check
 * @param lineNumber - The line number to check
 * @returns true if the line was changed, false otherwise
 */
export function isLineChanged(
	diff: ParsedDiff,
	filePath: string,
	lineNumber: number,
): boolean {
	const changedLines = getChangedLinesForFile(diff, filePath);
	if (!changedLines) {
		return false;
	}
	return changedLines.has(lineNumber);
}
