/**
 * Repository scanner with security controls
 * Scans git repositories while protecting against sensitive file exposure
 */

import { readdirSync, readFileSync, type Stats, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import ignore from "ignore";
import { logger } from "../logger";
import { findGitRoot, resolveAndValidatePath } from "./git-operations";

/**
 * Patterns for files that may contain sensitive information
 * These files are skipped by default to prevent credential leakage
 */
const SENSITIVE_FILE_PATTERNS = [
	".env",
	".env.*",
	"*.pem",
	"*.key",
	"*.p12",
	"*.pfx",
	"*.crt",
	"*credentials*",
	"*secret*",
	"id_rsa*",
	"id_ed25519*",
	"id_dsa*",
	"id_ecdsa*",
	".npmrc",
	".pypirc",
	"kubeconfig",
	".kube/config",
	".docker/config.json",
	"*password*",
	"*token*",
	"auth.json",
	".netrc",
	".git-credentials",
	"*.keystore",
	"*.jks",
	"service-account*.json",
	"gcloud*.json",
];

/**
 * Regex patterns for detecting embedded secrets in file content
 */
const SECRET_CONTENT_PATTERNS = [
	/AKIA[0-9A-Z]{16}/g, // AWS Access Key ID
	/-----BEGIN\s+(RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/g, // Private keys
	/-----BEGIN\s+PGP PRIVATE KEY BLOCK-----/g, // PGP private key
	/ghp_[a-zA-Z0-9]{36}/g, // GitHub Personal Access Token
	/gho_[a-zA-Z0-9]{36}/g, // GitHub OAuth Token
	/ghs_[a-zA-Z0-9]{36}/g, // GitHub Server Token
	/ghu_[a-zA-Z0-9]{36}/g, // GitHub User Token
	/sk-[a-zA-Z0-9]{48}/g, // OpenAI API Key
	/sk-proj-[a-zA-Z0-9]{48}/g, // OpenAI Project Key
	/xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/g, // Slack tokens
	/eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, // JWT tokens
	/AIza[0-9A-Za-z_-]{35}/g, // Google API Key
	/[0-9a-f]{32}-us[0-9]+/g, // Mailchimp API Key
	/SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g, // SendGrid API Key
	/sq0[a-z]{3}-[0-9A-Za-z_-]{22}/g, // Square tokens
];

/**
 * Default file extensions to include in scans
 */
const DEFAULT_FILE_EXTENSIONS = [
	// TypeScript/JavaScript
	".ts",
	".tsx",
	".js",
	".jsx",
	".mjs",
	".cjs",
	// Other languages
	".py",
	".go",
	".rs",
	".java",
	".kt",
	".scala",
	".rb",
	".php",
	".cs",
	".cpp",
	".c",
	".h",
	".hpp",
	".swift",
	// Frontend frameworks
	".vue",
	".svelte",
	".astro",
	// Config & docs (important for understanding project)
	".json",
	".yaml",
	".yml",
	".toml",
	".md",
];

/**
 * Priority directories - always scanned first, never skipped
 * These contain critical project configuration and context
 */
const PRIORITY_DIRS = [
	".claude", // Claude Code project configuration
	".beads", // Issue tracking
];

/**
 * Priority files at repo root - always included if they exist
 */
const PRIORITY_ROOT_FILES = [
	"CLAUDE.md",
	"README.md",
	"package.json",
	"tsconfig.json",
	"pyproject.toml",
	"Cargo.toml",
	"go.mod",
];

/**
 * Directories to always exclude from scanning
 */
const EXCLUDED_DIRS = [
	"node_modules",
	".git",
	"dist",
	"build",
	"out",
	".next",
	".nuxt",
	"__pycache__",
	".pytest_cache",
	".mypy_cache",
	"venv",
	".venv",
	"env",
	".env",
	"vendor",
	"target",
	".idea",
	".vscode",
	"coverage",
	".nyc_output",
];

/**
 * Scan options for repository scanning
 */
export interface ScanOptions {
	/** Maximum number of files to scan (default: 50, hard cap: 100) */
	maxFiles?: number;
	/** Maximum size per file in bytes (default: 50KB) */
	maxFileSize?: number;
	/** Maximum total size in bytes (default: 500KB) */
	maxTotalSize?: number;
	/** File extensions to include (default: common source files) */
	fileTypes?: string[];
	/** Skip sensitive files (default: true, highly recommended) */
	skipSensitive?: boolean;
	/** Check file contents for embedded secrets (default: true) */
	detectSecrets?: boolean;
}

/**
 * Individual file input for analysis
 */
export interface FileInput {
	/** Relative path from repo root */
	path: string;
	/** File content */
	content: string;
}

/**
 * Information about a skipped file
 */
export interface SkippedFile {
	/** Relative path from repo root */
	path: string;
	/** Reason the file was skipped */
	reason: string;
}

/**
 * Statistics about the scan
 */
export interface ScanStats {
	/** Total files found */
	totalFilesFound: number;
	/** Files included in results */
	totalFilesIncluded: number;
	/** Total size of included files in bytes */
	totalSize: number;
	/** Estimated token count (rough approximation) */
	tokenEstimate: number;
}

/**
 * Result from scanning a repository
 */
export interface ScanResult {
	/** Files to analyze */
	files: FileInput[];
	/** Files that were skipped */
	skipped: SkippedFile[];
	/** Warning messages (sensitive files found, etc.) */
	warnings: string[];
	/** Scan statistics */
	stats: ScanStats;
	/** Repository root path */
	repoRoot: string;
}

/**
 * Hard limits to prevent resource exhaustion
 * These are high ceilings - users can set lower limits via options
 */
const HARD_LIMITS = {
	MAX_FILES: 10000,
	MAX_FILE_SIZE: 1024 * 1024, // 1MB per file
	MAX_TOTAL_SIZE: 50 * 1024 * 1024, // 50MB total
};

/**
 * Default scan options
 */
const DEFAULT_OPTIONS: Required<ScanOptions> = {
	maxFiles: 50,
	maxFileSize: 50 * 1024, // 50KB
	maxTotalSize: 500 * 1024, // 500KB
	fileTypes: DEFAULT_FILE_EXTENSIONS,
	skipSensitive: true,
	detectSecrets: true,
};

/**
 * Check if a filename matches sensitive file patterns
 */
function isSensitiveFile(filename: string): boolean {
	const lowerName = filename.toLowerCase();

	for (const pattern of SENSITIVE_FILE_PATTERNS) {
		// Simple glob matching
		if (pattern.includes("*")) {
			const regex = new RegExp(
				`^${pattern.replace(/\./g, "\\.").replace(/\*/g, ".*")}$`,
				"i",
			);
			if (regex.test(lowerName)) {
				return true;
			}
		} else if (
			lowerName === pattern.toLowerCase() ||
			lowerName.endsWith(`/${pattern.toLowerCase()}`)
		) {
			return true;
		}
	}

	return false;
}

/**
 * Check if file content contains embedded secrets
 * @returns Array of detected secret types
 */
function detectEmbeddedSecrets(content: string): string[] {
	const detected: string[] = [];

	const secretTypes = [
		{ pattern: SECRET_CONTENT_PATTERNS[0], name: "AWS Access Key" },
		{ pattern: SECRET_CONTENT_PATTERNS[1], name: "Private Key" },
		{ pattern: SECRET_CONTENT_PATTERNS[2], name: "PGP Private Key" },
		{ pattern: SECRET_CONTENT_PATTERNS[3], name: "GitHub PAT" },
		{ pattern: SECRET_CONTENT_PATTERNS[4], name: "GitHub OAuth Token" },
		{ pattern: SECRET_CONTENT_PATTERNS[5], name: "GitHub Server Token" },
		{ pattern: SECRET_CONTENT_PATTERNS[6], name: "GitHub User Token" },
		{ pattern: SECRET_CONTENT_PATTERNS[7], name: "OpenAI API Key" },
		{ pattern: SECRET_CONTENT_PATTERNS[8], name: "OpenAI Project Key" },
		{ pattern: SECRET_CONTENT_PATTERNS[9], name: "Slack Token" },
		{ pattern: SECRET_CONTENT_PATTERNS[10], name: "JWT Token" },
		{ pattern: SECRET_CONTENT_PATTERNS[11], name: "Google API Key" },
		{ pattern: SECRET_CONTENT_PATTERNS[12], name: "Mailchimp API Key" },
		{ pattern: SECRET_CONTENT_PATTERNS[13], name: "SendGrid API Key" },
		{ pattern: SECRET_CONTENT_PATTERNS[14], name: "Square Token" },
	];

	for (const { pattern, name } of secretTypes) {
		if (!pattern) continue;
		// Reset regex state
		pattern.lastIndex = 0;
		if (pattern.test(content)) {
			detected.push(name);
		}
	}

	return detected;
}

/**
 * Check if content appears to be binary
 */
function isBinaryContent(content: Buffer): boolean {
	// Check for null bytes (common in binary files)
	for (let i = 0; i < Math.min(content.length, 8000); i++) {
		if (content[i] === 0) {
			return true;
		}
	}
	return false;
}

/**
 * Estimate token count from content
 * Rough approximation: ~4 characters per token
 */
function estimateTokens(content: string): number {
	return Math.ceil(content.length / 4);
}

/**
 * Scan a repository for source files
 *
 * @param startPath - Starting directory (will find git root automatically)
 * @param options - Scan configuration options
 * @returns Scan results with files, warnings, and statistics
 */
export async function scanRepository(
	startPath: string,
	options: ScanOptions = {},
): Promise<ScanResult> {
	// Merge options with defaults, enforcing hard limits
	const opts: Required<ScanOptions> = {
		...DEFAULT_OPTIONS,
		...options,
		maxFiles: Math.min(
			options.maxFiles ?? DEFAULT_OPTIONS.maxFiles,
			HARD_LIMITS.MAX_FILES,
		),
		maxFileSize: Math.min(
			options.maxFileSize ?? DEFAULT_OPTIONS.maxFileSize,
			HARD_LIMITS.MAX_FILE_SIZE,
		),
		maxTotalSize: Math.min(
			options.maxTotalSize ?? DEFAULT_OPTIONS.maxTotalSize,
			HARD_LIMITS.MAX_TOTAL_SIZE,
		),
		// Ensure fileTypes is never undefined
		fileTypes: options.fileTypes ?? DEFAULT_OPTIONS.fileTypes,
		skipSensitive: options.skipSensitive ?? DEFAULT_OPTIONS.skipSensitive,
		detectSecrets: options.detectSecrets ?? DEFAULT_OPTIONS.detectSecrets,
	};

	// Find repository root
	const repoRoot = findGitRoot(startPath);
	logger.info("Scanning repository", { repoRoot, options: opts });

	// Load .gitignore
	const ig = ignore();
	try {
		const gitignorePath = join(repoRoot, ".gitignore");
		const gitignoreContent = readFileSync(gitignorePath, "utf-8");
		ig.add(gitignoreContent);
	} catch {
		// No .gitignore or can't read it - that's fine
	}

	// Always add excluded directories
	ig.add(EXCLUDED_DIRS);

	const files: FileInput[] = [];
	const skipped: SkippedFile[] = [];
	const warnings: string[] = [];
	let totalSize = 0;
	let totalFilesFound = 0;

	/**
	 * Recursively scan directory
	 */
	function scanDir(dirPath: string, depth = 0): void {
		if (depth > 20) {
			return; // Max depth protection
		}

		if (files.length >= opts.maxFiles) {
			return; // Reached file limit
		}

		let entries: string[];
		try {
			entries = readdirSync(dirPath);
		} catch {
			return; // Can't read directory
		}

		for (const entry of entries) {
			if (files.length >= opts.maxFiles) {
				break;
			}

			const fullPath = join(dirPath, entry);
			const relativePath = relative(repoRoot, fullPath);

			// Check if ignored by .gitignore
			if (ig.ignores(relativePath)) {
				continue;
			}

			// Validate path is inside repo (symlink protection)
			const validPath = resolveAndValidatePath(fullPath, repoRoot);
			if (!validPath) {
				skipped.push({
					path: relativePath,
					reason: "Path outside repository or invalid symlink",
				});
				continue;
			}

			let stats: Stats;
			try {
				stats = statSync(validPath);
			} catch {
				continue;
			}

			if (stats.isDirectory()) {
				// Skip priority directories in main scan (they're scanned first)
				if (depth === 0 && PRIORITY_DIRS.includes(entry)) {
					continue;
				}
				scanDir(fullPath, depth + 1);
			} else if (stats.isFile()) {
				totalFilesFound++;

				// Check file extension
				const ext = extname(entry).toLowerCase();
				if (!opts.fileTypes.includes(ext)) {
					continue;
				}

				// Check sensitive file patterns
				if (opts.skipSensitive && isSensitiveFile(entry)) {
					skipped.push({
						path: relativePath,
						reason: "Potentially sensitive file",
					});
					warnings.push(`Skipped sensitive file: ${relativePath}`);
					continue;
				}

				// Check file size
				if (stats.size > opts.maxFileSize) {
					skipped.push({
						path: relativePath,
						reason: `File too large (${stats.size} bytes)`,
					});
					continue;
				}

				// Check total size limit
				if (totalSize + stats.size > opts.maxTotalSize) {
					skipped.push({
						path: relativePath,
						reason: "Total size limit reached",
					});
					continue;
				}

				// Read file content
				let content: string;
				try {
					const buffer = readFileSync(validPath);

					// Check for binary content
					if (isBinaryContent(buffer)) {
						skipped.push({ path: relativePath, reason: "Binary file" });
						continue;
					}

					content = buffer.toString("utf-8");
				} catch {
					skipped.push({ path: relativePath, reason: "Could not read file" });
					continue;
				}

				// Check for embedded secrets
				if (opts.detectSecrets) {
					const secrets = detectEmbeddedSecrets(content);
					if (secrets.length > 0) {
						skipped.push({
							path: relativePath,
							reason: `Contains potential secrets: ${secrets.join(", ")}`,
						});
						warnings.push(
							`Skipped file with potential secrets: ${relativePath} (${secrets.join(", ")})`,
						);
						continue;
					}
				}

				// Add file to results
				files.push({ path: relativePath, content });
				totalSize += stats.size;
			}
		}
	}

	/**
	 * Scan a single file if it meets criteria (used for priority files)
	 */
	function scanSingleFile(fullPath: string, bypassTypeFilter = false): boolean {
		const relativePath = relative(repoRoot, fullPath);

		let stats: Stats;
		try {
			stats = statSync(fullPath);
		} catch {
			return false;
		}

		if (!stats.isFile()) return false;

		totalFilesFound++;

		// Check file extension (bypass for priority files)
		const ext = extname(fullPath).toLowerCase();
		if (!bypassTypeFilter && !opts.fileTypes.includes(ext)) {
			return false;
		}

		// Check file size
		if (stats.size > opts.maxFileSize) {
			skipped.push({
				path: relativePath,
				reason: `File too large (${stats.size} bytes)`,
			});
			return false;
		}

		// Read file content
		let content: string;
		try {
			const buffer = readFileSync(fullPath);
			if (isBinaryContent(buffer)) {
				return false;
			}
			content = buffer.toString("utf-8");
		} catch {
			return false;
		}

		files.push({ path: relativePath, content });
		totalSize += stats.size;
		return true;
	}

	// 1. First scan priority root files (CLAUDE.md, README.md, package.json, etc.)
	for (const filename of PRIORITY_ROOT_FILES) {
		const fullPath = join(repoRoot, filename);
		scanSingleFile(fullPath, true); // bypass type filter for priority files
	}

	// 2. Scan priority directories (.claude, .beads) - these are critical for context
	for (const priorityDir of PRIORITY_DIRS) {
		const dirPath = join(repoRoot, priorityDir);
		try {
			const dirStats = statSync(dirPath);
			if (dirStats.isDirectory()) {
				logger.debug("Scanning priority directory", { dir: priorityDir });
				scanDir(dirPath, 0);
			}
		} catch {
			// Directory doesn't exist, that's fine
		}
	}

	// 3. Then scan the rest of the repo
	scanDir(repoRoot);

	const stats: ScanStats = {
		totalFilesFound,
		totalFilesIncluded: files.length,
		totalSize,
		tokenEstimate: files.reduce((sum, f) => sum + estimateTokens(f.content), 0),
	};

	logger.info("Repository scan complete", {
		filesIncluded: files.length,
		filesSkipped: skipped.length,
		totalSize,
		tokenEstimate: stats.tokenEstimate,
		warnings: warnings.length,
	});

	return {
		files,
		skipped,
		warnings,
		stats,
		repoRoot,
	};
}

/**
 * Aggregate scanned files into a single string for API submission
 * Maintains file boundaries with clear markers
 */
export function aggregateFiles(files: FileInput[]): string {
	return files
		.map(
			(f) =>
				`=== FILE: ${f.path} ===\n${f.content}\n=== END FILE: ${f.path} ===`,
		)
		.join("\n\n");
}

/**
 * Token budget for batching - conservative limit that works for all models
 */
const BATCH_TOKEN_BUDGET = 60000;

/**
 * A batch of files for processing
 */
export interface FileBatch {
	files: FileInput[];
	tokenEstimate: number;
	batchIndex: number;
}

/**
 * Create batches of files that fit within token budget
 * Groups files by directory to keep related code together
 *
 * @param files - Files to batch
 * @param tokenBudget - Maximum tokens per batch (default: 60000)
 * @returns Array of file batches
 */
export function createFileBatches(
	files: FileInput[],
	tokenBudget = BATCH_TOKEN_BUDGET,
): FileBatch[] {
	if (files.length === 0) {
		return [];
	}

	// Group files by directory for better context
	const filesByDir = new Map<string, FileInput[]>();
	for (const file of files) {
		const dir = file.path.includes("/")
			? file.path.substring(0, file.path.lastIndexOf("/"))
			: ".";
		const dirFiles = filesByDir.get(dir) || [];
		dirFiles.push(file);
		filesByDir.set(dir, dirFiles);
	}

	// Sort directories by total token count (smallest first for better packing)
	const dirsWithTokens = [...filesByDir.entries()].map(([dir, dirFiles]) => ({
		dir,
		files: dirFiles,
		tokens: dirFiles.reduce((sum, f) => sum + estimateTokens(f.content), 0),
	}));
	dirsWithTokens.sort((a, b) => a.tokens - b.tokens);

	const batches: FileBatch[] = [];
	let currentBatch: FileInput[] = [];
	let currentTokens = 0;

	for (const { files: dirFiles, tokens: dirTokens } of dirsWithTokens) {
		// If entire directory fits in current batch, add it
		if (currentTokens + dirTokens <= tokenBudget) {
			currentBatch.push(...dirFiles);
			currentTokens += dirTokens;
		}
		// If directory is too large for any batch, split it
		else if (dirTokens > tokenBudget) {
			// Finalize current batch if non-empty
			if (currentBatch.length > 0) {
				batches.push({
					files: currentBatch,
					tokenEstimate: currentTokens,
					batchIndex: batches.length,
				});
				currentBatch = [];
				currentTokens = 0;
			}

			// Split large directory into individual files
			for (const file of dirFiles) {
				const fileTokens = estimateTokens(file.content);

				if (
					currentTokens + fileTokens > tokenBudget &&
					currentBatch.length > 0
				) {
					batches.push({
						files: currentBatch,
						tokenEstimate: currentTokens,
						batchIndex: batches.length,
					});
					currentBatch = [];
					currentTokens = 0;
				}

				currentBatch.push(file);
				currentTokens += fileTokens;
			}
		}
		// Start new batch with this directory
		else {
			if (currentBatch.length > 0) {
				batches.push({
					files: currentBatch,
					tokenEstimate: currentTokens,
					batchIndex: batches.length,
				});
			}
			currentBatch = [...dirFiles];
			currentTokens = dirTokens;
		}
	}

	// Don't forget the last batch
	if (currentBatch.length > 0) {
		batches.push({
			files: currentBatch,
			tokenEstimate: currentTokens,
			batchIndex: batches.length,
		});
	}

	logger.debug("Created file batches", {
		totalFiles: files.length,
		batchCount: batches.length,
		batchSizes: batches.map((b) => ({
			files: b.files.length,
			tokens: b.tokenEstimate,
		})),
	});

	return batches;
}
