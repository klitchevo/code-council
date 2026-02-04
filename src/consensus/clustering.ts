/**
 * Clusters similar findings from multiple models together.
 * Groups by location and category, then merges by similarity.
 */

import { ConsensusClusteringError } from "../errors";
import { logger } from "../logger";
import { getCanonicalLocation, locationsMatch } from "./normalizer";
import type {
	ClusterId,
	ConsensusType,
	Finding,
	FindingCategory,
	FindingCluster,
	FindingSeverity,
} from "./types";
import { FINDING_SEVERITIES, toClusterId } from "./types";

/**
 * Configuration for clustering behavior
 */
export interface ClusteringConfig {
	/** Line proximity tolerance for location matching (default: 5) */
	lineProximity: number;
	/** Similarity threshold for merging clusters (default: 0.7) */
	similarityThreshold: number;
}

const DEFAULT_CLUSTERING_CONFIG: ClusteringConfig = {
	lineProximity: 15, // More lenient - models often point to different lines for same issue
	similarityThreshold: 0.55, // Lower threshold - models describe same issues differently
};

/**
 * Generate a unique cluster ID
 */
function generateClusterId(): ClusterId {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).substring(2, 8);
	return toClusterId(`cluster-${timestamp}-${random}`);
}

/**
 * Get the most severe severity from a list
 */
function getMostSevereSeverity(severities: FindingSeverity[]): FindingSeverity {
	const severityOrder = FINDING_SEVERITIES;
	for (const sev of severityOrder) {
		if (severities.includes(sev)) {
			return sev;
		}
	}
	return "info";
}

/**
 * Get the most common category from a list
 */
function getMostCommonCategory(categories: FindingCategory[]): FindingCategory {
	const counts = new Map<FindingCategory, number>();
	for (const cat of categories) {
		counts.set(cat, (counts.get(cat) ?? 0) + 1);
	}

	let maxCount = 0;
	let mostCommon: FindingCategory = "other";
	for (const [cat, count] of counts) {
		if (count > maxCount) {
			maxCount = count;
			mostCommon = cat;
		}
	}
	return mostCommon;
}

/**
 * Create a cluster title from findings
 */
function createClusterTitle(findings: Finding[]): string {
	// Use the shortest non-empty title that represents the group
	const titles = findings.map((f) => f.title).filter((t) => t.length > 0);
	if (titles.length === 0) {
		return "Unnamed finding";
	}

	// Prefer shorter titles that are descriptive
	titles.sort((a, b) => a.length - b.length);

	// Return the first title that's at least 10 characters (to avoid too-short titles)
	for (const title of titles) {
		if (title.length >= 10) {
			return title;
		}
	}
	return titles[0] ?? "Unnamed finding";
}

/**
 * Common security issue keywords that indicate the same type of vulnerability
 * Maps keyword patterns to canonical issue types
 */
const ISSUE_KEYWORDS: Record<string, string[]> = {
	sql_injection: ["sql", "injection", "sqli", "cwe-89", "query"],
	xss: ["xss", "cross-site", "scripting", "cwe-79", "sanitiz"],
	command_injection: ["command", "injection", "exec", "shell", "cwe-78", "rce"],
	hardcoded_secrets: [
		"hardcoded",
		"secret",
		"credential",
		"password",
		"api key",
		"cwe-798",
	],
	auth_bypass: ["auth", "bypass", "backdoor", "authentication"],
	weak_crypto: ["crypto", "random", "math.random", "weak", "cwe-338"],
	info_disclosure: ["disclosure", "exposure", "logging", "cwe-532"],
	race_condition: ["race", "condition", "toctou", "concurrent"],
	memory_leak: ["memory", "leak", "unbounded", "cache"],
	missing_validation: ["validation", "sanitiz", "escape", "input"],
};

/**
 * Extract canonical issue types from text
 */
function extractIssueTypes(text: string): Set<string> {
	const lower = text.toLowerCase();
	const types = new Set<string>();

	for (const [issueType, keywords] of Object.entries(ISSUE_KEYWORDS)) {
		for (const keyword of keywords) {
			if (lower.includes(keyword)) {
				types.add(issueType);
				break;
			}
		}
	}
	return types;
}

/**
 * Calculate basic text similarity between two strings (Jaccard index of words)
 */
function textSimilarity(
	text1: string | undefined,
	text2: string | undefined,
): number {
	const t1 = text1 ?? "";
	const t2 = text2 ?? "";

	// First check for matching issue types (concept-level matching)
	const types1 = extractIssueTypes(t1);
	const types2 = extractIssueTypes(t2);
	if (types1.size > 0 && types2.size > 0) {
		let typeOverlap = 0;
		for (const type of types1) {
			if (types2.has(type)) {
				typeOverlap++;
			}
		}
		if (typeOverlap > 0) {
			// Same issue type = high similarity (capped at 1.0)
			return Math.min(1.0, 0.8 + typeOverlap * 0.05);
		}
	}

	// Fall back to word-level Jaccard
	const words1 = new Set(
		t1
			.toLowerCase()
			.split(/\s+/)
			.filter((w) => w.length > 2),
	);
	const words2 = new Set(
		t2
			.toLowerCase()
			.split(/\s+/)
			.filter((w) => w.length > 2),
	);

	if (words1.size === 0 && words2.size === 0) {
		return 1; // Both empty = identical
	}
	if (words1.size === 0 || words2.size === 0) {
		return 0; // One empty, one not = different
	}

	let intersection = 0;
	for (const word of words1) {
		if (words2.has(word)) {
			intersection++;
		}
	}

	const union = words1.size + words2.size - intersection;
	return intersection / union;
}

/**
 * Calculate similarity between two findings
 */
export function findingSimilarity(
	finding1: Finding,
	finding2: Finding,
	config: ClusteringConfig = DEFAULT_CLUSTERING_CONFIG,
): number {
	// Different categories = low similarity
	if (finding1.category !== finding2.category) {
		return 0.1;
	}

	// Check location match
	const locationMatch = locationsMatch(
		finding1.location,
		finding2.location,
		config.lineProximity,
	);

	// Same file check - this is the most important signal
	const sameFile =
		finding1.location?.file &&
		finding2.location?.file &&
		finding1.location.file === finding2.location.file;

	// Check if both findings share an issue type (keyword-based concept matching)
	const types1 = extractIssueTypes(`${finding1.title} ${finding1.description}`);
	const types2 = extractIssueTypes(`${finding2.title} ${finding2.description}`);
	let sharedIssueType = false;
	for (const type of types1) {
		if (types2.has(type)) {
			sharedIssueType = true;
			break;
		}
	}

	// Calculate text similarity
	const titleSim = textSimilarity(finding1.title, finding2.title);
	const descSim = textSimilarity(finding1.description, finding2.description);

	// For findings with the same issue type in the same file, cluster aggressively
	// This handles cases like "SQL Injection" from model A and "CWE-89: Unsafe query" from model B
	if (sharedIssueType && sameFile) {
		return Math.min(1, 0.75 + titleSim * 0.15 + descSim * 0.1);
	}

	// For security findings in the same file, be VERY aggressive about clustering
	// Multiple models finding different security issues in the same file = same problem
	if (finding1.category === "security" && sameFile) {
		// High similarity just for being security issues in the same file
		// Text similarity is a bonus
		return Math.min(1, 0.6 + titleSim * 0.2 + descSim * 0.1);
	}

	// Same issue type even in different files suggests related findings
	if (sharedIssueType) {
		return Math.min(1, 0.5 + titleSim * 0.25 + descSim * 0.15);
	}

	// Weight components for non-security or different files
	let score = 0;

	// Category match already checked
	score += 0.25; // Base for same category

	// Location scoring
	if (sameFile) {
		if (locationMatch) {
			score += 0.35;
		} else {
			score += 0.25;
		}
	} else if (locationMatch) {
		score += 0.15;
	}

	// Text similarity
	score += titleSim * 0.25;
	score += descSim * 0.15;

	return Math.min(1, Math.max(0, score));
}

/**
 * Check if a finding should join an existing cluster
 */
function shouldJoinCluster(
	finding: Finding,
	cluster: Finding[],
	config: ClusteringConfig,
): boolean {
	// Check similarity against each finding in cluster
	for (const existing of cluster) {
		const sim = findingSimilarity(finding, existing, config);
		if (sim >= config.similarityThreshold) {
			return true;
		}
	}
	return false;
}

/**
 * Group key for pre-clustering: file + category + issue type
 */
function getClusterKey(finding: Finding): string {
	const file = finding.location?.file ?? "no-file";
	const category = finding.category;
	const types = extractIssueTypes(`${finding.title} ${finding.description}`);
	const primaryType = types.size > 0 ? [...types].sort()[0] : "general";
	return `${file}::${category}::${primaryType}`;
}

/**
 * Initial clustering by location and category
 * Uses a two-phase approach:
 * 1. First group by file+category+issue-type for coarse clustering
 * 2. Then refine with similarity matching
 */
function initialClustering(
	findings: Finding[],
	config: ClusteringConfig,
): Finding[][] {
	// Phase 1: Group by file + category + issue type
	const preGroups = new Map<string, Finding[]>();
	for (const finding of findings) {
		const key = getClusterKey(finding);
		const group = preGroups.get(key) ?? [];
		group.push(finding);
		preGroups.set(key, group);
	}

	// Phase 2: For each pre-group, further cluster by similarity
	const clusters: Finding[][] = [];
	for (const group of preGroups.values()) {
		if (group.length === 1) {
			clusters.push(group);
			continue;
		}

		// Within the pre-group, cluster by similarity
		const subClusters: Finding[][] = [];
		for (const finding of group) {
			let joined = false;
			for (const subCluster of subClusters) {
				if (shouldJoinCluster(finding, subCluster, config)) {
					subCluster.push(finding);
					joined = true;
					break;
				}
			}
			if (!joined) {
				subClusters.push([finding]);
			}
		}
		clusters.push(...subClusters);
	}

	return clusters;
}

/**
 * Try to merge similar clusters
 * Uses "best match" logic: if any pair between clusters is highly similar, merge them
 */
function mergeSimilarClusters(
	clusters: Finding[][],
	config: ClusteringConfig,
): Finding[][] {
	if (clusters.length <= 1) {
		return clusters;
	}

	const merged: Finding[][] = [...clusters];
	let changed = true;

	while (changed) {
		changed = false;

		for (let i = 0; i < merged.length; i++) {
			for (let j = i + 1; j < merged.length; j++) {
				// Check if clusters should merge
				const cluster1 = merged[i];
				const cluster2 = merged[j];

				if (!cluster1 || !cluster2) continue;

				// Use "best match" logic: find the highest similarity between any pair
				// This handles cases where one model reports multiple related findings
				let maxSim = 0;
				let totalSim = 0;
				let pairs = 0;
				for (const f1 of cluster1) {
					for (const f2 of cluster2) {
						const sim = findingSimilarity(f1, f2, config);
						maxSim = Math.max(maxSim, sim);
						totalSim += sim;
						pairs++;
					}
				}
				const avgSim = pairs > 0 ? totalSim / pairs : 0;

				// Merge if best match is very high OR average is above threshold
				// This is more forgiving for clusters with mixed findings
				const shouldMerge =
					maxSim >= 0.75 || avgSim >= config.similarityThreshold;

				if (shouldMerge) {
					// Merge cluster j into cluster i
					merged[i] = [...cluster1, ...cluster2];
					merged.splice(j, 1);
					changed = true;
					break;
				}
			}
			if (changed) break;
		}
	}

	return merged;
}

/**
 * Cluster findings from multiple models
 * @param findings - All findings from all models
 * @param allModels - List of all participating models
 * @param config - Clustering configuration
 * @returns Array of finding clusters
 */
export function clusterFindings(
	findings: Finding[],
	allModels: string[],
	config: Partial<ClusteringConfig> = {},
): FindingCluster[] {
	const fullConfig: ClusteringConfig = {
		...DEFAULT_CLUSTERING_CONFIG,
		...config,
	};

	logger.debug("Starting clustering", {
		findingCount: findings.length,
		modelCount: allModels.length,
	});

	if (findings.length === 0) {
		return [];
	}

	try {
		// Initial clustering
		let clusters = initialClustering(findings, fullConfig);

		// Merge similar clusters
		clusters = mergeSimilarClusters(clusters, fullConfig);

		// Convert to FindingCluster objects
		const result: FindingCluster[] = clusters.map((clusterFindings) => {
			const modelsInCluster = new Set(
				clusterFindings.map((f) => f.sourceModel),
			);
			const agreeingModels = [...modelsInCluster];
			const silentModels = allModels.filter((m) => !modelsInCluster.has(m));

			// Determine consensus type based on agreement
			const agreementRatio = agreeingModels.length / allModels.length;
			let consensusType: ConsensusType;
			if (
				agreementRatio >= 0.95 ||
				agreeingModels.length === allModels.length
			) {
				consensusType = "unanimous";
			} else if (agreementRatio > 0.5) {
				consensusType = "majority";
			} else if (agreeingModels.length > 1) {
				consensusType = "minority";
			} else {
				consensusType = "single";
			}

			// Calculate confidence as ratio of agreeing models
			const confidence = agreeingModels.length / allModels.length;

			return {
				id: generateClusterId(),
				title: createClusterTitle(clusterFindings),
				category: getMostCommonCategory(clusterFindings.map((f) => f.category)),
				severity: getMostSevereSeverity(clusterFindings.map((f) => f.severity)),
				canonicalLocation: getCanonicalLocation(
					clusterFindings.map((f) => f.location),
				),
				findings: clusterFindings,
				agreeingModels,
				silentModels,
				disagreingModels: [], // Will be populated by scoring module
				confidence,
				consensusType,
			};
		});

		// Sort by severity then confidence
		result.sort((a, b) => {
			const sevOrder = FINDING_SEVERITIES;
			const sevDiff =
				sevOrder.indexOf(a.severity) - sevOrder.indexOf(b.severity);
			if (sevDiff !== 0) return sevDiff;
			return b.confidence - a.confidence;
		});

		logger.debug("Clustering complete", {
			inputFindings: findings.length,
			outputClusters: result.length,
		});

		return result;
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		logger.error("Clustering failed", error, { findingCount: findings.length });
		throw new ConsensusClusteringError(message, findings.length);
	}
}

/**
 * Group clusters by confidence level
 */
export function groupByConfidence(
	clusters: FindingCluster[],
	thresholds: { high: number; moderate: number },
): {
	highConfidence: FindingCluster[];
	moderateConfidence: FindingCluster[];
	lowConfidence: FindingCluster[];
} {
	const highConfidence: FindingCluster[] = [];
	const moderateConfidence: FindingCluster[] = [];
	const lowConfidence: FindingCluster[] = [];

	for (const cluster of clusters) {
		if (cluster.confidence >= thresholds.high) {
			highConfidence.push(cluster);
		} else if (cluster.confidence >= thresholds.moderate) {
			moderateConfidence.push(cluster);
		} else {
			lowConfidence.push(cluster);
		}
	}

	return { highConfidence, moderateConfidence, lowConfidence };
}
