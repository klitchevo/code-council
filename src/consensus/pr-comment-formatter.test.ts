import { describe, expect, it } from "vitest";
import type { MappedComment, MappingResult } from "./comment-mapper";
import {
	formatPrComments,
	type GitHubPrReview,
	serializePrReview,
} from "./pr-comment-formatter";
import type { ConsensusReport, Disagreement, FindingCluster } from "./types";
import { toClusterId, toDisagreementId, toFindingId } from "./types";

// Helper to create a minimal FindingCluster for testing
function createCluster(
	id: string,
	title: string,
	severity: "critical" | "high" | "medium" | "low" | "info" = "medium",
	description = "Test description",
	suggestion = "Test suggestion",
): FindingCluster {
	return {
		id: toClusterId(`cluster-${id}`),
		title,
		category: "bug",
		severity,
		canonicalLocation: { file: "src/test.ts", line: 10 },
		findings: [
			{
				id: toFindingId(`finding-${id}`),
				sourceModel: "model-a",
				category: "bug",
				severity,
				title,
				description,
				suggestion,
				rawExcerpt: "raw",
				extractedAt: new Date().toISOString(),
			},
		],
		agreeingModels: ["model-a", "model-b"],
		silentModels: ["model-c"],
		disagreingModels: [],
		confidence: 0.8,
		consensusType: "majority",
	};
}

// Helper to create a MappedComment
function createMappedComment(
	cluster: FindingCluster,
	path: string,
	line: number,
): MappedComment {
	return { cluster, path, line };
}

// Helper to create a minimal ConsensusReport
function createReport(
	highConfidence: FindingCluster[] = [],
	moderateConfidence: FindingCluster[] = [],
	lowConfidence: FindingCluster[] = [],
	disagreements: Disagreement[] = [],
): ConsensusReport {
	return {
		version: "1.0",
		generatedAt: new Date().toISOString(),
		executionTimeMs: 100,
		participatingModels: ["model-a", "model-b", "model-c"],
		modelWeights: {},
		thresholds: { high: 0.8, moderate: 0.5 },
		totalFindings:
			highConfidence.length + moderateConfidence.length + lowConfidence.length,
		stats: {
			unanimous: 0,
			majority: 1,
			minority: 0,
			single: 0,
			disagreements: disagreements.length,
		},
		highConfidence,
		moderateConfidence,
		lowConfidence,
		disagreements,
		metadata: {
			extractionModel: "test",
			extractionErrors: 0,
		},
	};
}

describe("pr-comment-formatter", () => {
	describe("formatPrComments", () => {
		it("should format a simple review with one inline comment", () => {
			const cluster = createCluster("1", "Test Bug");
			const report = createReport([cluster]);
			const mappingResult: MappingResult = {
				comments: [createMappedComment(cluster, "src/test.ts", 10)],
				unmapped: [],
			};

			const result = formatPrComments(report, mappingResult);

			expect(result.event).toBe("COMMENT");
			expect(result.comments).toHaveLength(1);
			expect(result.comments[0]?.path).toBe("src/test.ts");
			expect(result.comments[0]?.line).toBe(10);
			expect(result.comments[0]?.body).toContain("[MEDIUM] Test Bug");
			expect(result.comments[0]?.body).toContain("Bug");
			expect(result.comments[0]?.body).toContain("Found by:");
			expect(result.comments[0]?.body).toContain("(2/3)");
			expect(result.comments[0]?.body).toContain("80% confidence");
			expect(result.body).toContain("Code Council Multi-Model Review");
		});

		it("should include description and suggestion in comment body", () => {
			const cluster = createCluster(
				"1",
				"Test Bug",
				"high",
				"This is a bug description",
				"Fix it like this",
			);
			const report = createReport([cluster]);
			const mappingResult: MappingResult = {
				comments: [createMappedComment(cluster, "src/test.ts", 10)],
				unmapped: [],
			};

			const result = formatPrComments(report, mappingResult);

			expect(result.comments[0]?.body).toContain("This is a bug description");
			expect(result.comments[0]?.body).toContain(
				"**Suggestion:** Fix it like this",
			);
		});

		it("should format unmapped findings in summary body", () => {
			const mappedCluster = createCluster("1", "Mapped Bug");
			const unmappedCluster = createCluster("2", "Unmapped Bug");
			const report = createReport([mappedCluster, unmappedCluster]);
			const mappingResult: MappingResult = {
				comments: [createMappedComment(mappedCluster, "src/test.ts", 10)],
				unmapped: [unmappedCluster],
			};

			const result = formatPrComments(report, mappingResult);

			expect(result.body).toContain("Additional Findings");
			expect(result.body).toContain("Unmapped Bug");
		});

		it("should filter out low severity by default", () => {
			const lowCluster = createCluster("1", "Low Bug", "low");
			const infoCluster = createCluster("2", "Info Bug", "info");
			const highCluster = createCluster("3", "High Bug", "high");
			const report = createReport([highCluster], [lowCluster, infoCluster]);
			const mappingResult: MappingResult = {
				comments: [
					createMappedComment(lowCluster, "src/test.ts", 10),
					createMappedComment(infoCluster, "src/test.ts", 20),
					createMappedComment(highCluster, "src/test.ts", 30),
				],
				unmapped: [],
			};

			const result = formatPrComments(report, mappingResult);

			expect(result.comments).toHaveLength(1);
			expect(result.comments[0]?.body).toContain("High Bug");
		});

		it("should include low severity when option is set", () => {
			const lowCluster = createCluster("1", "Low Bug", "low");
			const report = createReport([], [lowCluster]);
			const mappingResult: MappingResult = {
				comments: [createMappedComment(lowCluster, "src/test.ts", 10)],
				unmapped: [],
			};

			const result = formatPrComments(report, mappingResult, {
				includeLowSeverity: true,
			});

			expect(result.comments).toHaveLength(1);
			expect(result.comments[0]?.body).toContain("Low Bug");
		});

		it("should limit comments to maxComments option", () => {
			const clusters = Array.from({ length: 50 }, (_, i) =>
				createCluster(`${i}`, `Bug ${i}`, "high"),
			);
			const report = createReport(clusters);
			const mappingResult: MappingResult = {
				comments: clusters.map((c, i) =>
					createMappedComment(c, "src/test.ts", i + 1),
				),
				unmapped: [],
			};

			const result = formatPrComments(report, mappingResult, {
				maxComments: 10,
			});

			expect(result.comments).toHaveLength(10);
		});

		it("should sort comments by severity (critical first)", () => {
			const lowCluster = createCluster("1", "Low Bug", "low");
			const criticalCluster = createCluster("2", "Critical Bug", "critical");
			const mediumCluster = createCluster("3", "Medium Bug", "medium");
			const report = createReport(
				[criticalCluster],
				[mediumCluster, lowCluster],
			);
			const mappingResult: MappingResult = {
				comments: [
					createMappedComment(lowCluster, "src/test.ts", 10),
					createMappedComment(criticalCluster, "src/test.ts", 20),
					createMappedComment(mediumCluster, "src/test.ts", 30),
				],
				unmapped: [],
			};

			const result = formatPrComments(report, mappingResult, {
				includeLowSeverity: true,
			});

			expect(result.comments[0]?.body).toContain("Critical Bug");
			expect(result.comments[1]?.body).toContain("Medium Bug");
			expect(result.comments[2]?.body).toContain("Low Bug");
		});

		it("should hide model agreement when option is set", () => {
			const cluster = createCluster("1", "Test Bug");
			const report = createReport([cluster]);
			const mappingResult: MappingResult = {
				comments: [createMappedComment(cluster, "src/test.ts", 10)],
				unmapped: [],
			};

			const result = formatPrComments(report, mappingResult, {
				showModelAgreement: false,
			});

			expect(result.comments[0]?.body).not.toContain("models");
			expect(result.comments[0]?.body).not.toContain("Confidence:");
		});

		it("should include stats in summary body", () => {
			const cluster = createCluster("1", "Test Bug");
			const report = createReport([cluster]);
			const mappingResult: MappingResult = {
				comments: [createMappedComment(cluster, "src/test.ts", 10)],
				unmapped: [],
			};

			const result = formatPrComments(report, mappingResult);

			expect(result.body).toContain("3 models");
			expect(result.body).toContain("1 findings");
			expect(result.body).toContain("1 inline comments");
		});

		it("should handle empty mapping result", () => {
			const report = createReport();
			const mappingResult: MappingResult = {
				comments: [],
				unmapped: [],
			};

			const result = formatPrComments(report, mappingResult);

			expect(result.event).toBe("COMMENT");
			expect(result.comments).toHaveLength(0);
			expect(result.body).toContain("Code Council");
		});

		it("should include disagreements in summary", () => {
			const disagreement: Disagreement = {
				id: toDisagreementId("disagreement-1"),
				clusterId: toClusterId("cluster-1"),
				topic: "Error handling approach",
				category: "bug",
				positions: [
					{ model: "model-a", stance: "Use try-catch" },
					{ model: "model-b", stance: "Use Result type" },
				],
				humanActionRequired:
					"Review and choose the appropriate error handling strategy",
			};
			const report = createReport([], [], [], [disagreement]);
			const mappingResult: MappingResult = {
				comments: [],
				unmapped: [],
			};

			const result = formatPrComments(report, mappingResult);

			expect(result.body).toContain("Disagreements (1)");
			expect(result.body).toContain("Error handling approach");
			expect(result.body).toContain("model-a: Use try-catch");
			expect(result.body).toContain("model-b: Use Result type");
		});

		it("should include footer with Code Council link", () => {
			const report = createReport();
			const mappingResult: MappingResult = {
				comments: [],
				unmapped: [],
			};

			const result = formatPrComments(report, mappingResult);

			expect(result.body).toContain(
				"[Code Council](https://github.com/klitchevo/code-council)",
			);
		});

		it("should filter out low confidence findings by default (minConfidence=0.5)", () => {
			// Create a low confidence cluster (single model = 17% confidence)
			const lowConfidenceCluster: FindingCluster = {
				id: toClusterId("cluster-low"),
				title: "Low Confidence Bug",
				category: "bug",
				severity: "high",
				canonicalLocation: { file: "src/test.ts", line: 10 },
				findings: [
					{
						id: toFindingId("finding-low"),
						sourceModel: "model-a",
						category: "bug",
						severity: "high",
						title: "Low Confidence Bug",
						description: "Test description",
						suggestion: "Test suggestion",
						rawExcerpt: "raw",
						extractedAt: new Date().toISOString(),
					},
				],
				agreeingModels: ["model-a"], // Only 1 model = 17% confidence
				silentModels: ["model-b", "model-c", "model-d", "model-e", "model-f"],
				disagreingModels: [],
				confidence: 0.17, // 1/6 models
				consensusType: "single",
			};

			// Create a high confidence cluster
			const highConfidenceCluster: FindingCluster = {
				id: toClusterId("cluster-high"),
				title: "High Confidence Bug",
				category: "bug",
				severity: "high",
				canonicalLocation: { file: "src/test.ts", line: 20 },
				findings: [
					{
						id: toFindingId("finding-high"),
						sourceModel: "model-a",
						category: "bug",
						severity: "high",
						title: "High Confidence Bug",
						description: "Test description",
						suggestion: "Test suggestion",
						rawExcerpt: "raw",
						extractedAt: new Date().toISOString(),
					},
				],
				agreeingModels: ["model-a", "model-b", "model-c", "model-d"], // 4 models = 67% confidence
				silentModels: ["model-e", "model-f"],
				disagreingModels: [],
				confidence: 0.67, // 4/6 models
				consensusType: "majority",
			};

			const report = createReport(
				[highConfidenceCluster],
				[],
				[lowConfidenceCluster],
			);
			const mappingResult: MappingResult = {
				comments: [
					createMappedComment(lowConfidenceCluster, "src/test.ts", 10),
					createMappedComment(highConfidenceCluster, "src/test.ts", 20),
				],
				unmapped: [],
			};

			const result = formatPrComments(report, mappingResult);

			// Only high confidence should be included
			expect(result.comments).toHaveLength(1);
			expect(result.comments[0]?.body).toContain("High Confidence Bug");
		});

		it("should include low confidence findings when minConfidence is 0", () => {
			const lowConfidenceCluster: FindingCluster = {
				id: toClusterId("cluster-low"),
				title: "Low Confidence Bug",
				category: "bug",
				severity: "high",
				canonicalLocation: { file: "src/test.ts", line: 10 },
				findings: [
					{
						id: toFindingId("finding-low"),
						sourceModel: "model-a",
						category: "bug",
						severity: "high",
						title: "Low Confidence Bug",
						description: "Test description",
						suggestion: "Test suggestion",
						rawExcerpt: "raw",
						extractedAt: new Date().toISOString(),
					},
				],
				agreeingModels: ["model-a"],
				silentModels: ["model-b", "model-c"],
				disagreingModels: [],
				confidence: 0.17,
				consensusType: "single",
			};

			const report = createReport([], [], [lowConfidenceCluster]);
			const mappingResult: MappingResult = {
				comments: [
					createMappedComment(lowConfidenceCluster, "src/test.ts", 10),
				],
				unmapped: [],
			};

			const result = formatPrComments(report, mappingResult, {
				minConfidence: 0,
			});

			expect(result.comments).toHaveLength(1);
			expect(result.comments[0]?.body).toContain("Low Confidence Bug");
		});

		it("should allow custom minConfidence threshold", () => {
			// Create clusters with different confidence levels
			const cluster30: FindingCluster = {
				id: toClusterId("cluster-30"),
				title: "30% Confidence Bug",
				category: "bug",
				severity: "high",
				canonicalLocation: { file: "src/test.ts", line: 10 },
				findings: [
					{
						id: toFindingId("finding-30"),
						sourceModel: "model-a",
						category: "bug",
						severity: "high",
						title: "30% Confidence Bug",
						description: "Test",
						suggestion: "Test",
						rawExcerpt: "raw",
						extractedAt: new Date().toISOString(),
					},
				],
				agreeingModels: ["model-a", "model-b"],
				silentModels: ["model-c", "model-d", "model-e", "model-f"],
				disagreingModels: [],
				confidence: 0.3,
				consensusType: "minority",
			};

			const cluster70: FindingCluster = {
				id: toClusterId("cluster-70"),
				title: "70% Confidence Bug",
				category: "bug",
				severity: "high",
				canonicalLocation: { file: "src/test.ts", line: 20 },
				findings: [
					{
						id: toFindingId("finding-70"),
						sourceModel: "model-a",
						category: "bug",
						severity: "high",
						title: "70% Confidence Bug",
						description: "Test",
						suggestion: "Test",
						rawExcerpt: "raw",
						extractedAt: new Date().toISOString(),
					},
				],
				agreeingModels: ["model-a", "model-b", "model-c", "model-d"],
				silentModels: ["model-e", "model-f"],
				disagreingModels: [],
				confidence: 0.7,
				consensusType: "majority",
			};

			const report = createReport([cluster70], [cluster30]);
			const mappingResult: MappingResult = {
				comments: [
					createMappedComment(cluster30, "src/test.ts", 10),
					createMappedComment(cluster70, "src/test.ts", 20),
				],
				unmapped: [],
			};

			// With minConfidence=0.6, only cluster70 should pass
			const result = formatPrComments(report, mappingResult, {
				minConfidence: 0.6,
			});

			expect(result.comments).toHaveLength(1);
			expect(result.comments[0]?.body).toContain("70% Confidence Bug");
		});
	});

	describe("serializePrReview", () => {
		it("should serialize review to valid JSON", () => {
			const review: GitHubPrReview = {
				body: "Test body",
				event: "COMMENT",
				comments: [
					{
						path: "src/test.ts",
						line: 10,
						body: "Test comment",
					},
				],
			};

			const json = serializePrReview(review);
			const parsed = JSON.parse(json);

			expect(parsed.body).toBe("Test body");
			expect(parsed.event).toBe("COMMENT");
			expect(parsed.comments).toHaveLength(1);
			expect(parsed.comments[0].path).toBe("src/test.ts");
		});

		it("should format JSON with indentation", () => {
			const review: GitHubPrReview = {
				body: "Test",
				event: "COMMENT",
				comments: [],
			};

			const json = serializePrReview(review);

			expect(json).toContain("\n");
			expect(json).toContain("  ");
		});
	});
});
