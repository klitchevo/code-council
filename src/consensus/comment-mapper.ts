/**
 * Maps finding clusters to PR comment positions based on diff data.
 * Uses fuzzy line matching to maximize inline comments:
 * 1. Exact line match
 * 2. Nearest changed line within tolerance
 * 3. First line of file (file-level comment)
 * NEVER puts findings in summary if the file is in the diff.
 */

import { logger } from "../logger";
import type { ParsedDiff } from "../utils/diff-parser";
import { normalizePath } from "../utils/diff-parser";
import type { FindingCluster } from "./types";

/** Default line tolerance for fuzzy matching */
const DEFAULT_LINE_TOLERANCE = 20;

/**
 * A finding cluster mapped to a specific line in the diff
 */
export interface MappedComment {
	readonly cluster: FindingCluster;
	readonly path: string;
	readonly line: number;
}

/**
 * Result of mapping clusters to diff positions
 */
export interface MappingResult {
	/** Clusters that could be mapped to changed lines */
	readonly comments: readonly MappedComment[];
	/** Clusters without location or not on changed lines */
	readonly unmapped: readonly FindingCluster[];
}

/**
 * Find the nearest changed line to the target line within tolerance.
 * Returns the closest changed line number, or undefined if none within tolerance.
 */
function findNearestChangedLine(
	changedLines: ReadonlySet<number>,
	targetLine: number,
	tolerance: number = DEFAULT_LINE_TOLERANCE,
): number | undefined {
	if (changedLines.size === 0) {
		return undefined;
	}

	// Check exact match first
	if (changedLines.has(targetLine)) {
		return targetLine;
	}

	// Search within tolerance range
	let nearestLine: number | undefined;
	let minDistance = tolerance + 1;

	for (const line of changedLines) {
		const distance = Math.abs(line - targetLine);
		if (distance <= tolerance && distance < minDistance) {
			minDistance = distance;
			nearestLine = line;
		}
	}

	return nearestLine;
}

/**
 * Get the first changed line in a file (for file-level comments)
 */
function getFirstChangedLine(changedLines: ReadonlySet<number>): number {
	if (changedLines.size === 0) {
		return 1; // Default to line 1 if no changes (shouldn't happen)
	}

	let minLine = Number.POSITIVE_INFINITY;
	for (const line of changedLines) {
		if (line < minLine) {
			minLine = line;
		}
	}
	return minLine;
}

/**
 * Try to find the file in the diff that matches the finding's location.
 * Uses fuzzy path matching for robustness.
 */
function findMatchingDiffFile(
	diff: ParsedDiff,
	filePath: string,
): { path: string; changedLines: ReadonlySet<number> } | undefined {
	const normalizedTarget = normalizePath(filePath);

	for (const file of diff.files) {
		const normalizedNew = normalizePath(file.newPath);
		const normalizedOld = normalizePath(file.oldPath);

		// Direct match
		if (
			normalizedNew === normalizedTarget ||
			normalizedOld === normalizedTarget
		) {
			return { path: file.newPath, changedLines: file.changedLines };
		}

		// Try matching just the filename for fuzzy matching
		const targetFilename = normalizedTarget.split("/").pop();
		const newFilename = normalizedNew.split("/").pop();

		if (targetFilename && newFilename && targetFilename === newFilename) {
			// Filename matches, check if paths are reasonably similar
			if (
				normalizedNew.endsWith(normalizedTarget) ||
				normalizedTarget.endsWith(normalizedNew)
			) {
				return { path: file.newPath, changedLines: file.changedLines };
			}
		}
	}

	return undefined;
}

/**
 * Map finding clusters to PR comment positions based on diff data.
 *
 * Uses progressive fallback for maximum inline comment coverage:
 * 1. Exact line match in changed lines
 * 2. Nearest changed line within tolerance (default 20 lines)
 * 3. First changed line in file (file-level comment)
 *
 * A cluster ONLY goes to unmapped if:
 * - It has no location at all, OR
 * - The file does not exist in the diff
 *
 * NEVER puts findings in summary if the file is in the diff.
 *
 * @param clusters - Array of finding clusters to map
 * @param diff - Parsed diff with changed files and lines
 * @param lineTolerance - Max lines to search for nearest changed line (default 20)
 * @returns Mapping result with inline comments and unmapped findings
 */
export function mapClustersToComments(
	clusters: readonly FindingCluster[],
	diff: ParsedDiff,
	lineTolerance: number = DEFAULT_LINE_TOLERANCE,
): MappingResult {
	const comments: MappedComment[] = [];
	const unmapped: FindingCluster[] = [];

	for (const cluster of clusters) {
		// Check if cluster has a file location (line is optional)
		if (!cluster.canonicalLocation?.file) {
			unmapped.push(cluster);
			continue;
		}

		const { file, line } = cluster.canonicalLocation;

		// Try to find the file in the diff
		const matchingFile = findMatchingDiffFile(diff, file);

		if (!matchingFile) {
			// File not in diff - goes to summary
			unmapped.push(cluster);
			continue;
		}

		// File is in diff - NEVER put in summary, find best line
		let targetLine: number;

		if (line !== undefined) {
			// Try exact match first
			if (matchingFile.changedLines.has(line)) {
				targetLine = line;
			} else {
				// Try finding nearest changed line within tolerance
				const nearestLine = findNearestChangedLine(
					matchingFile.changedLines,
					line,
					lineTolerance,
				);

				if (nearestLine !== undefined) {
					logger.debug("Using nearest changed line", {
						file,
						originalLine: line,
						mappedLine: nearestLine,
					});
					targetLine = nearestLine;
				} else {
					// Fall back to first changed line (file-level comment)
					targetLine = getFirstChangedLine(matchingFile.changedLines);
					logger.debug("Using first changed line as fallback", {
						file,
						originalLine: line,
						mappedLine: targetLine,
					});
				}
			}
		} else {
			// No line specified, use first changed line
			targetLine = getFirstChangedLine(matchingFile.changedLines);
			logger.debug("No line specified, using first changed line", {
				file,
				mappedLine: targetLine,
			});
		}

		// Valid mapping found
		comments.push({
			cluster,
			path: matchingFile.path,
			line: targetLine,
		});
	}

	return { comments, unmapped };
}

/**
 * Get the number of inline comments that would be generated
 */
export function countMappedComments(result: MappingResult): number {
	return result.comments.length;
}

/**
 * Get the number of findings that will go in the summary body
 */
export function countUnmappedFindings(result: MappingResult): number {
	return result.unmapped.length;
}

/**
 * Filter mapped comments by severity
 */
export function filterCommentsBySeverity(
	result: MappingResult,
	minSeverity: "critical" | "high" | "medium" | "low" | "info",
): readonly MappedComment[] {
	const severityOrder = ["critical", "high", "medium", "low", "info"];
	const minIndex = severityOrder.indexOf(minSeverity);

	return result.comments.filter((comment) => {
		const commentIndex = severityOrder.indexOf(comment.cluster.severity);
		return commentIndex <= minIndex;
	});
}

/**
 * Group mapped comments by file path
 */
export function groupCommentsByFile(
	comments: readonly MappedComment[],
): ReadonlyMap<string, readonly MappedComment[]> {
	const byFile = new Map<string, MappedComment[]>();

	for (const comment of comments) {
		const existing = byFile.get(comment.path) ?? [];
		byFile.set(comment.path, [...existing, comment]);
	}

	return byFile;
}
