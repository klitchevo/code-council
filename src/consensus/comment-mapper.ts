/**
 * Maps finding clusters to PR comment positions based on diff data.
 * Only findings on changed lines become inline comments; others go to summary.
 */

import type { ParsedDiff } from "../utils/diff-parser";
import { normalizePath } from "../utils/diff-parser";
import type { FindingCluster } from "./types";

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
 * Try to find the file in the diff that matches the finding's location
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
 * A cluster becomes an inline comment if:
 * 1. It has a canonicalLocation with file and line
 * 2. The file exists in the diff
 * 3. The line is in the set of changed lines OR we can find a nearby changed line
 *
 * Otherwise, the cluster goes to the unmapped array for the summary body.
 *
 * @param clusters - Array of finding clusters to map
 * @param diff - Parsed diff with changed files and lines
 * @returns Mapping result with inline comments and unmapped findings
 */
export function mapClustersToComments(
	clusters: readonly FindingCluster[],
	diff: ParsedDiff,
): MappingResult {
	const comments: MappedComment[] = [];
	const unmapped: FindingCluster[] = [];

	for (const cluster of clusters) {
		// Check if cluster has a valid location
		if (!cluster.canonicalLocation?.file) {
			unmapped.push(cluster);
			continue;
		}

		const { file, line } = cluster.canonicalLocation;

		// Try to find the file in the diff
		const matchingFile = findMatchingDiffFile(diff, file);

		if (!matchingFile) {
			// File not in diff
			unmapped.push(cluster);
			continue;
		}

		// If no line specified, use the first changed line in the file
		if (!line) {
			const firstChangedLine = Math.min(...matchingFile.changedLines);
			if (firstChangedLine && Number.isFinite(firstChangedLine)) {
				comments.push({
					cluster,
					path: matchingFile.path,
					line: firstChangedLine,
				});
			} else {
				unmapped.push(cluster);
			}
			continue;
		}

		// Check if the exact line is in the changed lines
		if (matchingFile.changedLines.has(line)) {
			comments.push({
				cluster,
				path: matchingFile.path,
				line,
			});
			continue;
		}

		// Find the nearest changed line (within 20 lines)
		const nearestLine = findNearestChangedLine(
			line,
			matchingFile.changedLines,
			20,
		);
		if (nearestLine !== null) {
			comments.push({
				cluster,
				path: matchingFile.path,
				line: nearestLine,
			});
			continue;
		}

		// No nearby changed line found
		unmapped.push(cluster);
	}

	return { comments, unmapped };
}

/**
 * Find the nearest changed line within a tolerance
 */
function findNearestChangedLine(
	targetLine: number,
	changedLines: ReadonlySet<number>,
	tolerance: number,
): number | null {
	let nearest: number | null = null;
	let minDistance = tolerance + 1;

	for (const line of changedLines) {
		const distance = Math.abs(line - targetLine);
		if (distance <= tolerance && distance < minDistance) {
			minDistance = distance;
			nearest = line;
		}
	}

	return nearest;
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
