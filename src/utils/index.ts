/**
 * Utility modules for Code Council.
 *
 * @module utils
 */

// Diff parsing utilities
export type { DiffFile, DiffHunk, ParsedDiff } from "./diff-parser";
export {
	getChangedLinesForFile,
	isLineChanged,
	normalizePath,
	parseUnifiedDiff,
} from "./diff-parser";

// Parallel execution
export { executeInParallel } from "./parallel-executor";
