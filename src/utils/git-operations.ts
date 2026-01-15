/**
 * Shared git utilities for repository operations
 * Extracted to avoid duplication between review-git.ts and repo-scanner.ts
 */

import { execSync } from "node:child_process";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";
import { logger } from "../logger";

/**
 * Maximum directory traversal depth when searching for git root
 * Prevents infinite loops and excessive filesystem traversal
 */
const MAX_TRAVERSAL_DEPTH = 20;

/**
 * Find the root directory of a git repository
 * Walks up the directory tree looking for .git
 *
 * @param startPath - Starting directory path
 * @returns Absolute path to git repository root
 * @throws Error if not in a git repository or max depth exceeded
 */
export function findGitRoot(startPath: string): string {
	let currentPath = resolve(startPath);
	let depth = 0;

	while (depth < MAX_TRAVERSAL_DEPTH) {
		const gitPath = join(currentPath, ".git");

		if (existsSync(gitPath)) {
			logger.debug("Found git root", { path: currentPath, depth });
			return currentPath;
		}

		const parentPath = dirname(currentPath);

		// Reached filesystem root
		if (parentPath === currentPath) {
			throw new Error(
				`Not in a git repository. Searched from ${startPath} to filesystem root.`,
			);
		}

		currentPath = parentPath;
		depth++;
	}

	throw new Error(
		`Max directory traversal depth (${MAX_TRAVERSAL_DEPTH}) exceeded while searching for git root.`,
	);
}

/**
 * Validate that a file path is safely within the repository root
 * Prevents path traversal attacks and symlink escapes
 *
 * @param filePath - Path to validate
 * @param repoRoot - Repository root path
 * @returns True if the path is safely within the repo
 */
export function isInsideRepo(filePath: string, repoRoot: string): boolean {
	try {
		// Normalize both paths
		const normalizedRepo = normalize(resolve(repoRoot));
		const normalizedFile = normalize(resolve(filePath));

		// Check if file is within repo directory
		const relativePath = relative(normalizedRepo, normalizedFile);

		// If relative path starts with ".." or is absolute, it's outside
		if (
			relativePath.startsWith("..") ||
			resolve(relativePath) === relativePath
		) {
			return false;
		}

		return true;
	} catch {
		return false;
	}
}

/**
 * Resolve symlinks and validate the target is within the repository
 * Prevents symlink attacks that could read files outside the repo
 *
 * @param filePath - Path to resolve
 * @param repoRoot - Repository root path
 * @returns Real path if valid, null if invalid or outside repo
 */
export function resolveAndValidatePath(
	filePath: string,
	repoRoot: string,
): string | null {
	try {
		const absolutePath = resolve(repoRoot, filePath);

		// Check if it's a symlink
		const stats = lstatSync(absolutePath);

		if (stats.isSymbolicLink()) {
			// Resolve the symlink target
			const realPath = realpathSync(absolutePath);

			// Verify target is inside repo
			if (!isInsideRepo(realPath, repoRoot)) {
				logger.warn("Symlink target outside repository", {
					symlink: filePath,
					target: realPath,
					repo: repoRoot,
				});
				return null;
			}

			return realPath;
		}

		// Not a symlink, validate path is inside repo
		if (!isInsideRepo(absolutePath, repoRoot)) {
			return null;
		}

		return absolutePath;
	} catch (error) {
		logger.debug("Path resolution failed", { filePath, error });
		return null;
	}
}

/**
 * Check if a directory is a git repository
 *
 * @param dirPath - Directory path to check
 * @returns True if directory contains a .git folder
 */
export function isGitRepository(dirPath: string): boolean {
	try {
		const gitPath = join(resolve(dirPath), ".git");
		return existsSync(gitPath);
	} catch {
		return false;
	}
}

/**
 * Get the current git branch name
 *
 * @param repoRoot - Repository root path
 * @returns Branch name or null if detached HEAD
 */
export function getCurrentBranch(repoRoot: string): string | null {
	try {
		const branch = execSync("git rev-parse --abbrev-ref HEAD", {
			cwd: repoRoot,
			encoding: "utf-8",
		}).trim();

		return branch === "HEAD" ? null : branch;
	} catch {
		return null;
	}
}

/**
 * Get the repository remote URL (if any)
 *
 * @param repoRoot - Repository root path
 * @returns Remote URL or null if not configured
 */
export function getRemoteUrl(repoRoot: string): string | null {
	try {
		return execSync("git remote get-url origin", {
			cwd: repoRoot,
			encoding: "utf-8",
		}).trim();
	} catch {
		return null;
	}
}
