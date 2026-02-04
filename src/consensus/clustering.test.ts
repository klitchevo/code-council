/**
 * Tests for the clustering module.
 */

import { describe, expect, it } from "vitest";
import {
	clusterFindings,
	findingSimilarity,
	groupByConfidence,
} from "./clustering";
import type { Finding, FindingCluster } from "./types";
import { toClusterId, toFindingId } from "./types";

// Helper to create test findings
function createFinding(
	partial: Partial<Finding> & { sourceModel: string },
): Finding {
	return {
		id: partial.id ?? toFindingId(`test-${Date.now()}-${Math.random()}`),
		sourceModel: partial.sourceModel,
		category: partial.category ?? "security",
		severity: partial.severity ?? "high",
		title: partial.title ?? "Test Finding",
		description: partial.description ?? "Test description",
		location: partial.location,
		suggestion: partial.suggestion,
		rawExcerpt: partial.rawExcerpt ?? "raw",
		extractedAt: partial.extractedAt ?? new Date().toISOString(),
		confidence: partial.confidence,
	};
}

describe("findingSimilarity", () => {
	it("returns low similarity for different categories", () => {
		const f1 = createFinding({ sourceModel: "model1", category: "security" });
		const f2 = createFinding({
			sourceModel: "model2",
			category: "performance",
		});

		const similarity = findingSimilarity(f1, f2);
		expect(similarity).toBeLessThan(0.3);
	});

	it("returns high similarity for same category, same file, nearby lines", () => {
		const f1 = createFinding({
			sourceModel: "model1",
			category: "security",
			title: "SQL Injection",
			location: { file: "src/api.ts", line: 42 },
		});
		const f2 = createFinding({
			sourceModel: "model2",
			category: "security",
			title: "SQL Injection Risk",
			location: { file: "src/api.ts", line: 43 },
		});

		const similarity = findingSimilarity(f1, f2);
		expect(similarity).toBeGreaterThan(0.7);
	});

	it("returns high similarity for same category, same file, matching keywords", () => {
		const f1 = createFinding({
			sourceModel: "model1",
			category: "security",
			title: "Input validation issue",
			location: { file: "src/api.ts" },
		});
		const f2 = createFinding({
			sourceModel: "model2",
			category: "security",
			title: "Missing input validation",
			location: { file: "src/api.ts" },
		});

		const similarity = findingSimilarity(f1, f2);
		// Keyword matching ("validation") boosts similarity
		expect(similarity).toBeGreaterThan(0.8);
	});

	it("returns lower similarity for same file but distant lines without keyword match", () => {
		const f1 = createFinding({
			sourceModel: "model1",
			category: "bug", // Use non-security category to avoid keyword matching
			title: "Logic error in loop",
			location: { file: "src/api.ts", line: 10 },
		});
		const f2 = createFinding({
			sourceModel: "model2",
			category: "bug",
			title: "Off-by-one calculation",
			location: { file: "src/api.ts", line: 50 },
		});

		// Lines are 40 apart (outside proximity threshold)
		// Same category gives base, same file gives some credit, but no keyword match
		const similarity = findingSimilarity(f1, f2);
		// Should be moderate - same file helps but different lines and titles
		expect(similarity).toBeLessThan(0.7);
		expect(similarity).toBeGreaterThan(0.3);
	});
});

describe("clusterFindings", () => {
	const allModels = ["model1", "model2", "model3"];

	it("returns empty array for no findings", () => {
		const clusters = clusterFindings([], allModels);
		expect(clusters).toHaveLength(0);
	});

	it("creates a single cluster for one finding", () => {
		const findings = [createFinding({ sourceModel: "model1" })];
		const clusters = clusterFindings(findings, allModels);

		expect(clusters).toHaveLength(1);
		expect(clusters[0]?.consensusType).toBe("single");
		expect(clusters[0]?.agreeingModels).toContain("model1");
	});

	it("clusters similar findings from different models", () => {
		const findings = [
			createFinding({
				sourceModel: "model1",
				title: "SQL Injection",
				category: "security",
				location: { file: "src/api.ts", line: 42 },
			}),
			createFinding({
				sourceModel: "model2",
				title: "SQL Injection Vulnerability",
				category: "security",
				location: { file: "src/api.ts", line: 42 },
			}),
			createFinding({
				sourceModel: "model3",
				title: "SQL Injection Risk",
				category: "security",
				location: { file: "src/api.ts", line: 43 },
			}),
		];

		const clusters = clusterFindings(findings, allModels);

		// Should cluster into one
		expect(clusters).toHaveLength(1);
		expect(clusters[0]?.consensusType).toBe("unanimous");
		expect(clusters[0]?.agreeingModels).toHaveLength(3);
		expect(clusters[0]?.silentModels).toHaveLength(0);
	});

	it("keeps different findings in separate clusters", () => {
		const findings = [
			createFinding({
				sourceModel: "model1",
				title: "SQL Injection",
				category: "security",
				location: { file: "src/api.ts", line: 42 },
			}),
			createFinding({
				sourceModel: "model2",
				title: "N+1 Query",
				category: "performance",
				location: { file: "src/posts.ts", line: 100 },
			}),
		];

		const clusters = clusterFindings(findings, allModels);

		expect(clusters).toHaveLength(2);
	});

	it("identifies majority consensus", () => {
		const findings = [
			createFinding({
				sourceModel: "model1",
				title: "Issue",
				location: { file: "src/api.ts", line: 42 },
			}),
			createFinding({
				sourceModel: "model2",
				title: "Same Issue",
				location: { file: "src/api.ts", line: 42 },
			}),
			// model3 is silent on this
		];

		const clusters = clusterFindings(findings, allModels);

		expect(clusters).toHaveLength(1);
		expect(clusters[0]?.consensusType).toBe("majority");
		expect(clusters[0]?.agreeingModels).toHaveLength(2);
		expect(clusters[0]?.silentModels).toHaveLength(1);
	});

	it("sorts clusters by severity then confidence", () => {
		// Use different categories and descriptions to ensure they don't cluster
		const findings = [
			createFinding({
				sourceModel: "model1",
				category: "bug",
				severity: "low",
				title: "Minor typo in output",
				description: "A small typo in the console output",
			}),
			createFinding({
				sourceModel: "model1",
				category: "performance",
				severity: "critical",
				title: "Memory leak in worker",
				description: "Worker process leaks memory over time",
			}),
			createFinding({
				sourceModel: "model1",
				category: "maintainability",
				severity: "medium",
				title: "Complex nested conditionals",
				description: "Code has deeply nested if statements",
			}),
		];

		const clusters = clusterFindings(findings, allModels);

		expect(clusters).toHaveLength(3);
		expect(clusters[0]?.severity).toBe("critical");
		expect(clusters[1]?.severity).toBe("medium");
		expect(clusters[2]?.severity).toBe("low");
	});
});

describe("clustering by file and category", () => {
	it("clusters findings in same file+category regardless of issue type wording", () => {
		// These findings describe the same issue (SQL injection) but with different wording
		// Pre-clustering uses file+category only; similarity matching handles issue type
		const findings = [
			createFinding({
				sourceModel: "model1",
				category: "security",
				title: "SQL Injection via query parameter",
				description: "User input is passed to SQL query without sanitization",
				location: { file: "src/db.ts", line: 50 },
			}),
			createFinding({
				sourceModel: "model2",
				category: "security",
				title: "Unsafe database query",
				description:
					"CWE-89: SQL injection vulnerability in query construction",
				location: { file: "src/db.ts", line: 52 },
			}),
			createFinding({
				sourceModel: "model3",
				category: "security",
				title: "Database query injection",
				description: "Unparameterized SQL allows injection attacks",
				location: { file: "src/db.ts", line: 50 },
			}),
		];

		const clusters = clusterFindings(findings, ["model1", "model2", "model3"]);

		// All findings should end up in the same cluster
		expect(clusters).toHaveLength(1);
		expect(clusters[0]?.agreeingModels).toHaveLength(3);
		expect(clusters[0]?.consensusType).toBe("unanimous");
	});

	it("clusters XSS findings with different wording together", () => {
		// Test another common issue type with different keyword orderings
		const findings = [
			createFinding({
				sourceModel: "model1",
				category: "security",
				title: "XSS vulnerability in output",
				description: "User input rendered without sanitization",
				location: { file: "src/render.ts", line: 20 },
			}),
			createFinding({
				sourceModel: "model2",
				category: "security",
				title: "Cross-site scripting risk",
				description: "Unsanitized HTML output allows XSS",
				location: { file: "src/render.ts", line: 22 },
			}),
		];

		const clusters = clusterFindings(findings, ["model1", "model2"]);

		expect(clusters).toHaveLength(1);
		expect(clusters[0]?.agreeingModels).toHaveLength(2);
	});
});

describe("groupByConfidence", () => {
	// Helper to create a cluster
	function createCluster(confidence: number): FindingCluster {
		return {
			id: toClusterId("test"),
			title: "Test",
			category: "security",
			severity: "high",
			findings: [],
			agreeingModels: [],
			silentModels: [],
			disagreingModels: [],
			confidence,
			consensusType: confidence > 0.5 ? "majority" : "single",
		};
	}

	it("groups clusters by confidence thresholds", () => {
		const clusters = [
			createCluster(0.9),
			createCluster(0.85),
			createCluster(0.6),
			createCluster(0.4),
			createCluster(0.3),
		];

		const grouped = groupByConfidence(clusters, { high: 0.8, moderate: 0.5 });

		expect(grouped.highConfidence).toHaveLength(2);
		expect(grouped.moderateConfidence).toHaveLength(1);
		expect(grouped.lowConfidence).toHaveLength(2);
	});

	it("handles empty clusters array", () => {
		const grouped = groupByConfidence([], { high: 0.8, moderate: 0.5 });

		expect(grouped.highConfidence).toHaveLength(0);
		expect(grouped.moderateConfidence).toHaveLength(0);
		expect(grouped.lowConfidence).toHaveLength(0);
	});

	it("places exactly at threshold in higher group", () => {
		const clusters = [
			createCluster(0.8), // Exactly at high threshold
			createCluster(0.5), // Exactly at moderate threshold
		];

		const grouped = groupByConfidence(clusters, { high: 0.8, moderate: 0.5 });

		expect(grouped.highConfidence).toHaveLength(1);
		expect(grouped.moderateConfidence).toHaveLength(1);
	});
});
