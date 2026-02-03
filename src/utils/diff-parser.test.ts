import { describe, expect, it } from "vitest";
import {
	getChangedLinesForFile,
	isLineChanged,
	normalizePath,
	parseUnifiedDiff,
} from "./diff-parser";

describe("diff-parser", () => {
	describe("parseUnifiedDiff", () => {
		it("should return empty files array for empty input", () => {
			const result = parseUnifiedDiff("");
			expect(result.files).toEqual([]);
		});

		it("should return empty files array for whitespace-only input", () => {
			const result = parseUnifiedDiff("   \n\t\n  ");
			expect(result.files).toEqual([]);
		});

		it("should parse a simple single-file diff", () => {
			const diff = `diff --git a/src/index.ts b/src/index.ts
index 1234567..abcdefg 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,4 @@
 import { foo } from "./foo";
+import { bar } from "./bar";

 export function main() {`;

			const result = parseUnifiedDiff(diff);

			expect(result.files).toHaveLength(1);
			expect(result.files[0]?.oldPath).toBe("src/index.ts");
			expect(result.files[0]?.newPath).toBe("src/index.ts");
			expect(result.files[0]?.hunks).toHaveLength(1);
			expect(result.files[0]?.changedLines.has(2)).toBe(true);
			expect(result.files[0]?.changedLines.size).toBe(1);
		});

		it("should parse multiple hunks in a single file", () => {
			const diff = `diff --git a/src/utils.ts b/src/utils.ts
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -5,6 +5,7 @@ import { helper } from "./helper";

 export function utilA() {
   return "a";
+  // Added comment
 }

 export function utilB() {
@@ -20,6 +21,7 @@ export function utilC() {

 export function utilD() {
   return "d";
+  // Another comment
 }`;

			const result = parseUnifiedDiff(diff);

			expect(result.files).toHaveLength(1);
			expect(result.files[0]?.hunks).toHaveLength(2);
			expect(result.files[0]?.changedLines.has(8)).toBe(true);
			expect(result.files[0]?.changedLines.has(24)).toBe(true);
			expect(result.files[0]?.changedLines.size).toBe(2);
		});

		it("should parse multiple files in a diff", () => {
			const diff = `diff --git a/src/foo.ts b/src/foo.ts
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,3 +1,4 @@
 export function foo() {
+  console.log("foo");
   return "foo";
 }
diff --git a/src/bar.ts b/src/bar.ts
--- a/src/bar.ts
+++ b/src/bar.ts
@@ -1,3 +1,4 @@
 export function bar() {
+  console.log("bar");
   return "bar";
 }`;

			const result = parseUnifiedDiff(diff);

			expect(result.files).toHaveLength(2);
			expect(result.files[0]?.newPath).toBe("src/foo.ts");
			expect(result.files[0]?.changedLines.has(2)).toBe(true);
			expect(result.files[1]?.newPath).toBe("src/bar.ts");
			expect(result.files[1]?.changedLines.has(2)).toBe(true);
		});

		it("should handle deleted lines (not in changedLines)", () => {
			const diff = `diff --git a/src/test.ts b/src/test.ts
--- a/src/test.ts
+++ b/src/test.ts
@@ -1,4 +1,3 @@
 export function test() {
-  console.log("removed");
   return "test";
 }`;

			const result = parseUnifiedDiff(diff);

			expect(result.files).toHaveLength(1);
			expect(result.files[0]?.changedLines.size).toBe(0);
		});

		it("should handle mixed additions and deletions", () => {
			const diff = `diff --git a/src/mixed.ts b/src/mixed.ts
--- a/src/mixed.ts
+++ b/src/mixed.ts
@@ -1,5 +1,5 @@
 export function mixed() {
-  const old = "old";
+  const new = "new";
   return "mixed";
 }`;

			const result = parseUnifiedDiff(diff);

			expect(result.files).toHaveLength(1);
			// The replacement line should be tracked
			expect(result.files[0]?.changedLines.has(2)).toBe(true);
			expect(result.files[0]?.changedLines.size).toBe(1);
		});

		it("should parse hunk headers without count (implies count of 1)", () => {
			const diff = `diff --git a/src/single.ts b/src/single.ts
--- a/src/single.ts
+++ b/src/single.ts
@@ -1 +1,2 @@
 export const x = 1;
+export const y = 2;`;

			const result = parseUnifiedDiff(diff);

			expect(result.files).toHaveLength(1);
			expect(result.files[0]?.hunks).toHaveLength(1);
			expect(result.files[0]?.hunks[0]?.oldCount).toBe(1);
			expect(result.files[0]?.hunks[0]?.newCount).toBe(2);
			expect(result.files[0]?.changedLines.has(2)).toBe(true);
		});

		it("should handle new files (--- /dev/null)", () => {
			const diff = `diff --git a/src/new-file.ts b/src/new-file.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/new-file.ts
@@ -0,0 +1,3 @@
+export function newFile() {
+  return "new";
+}`;

			const result = parseUnifiedDiff(diff);

			expect(result.files).toHaveLength(1);
			expect(result.files[0]?.newPath).toBe("src/new-file.ts");
			expect(result.files[0]?.changedLines.has(1)).toBe(true);
			expect(result.files[0]?.changedLines.has(2)).toBe(true);
			expect(result.files[0]?.changedLines.has(3)).toBe(true);
		});

		it("should handle deleted files (+++ /dev/null)", () => {
			const diff = `diff --git a/src/deleted.ts b/src/deleted.ts
deleted file mode 100644
index 1234567..0000000
--- a/src/deleted.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-export function deleted() {
-  return "deleted";
-}`;

			const result = parseUnifiedDiff(diff);

			expect(result.files).toHaveLength(1);
			expect(result.files[0]?.oldPath).toBe("src/deleted.ts");
			// No changed lines since everything is deleted
			expect(result.files[0]?.changedLines.size).toBe(0);
		});

		it("should handle 'No newline at end of file' marker", () => {
			const diff = `diff --git a/src/no-newline.ts b/src/no-newline.ts
--- a/src/no-newline.ts
+++ b/src/no-newline.ts
@@ -1,2 +1,3 @@
 export const x = 1;
-export const y = 2;
\\ No newline at end of file
+export const y = 2;
+export const z = 3;
\\ No newline at end of file`;

			const result = parseUnifiedDiff(diff);

			expect(result.files).toHaveLength(1);
			expect(result.files[0]?.changedLines.has(2)).toBe(true);
			expect(result.files[0]?.changedLines.has(3)).toBe(true);
		});

		it("should handle renamed files", () => {
			const diff = `diff --git a/src/old-name.ts b/src/new-name.ts
similarity index 95%
rename from src/old-name.ts
rename to src/new-name.ts
index 1234567..abcdefg 100644
--- a/src/old-name.ts
+++ b/src/new-name.ts
@@ -1,3 +1,4 @@
 export function renamed() {
+  console.log("renamed");
   return "renamed";
 }`;

			const result = parseUnifiedDiff(diff);

			expect(result.files).toHaveLength(1);
			expect(result.files[0]?.oldPath).toBe("src/old-name.ts");
			expect(result.files[0]?.newPath).toBe("src/new-name.ts");
			expect(result.files[0]?.changedLines.has(2)).toBe(true);
		});
	});

	describe("normalizePath", () => {
		it("should remove leading ./", () => {
			expect(normalizePath("./src/index.ts")).toBe("src/index.ts");
		});

		it("should remove leading /", () => {
			expect(normalizePath("/src/index.ts")).toBe("src/index.ts");
		});

		it("should handle paths without prefix", () => {
			expect(normalizePath("src/index.ts")).toBe("src/index.ts");
		});

		it("should handle empty string", () => {
			expect(normalizePath("")).toBe("");
		});

		it("should handle multiple leading dots", () => {
			expect(normalizePath("./././src/index.ts")).toBe("././src/index.ts");
		});
	});

	describe("getChangedLinesForFile", () => {
		const diff = parseUnifiedDiff(`diff --git a/src/foo.ts b/src/foo.ts
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,3 +1,4 @@
 export function foo() {
+  console.log("foo");
   return "foo";
 }`);

		it("should return changed lines for exact path match", () => {
			const lines = getChangedLinesForFile(diff, "src/foo.ts");
			expect(lines).toBeDefined();
			expect(lines?.has(2)).toBe(true);
		});

		it("should return changed lines for path with ./ prefix", () => {
			const lines = getChangedLinesForFile(diff, "./src/foo.ts");
			expect(lines).toBeDefined();
			expect(lines?.has(2)).toBe(true);
		});

		it("should return undefined for non-existent file", () => {
			const lines = getChangedLinesForFile(diff, "src/bar.ts");
			expect(lines).toBeUndefined();
		});
	});

	describe("isLineChanged", () => {
		const diff = parseUnifiedDiff(`diff --git a/src/foo.ts b/src/foo.ts
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,3 +1,4 @@
 export function foo() {
+  console.log("foo");
   return "foo";
 }`);

		it("should return true for changed line", () => {
			expect(isLineChanged(diff, "src/foo.ts", 2)).toBe(true);
		});

		it("should return false for unchanged line", () => {
			expect(isLineChanged(diff, "src/foo.ts", 1)).toBe(false);
			expect(isLineChanged(diff, "src/foo.ts", 3)).toBe(false);
		});

		it("should return false for non-existent file", () => {
			expect(isLineChanged(diff, "src/bar.ts", 2)).toBe(false);
		});
	});
});
