import { describe, expect, it } from "vitest";
import { parseUnifiedDiff } from "../utils/diff-parser";
import {
	countMappedComments,
	countUnmappedFindings,
	filterCommentsBySeverity,
	groupCommentsByFile,
	mapClustersToComments,
} from "./comment-mapper";
import type { FindingCluster } from "./types";
import { toClusterId } from "./types";

// Helper to create a minimal FindingCluster for testing
function createCluster(
	id: string,
	file?: string,
	line?: number,
	severity: "critical" | "high" | "medium" | "low" | "info" = "medium",
): FindingCluster {
	return {
		id: toClusterId(`cluster-${id}`),
		title: `Finding ${id}`,
		category: "bug",
		severity,
		canonicalLocation: file ? { file, line } : undefined,
		findings: [],
		agreeingModels: ["model-a", "model-b"],
		silentModels: [],
		disagreingModels: [],
		confidence: 0.8,
		consensusType: "majority",
	};
}

describe("comment-mapper", () => {
	const sampleDiff = parseUnifiedDiff(`diff --git a/src/foo.ts b/src/foo.ts
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,3 +1,5 @@
 export function foo() {
+  console.log("debug");
+  const x = 1;
   return "foo";
 }
diff --git a/src/bar.ts b/src/bar.ts
--- a/src/bar.ts
+++ b/src/bar.ts
@@ -5,6 +5,7 @@ import { helper } from "./helper";

 export function bar() {
   const a = 1;
+  const b = 2;
   return a;
 }`);

	describe("mapClustersToComments", () => {
		it("should map cluster with valid location on changed line", () => {
			const clusters = [createCluster("1", "src/foo.ts", 2)];

			const result = mapClustersToComments(clusters, sampleDiff);

			expect(result.comments).toHaveLength(1);
			expect(result.comments[0]?.path).toBe("src/foo.ts");
			expect(result.comments[0]?.line).toBe(2);
			expect(result.comments[0]?.cluster.id).toBe("cluster-1");
			expect(result.unmapped).toHaveLength(0);
		});

		it("should map cluster with line not in changed lines to nearest changed line", () => {
			const clusters = [createCluster("1", "src/foo.ts", 1)]; // Line 1 not changed, but line 2 is

			const result = mapClustersToComments(clusters, sampleDiff);

			// With fuzzy matching, it should map to nearest changed line (line 2)
			expect(result.comments).toHaveLength(1);
			expect(result.comments[0]?.line).toBe(2); // Mapped to nearest changed line
			expect(result.unmapped).toHaveLength(0);
		});

		it("should not map cluster with file not in diff", () => {
			const clusters = [createCluster("1", "src/baz.ts", 5)];

			const result = mapClustersToComments(clusters, sampleDiff);

			expect(result.comments).toHaveLength(0);
			expect(result.unmapped).toHaveLength(1);
		});

		it("should not map cluster without location", () => {
			const clusters = [createCluster("1", undefined, undefined)];

			const result = mapClustersToComments(clusters, sampleDiff);

			expect(result.comments).toHaveLength(0);
			expect(result.unmapped).toHaveLength(1);
		});

		it("should map cluster with file but no line to first changed line", () => {
			const clusters = [createCluster("1", "src/foo.ts", undefined)];

			const result = mapClustersToComments(clusters, sampleDiff);

			// With fuzzy matching, file-level comments go to first changed line
			expect(result.comments).toHaveLength(1);
			expect(result.comments[0]?.line).toBe(2); // First changed line in foo.ts
			expect(result.unmapped).toHaveLength(0);
		});

		it("should handle multiple clusters with mixed mappability", () => {
			const clusters = [
				createCluster("1", "src/foo.ts", 2), // Valid - changed line
				createCluster("2", "src/foo.ts", 1), // Maps to nearest changed line (fuzzy)
				createCluster("3", "src/bar.ts", 8), // Valid - changed line
				createCluster("4", "src/baz.ts", 5), // Invalid - file not in diff
				createCluster("5", undefined, undefined), // Invalid - no location
			];

			const result = mapClustersToComments(clusters, sampleDiff);

			// Cluster 2 now maps to nearest changed line (line 2) thanks to fuzzy matching
			expect(result.comments).toHaveLength(3);
			expect(result.comments[0]?.cluster.id).toBe("cluster-1");
			expect(result.comments[1]?.cluster.id).toBe("cluster-2");
			expect(result.comments[2]?.cluster.id).toBe("cluster-3");
			expect(result.unmapped).toHaveLength(2); // Only baz.ts and no-location
		});

		it("should handle normalized path with ./ prefix", () => {
			const clusters = [createCluster("1", "./src/foo.ts", 2)];

			const result = mapClustersToComments(clusters, sampleDiff);

			expect(result.comments).toHaveLength(1);
			expect(result.comments[0]?.path).toBe("src/foo.ts");
		});

		it("should return empty results for empty clusters array", () => {
			const result = mapClustersToComments([], sampleDiff);

			expect(result.comments).toHaveLength(0);
			expect(result.unmapped).toHaveLength(0);
		});

		it("should return all unmapped for empty diff", () => {
			const emptyDiff = parseUnifiedDiff("");
			const clusters = [createCluster("1", "src/foo.ts", 2)];

			const result = mapClustersToComments(clusters, emptyDiff);

			expect(result.comments).toHaveLength(0);
			expect(result.unmapped).toHaveLength(1);
		});
	});

	describe("countMappedComments", () => {
		it("should return count of mapped comments", () => {
			const clusters = [
				createCluster("1", "src/foo.ts", 2),
				createCluster("2", "src/foo.ts", 3),
			];
			const result = mapClustersToComments(clusters, sampleDiff);

			expect(countMappedComments(result)).toBe(2);
		});

		it("should return 0 for empty result", () => {
			const result = mapClustersToComments([], sampleDiff);
			expect(countMappedComments(result)).toBe(0);
		});
	});

	describe("countUnmappedFindings", () => {
		it("should return count of unmapped findings", () => {
			const clusters = [
				createCluster("1", "src/foo.ts", 1), // Maps to nearest changed line (fuzzy)
				createCluster("2", "src/baz.ts", 5), // File not in diff - unmapped
			];
			const result = mapClustersToComments(clusters, sampleDiff);

			// Only 1 unmapped - foo.ts cluster maps to nearest changed line
			expect(countUnmappedFindings(result)).toBe(1);
		});
	});

	describe("filterCommentsBySeverity", () => {
		it("should filter by minimum severity", () => {
			const clusters = [
				createCluster("1", "src/foo.ts", 2, "critical"),
				createCluster("2", "src/foo.ts", 3, "high"),
				createCluster("3", "src/bar.ts", 8, "low"),
			];
			const result = mapClustersToComments(clusters, sampleDiff);

			const highAndAbove = filterCommentsBySeverity(result, "high");
			expect(highAndAbove).toHaveLength(2);
			expect(highAndAbove[0]?.cluster.severity).toBe("critical");
			expect(highAndAbove[1]?.cluster.severity).toBe("high");
		});

		it("should include all severities when filtering by info", () => {
			const clusters = [
				createCluster("1", "src/foo.ts", 2, "critical"),
				createCluster("2", "src/foo.ts", 3, "info"),
			];
			const result = mapClustersToComments(clusters, sampleDiff);

			const all = filterCommentsBySeverity(result, "info");
			expect(all).toHaveLength(2);
		});

		it("should return only critical when filtering by critical", () => {
			const clusters = [
				createCluster("1", "src/foo.ts", 2, "critical"),
				createCluster("2", "src/foo.ts", 3, "high"),
			];
			const result = mapClustersToComments(clusters, sampleDiff);

			const criticalOnly = filterCommentsBySeverity(result, "critical");
			expect(criticalOnly).toHaveLength(1);
			expect(criticalOnly[0]?.cluster.severity).toBe("critical");
		});
	});

	describe("groupCommentsByFile", () => {
		it("should group comments by file path", () => {
			const clusters = [
				createCluster("1", "src/foo.ts", 2),
				createCluster("2", "src/foo.ts", 3),
				createCluster("3", "src/bar.ts", 8),
			];
			const result = mapClustersToComments(clusters, sampleDiff);

			const grouped = groupCommentsByFile(result.comments);

			expect(grouped.size).toBe(2);
			expect(grouped.get("src/foo.ts")).toHaveLength(2);
			expect(grouped.get("src/bar.ts")).toHaveLength(1);
		});

		it("should handle empty comments array", () => {
			const grouped = groupCommentsByFile([]);
			expect(grouped.size).toBe(0);
		});
	});
});
