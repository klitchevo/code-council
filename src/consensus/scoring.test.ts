/**
 * Tests for the scoring module.
 */

import { describe, expect, it } from "vitest";
import {
	calculateConfidence,
	calculateStats,
	detectAllDisagreements,
	detectDisagreement,
	determineConsensusType,
} from "./scoring";
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

// Helper to create test clusters
function createCluster(partial: Partial<FindingCluster>): FindingCluster {
	return {
		id: partial.id ?? toClusterId(`test-${Date.now()}`),
		title: partial.title ?? "Test Cluster",
		category: partial.category ?? "security",
		severity: partial.severity ?? "high",
		canonicalLocation: partial.canonicalLocation,
		findings: partial.findings ?? [],
		agreeingModels: partial.agreeingModels ?? [],
		silentModels: partial.silentModels ?? [],
		disagreingModels: partial.disagreingModels ?? [],
		confidence: partial.confidence ?? 0.5,
		consensusType: partial.consensusType ?? "majority",
	};
}

describe("calculateConfidence", () => {
	const allModels = ["model1", "model2", "model3"];

	it("returns 1 when all models agree", () => {
		const confidence = calculateConfidence(
			["model1", "model2", "model3"],
			allModels,
		);
		expect(confidence).toBe(1);
	});

	it("returns 0 when no models agree", () => {
		const confidence = calculateConfidence([], allModels);
		expect(confidence).toBe(0);
	});

	it("returns correct ratio for partial agreement", () => {
		const confidence = calculateConfidence(["model1", "model2"], allModels);
		expect(confidence).toBeCloseTo(2 / 3, 5);
	});

	it("handles weighted models", () => {
		const confidence = calculateConfidence(["model1"], allModels, {
			modelWeights: { model1: 2.0 }, // model1 is worth 2
			defaultWeight: 1.0,
		});
		// model1 weight = 2, total = 2+1+1 = 4
		expect(confidence).toBe(0.5);
	});

	it("returns 0 for empty model list", () => {
		const confidence = calculateConfidence([], []);
		expect(confidence).toBe(0);
	});
});

describe("determineConsensusType", () => {
	it("returns unanimous for >= 95% confidence", () => {
		expect(determineConsensusType(0.95, 3, 3)).toBe("unanimous");
		expect(determineConsensusType(1.0, 3, 3)).toBe("unanimous");
	});

	it("returns unanimous when all models agree", () => {
		expect(determineConsensusType(0.7, 2, 2)).toBe("unanimous");
	});

	it("returns single for single agreeing model", () => {
		expect(determineConsensusType(0.33, 1, 3)).toBe("single");
	});

	it("returns majority for > 50% but not unanimous", () => {
		expect(determineConsensusType(0.67, 2, 3)).toBe("majority");
	});

	it("returns minority for <= 50% with multiple models", () => {
		expect(determineConsensusType(0.4, 2, 5)).toBe("minority");
	});
});

describe("detectDisagreement", () => {
	it("returns null for cluster with single finding", () => {
		const cluster = createCluster({
			findings: [createFinding({ sourceModel: "model1" })],
		});

		const disagreement = detectDisagreement(cluster);
		expect(disagreement).toBeNull();
	});

	it("returns null when severities are similar", () => {
		const cluster = createCluster({
			findings: [
				createFinding({ sourceModel: "model1", severity: "high" }),
				createFinding({ sourceModel: "model2", severity: "high" }),
			],
		});

		const disagreement = detectDisagreement(cluster);
		expect(disagreement).toBeNull();
	});

	it("detects severity disagreement", () => {
		const cluster = createCluster({
			findings: [
				createFinding({ sourceModel: "model1", severity: "critical" }),
				createFinding({ sourceModel: "model2", severity: "low" }),
			],
		});

		const disagreement = detectDisagreement(cluster);
		expect(disagreement).not.toBeNull();
		expect(disagreement?.topic).toContain("Severity disagreement");
	});

	it("detects contradictory suggestions", () => {
		const cluster = createCluster({
			findings: [
				createFinding({
					sourceModel: "model1",
					suggestion: "You should remove this code",
				}),
				createFinding({
					sourceModel: "model2",
					suggestion: "Keep this code as is",
				}),
			],
		});

		const disagreement = detectDisagreement(cluster);
		expect(disagreement).not.toBeNull();
		expect(disagreement?.topic).toContain("Conflicting recommendations");
	});

	it("captures positions from each model", () => {
		const cluster = createCluster({
			findings: [
				createFinding({
					sourceModel: "model1",
					severity: "critical",
					title: "Critical issue",
				}),
				createFinding({
					sourceModel: "model2",
					severity: "info",
					title: "Minor note",
				}),
			],
		});

		const disagreement = detectDisagreement(cluster);
		expect(disagreement?.positions).toHaveLength(2);
		expect(
			disagreement?.positions.find((p) => p.model === "model1"),
		).toBeTruthy();
		expect(
			disagreement?.positions.find((p) => p.model === "model2"),
		).toBeTruthy();
	});
});

describe("detectAllDisagreements", () => {
	it("returns empty array for no clusters", () => {
		const disagreements = detectAllDisagreements([]);
		expect(disagreements).toHaveLength(0);
	});

	it("returns disagreements from multiple clusters", () => {
		const clusters = [
			createCluster({
				findings: [
					createFinding({ sourceModel: "model1", severity: "critical" }),
					createFinding({ sourceModel: "model2", severity: "low" }),
				],
			}),
			createCluster({
				findings: [
					createFinding({
						sourceModel: "model1",
						suggestion: "Use this approach",
					}),
					createFinding({
						sourceModel: "model2",
						suggestion: "Avoid this approach",
					}),
				],
			}),
		];

		const disagreements = detectAllDisagreements(clusters);
		expect(disagreements.length).toBeGreaterThanOrEqual(1);
	});
});

describe("calculateStats", () => {
	it("counts consensus types correctly", () => {
		const clusters = [
			createCluster({ consensusType: "unanimous" }),
			createCluster({ consensusType: "unanimous" }),
			createCluster({ consensusType: "majority" }),
			createCluster({ consensusType: "minority" }),
			createCluster({ consensusType: "single" }),
			createCluster({ consensusType: "single" }),
		];

		const stats = calculateStats(clusters, []);

		expect(stats.unanimous).toBe(2);
		expect(stats.majority).toBe(1);
		expect(stats.minority).toBe(1);
		expect(stats.single).toBe(2);
	});

	it("counts disagreements", () => {
		const disagreements = [{ id: "d1" }, { id: "d2" }, { id: "d3" }] as any[];

		const stats = calculateStats([], disagreements);
		expect(stats.disagreements).toBe(3);
	});

	it("handles empty arrays", () => {
		const stats = calculateStats([], []);

		expect(stats.unanimous).toBe(0);
		expect(stats.majority).toBe(0);
		expect(stats.minority).toBe(0);
		expect(stats.single).toBe(0);
		expect(stats.disagreements).toBe(0);
	});
});
