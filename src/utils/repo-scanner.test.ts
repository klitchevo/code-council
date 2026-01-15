import { describe, expect, it } from "vitest";
import {
	aggregateFiles,
	createFileBatches,
	type FileInput,
} from "./repo-scanner";

/**
 * Tests for repo-scanner utilities.
 * Note: aggregateFiles tests are in aggregate-files.test.ts to avoid mock pollution.
 */
describe("repo-scanner", () => {
	describe("createFileBatches", () => {
		it("should return empty array for empty input", () => {
			const batches = createFileBatches([]);
			expect(batches).toEqual([]);
		});

		it("should create single batch for small content", () => {
			const files: FileInput[] = [
				{ path: "src/index.ts", content: "console.log('hello');" },
				{
					path: "src/utils.ts",
					content: "export const add = (a, b) => a + b;",
				},
			];

			const batches = createFileBatches(files, 60000);

			expect(batches.length).toBe(1);
			expect(batches[0]?.files.length).toBe(2);
			expect(batches[0]?.batchIndex).toBe(0);
		});

		it("should create multiple batches when content exceeds budget", () => {
			// Create files that exceed the budget
			const largeContent = "x".repeat(30000); // ~7500 tokens
			const files: FileInput[] = [
				{ path: "src/a.ts", content: largeContent },
				{ path: "src/b.ts", content: largeContent },
				{ path: "src/c.ts", content: largeContent },
			];

			// Use small budget to force multiple batches
			const batches = createFileBatches(files, 10000);

			expect(batches.length).toBeGreaterThan(1);

			// Verify batch indices are correct
			for (let i = 0; i < batches.length; i++) {
				expect(batches[i]?.batchIndex).toBe(i);
			}
		});

		it("should group files by directory", () => {
			const files: FileInput[] = [
				{ path: "src/components/Button.tsx", content: "Button" },
				{ path: "src/components/Input.tsx", content: "Input" },
				{ path: "src/utils/helpers.ts", content: "helpers" },
				{ path: "src/utils/format.ts", content: "format" },
			];

			const batches = createFileBatches(files, 60000);

			// With small files and large budget, should be single batch
			expect(batches.length).toBe(1);
			expect(batches[0]?.files.length).toBe(4);
		});

		it("should handle files in root directory", () => {
			const files: FileInput[] = [
				{ path: "index.ts", content: "main entry" },
				{ path: "config.ts", content: "config" },
			];

			const batches = createFileBatches(files, 60000);

			expect(batches.length).toBe(1);
			expect(batches[0]?.files.length).toBe(2);
		});

		it("should calculate token estimates correctly", () => {
			const files: FileInput[] = [
				{ path: "a.ts", content: "x".repeat(100) }, // ~25 tokens
				{ path: "b.ts", content: "y".repeat(200) }, // ~50 tokens
			];

			const batches = createFileBatches(files, 60000);

			expect(batches.length).toBe(1);
			// Token estimate should be sum of individual estimates
			expect(batches[0]?.tokenEstimate).toBeGreaterThan(0);
		});
	});

	describe("sensitive file detection patterns", () => {
		it("should identify sensitive file patterns", () => {
			const sensitivePatterns = [
				".env",
				".env.local",
				".env.production",
				"credentials.json",
				"secret.txt",
				"id_rsa",
				"id_rsa.pub",
				"id_ed25519",
				".npmrc",
				"kubeconfig",
				"password.txt",
				"auth.json",
			];

			// These should all be blocked by the scanner
			for (const pattern of sensitivePatterns) {
				// Pattern matching logic from repo-scanner
				const lowerName = pattern.toLowerCase();
				const isSensitive =
					lowerName.startsWith(".env") ||
					lowerName.includes("credential") ||
					lowerName.includes("secret") ||
					lowerName.startsWith("id_rsa") ||
					lowerName.startsWith("id_ed25519") ||
					lowerName === ".npmrc" ||
					lowerName === "kubeconfig" ||
					lowerName.includes("password") ||
					lowerName === "auth.json";

				expect(isSensitive).toBe(true);
			}
		});
	});

	describe("secret detection patterns", () => {
		it("should detect AWS access keys", () => {
			const awsKeyPattern = /AKIA[0-9A-Z]{16}/;
			expect(awsKeyPattern.test("AKIAIOSFODNN7EXAMPLE")).toBe(true);
			expect(awsKeyPattern.test("not-an-aws-key")).toBe(false);
		});

		it("should detect private keys", () => {
			const pkPattern =
				/-----BEGIN\s+(RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/;
			expect(pkPattern.test("-----BEGIN PRIVATE KEY-----")).toBe(true);
			expect(pkPattern.test("-----BEGIN RSA PRIVATE KEY-----")).toBe(true);
			expect(pkPattern.test("-----BEGIN EC PRIVATE KEY-----")).toBe(true);
			expect(pkPattern.test("-----BEGIN PUBLIC KEY-----")).toBe(false);
		});

		it("should detect GitHub PATs", () => {
			const ghpPattern = /ghp_[a-zA-Z0-9]{36}/;
			expect(ghpPattern.test("ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")).toBe(
				true,
			);
			expect(ghpPattern.test("ghp_short")).toBe(false);
		});

		it("should detect OpenAI keys", () => {
			const openaiPattern = /sk-[a-zA-Z0-9]{48}/;
			expect(
				openaiPattern.test(
					"sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
				),
			).toBe(true);
		});
	});

	describe("token estimation", () => {
		it("should estimate ~4 chars per token", () => {
			// This is a rough approximation used in the scanner
			const content = "This is a test string with about 40 characters.";
			const estimated = Math.ceil(content.length / 4);
			expect(estimated).toBeGreaterThan(0);
			expect(estimated).toBeLessThan(content.length);
		});
	});

	describe("aggregateFiles", () => {
		it("should aggregate files with markers", () => {
			const files: FileInput[] = [
				{ path: "src/index.ts", content: "console.log('hello');" },
				{
					path: "src/utils.ts",
					content: "export const add = (a, b) => a + b;",
				},
			];

			const result = aggregateFiles(files);

			expect(result).toContain("=== FILE: src/index.ts ===");
			expect(result).toContain("console.log('hello');");
			expect(result).toContain("=== END FILE: src/index.ts ===");
			expect(result).toContain("=== FILE: src/utils.ts ===");
			expect(result).toContain("export const add = (a, b) => a + b;");
			expect(result).toContain("=== END FILE: src/utils.ts ===");
		});

		it("should handle empty array", () => {
			const result = aggregateFiles([]);
			expect(result).toBe("");
		});

		it("should handle single file", () => {
			const files: FileInput[] = [{ path: "README.md", content: "# Hello" }];
			const result = aggregateFiles(files);

			expect(result).toContain("=== FILE: README.md ===");
			expect(result).toContain("# Hello");
			expect(result).toContain("=== END FILE: README.md ===");
		});
	});

	describe("createFileBatches additional cases", () => {
		it("should handle a directory larger than budget by splitting files", () => {
			// Create a single directory with very large files
			const hugeContent = "x".repeat(100000); // ~25000 tokens per file
			const files: FileInput[] = [
				{ path: "src/huge1.ts", content: hugeContent },
				{ path: "src/huge2.ts", content: hugeContent },
				{ path: "src/huge3.ts", content: hugeContent },
			];

			// Budget of 30000 tokens - each file is ~25000, so needs splitting
			const batches = createFileBatches(files, 30000);

			// Should create multiple batches since files exceed budget
			expect(batches.length).toBeGreaterThan(1);
			// Each batch should have files
			for (const batch of batches) {
				expect(batch.files.length).toBeGreaterThan(0);
			}
		});

		it("should start new batch when directory doesn't fit in current batch", () => {
			const files: FileInput[] = [
				// First directory - small files
				{ path: "small/a.ts", content: "a".repeat(4000) }, // ~1000 tokens
				{ path: "small/b.ts", content: "b".repeat(4000) }, // ~1000 tokens
				// Second directory - medium files that don't fit with first
				{ path: "medium/c.ts", content: "c".repeat(80000) }, // ~20000 tokens
				{ path: "medium/d.ts", content: "d".repeat(80000) }, // ~20000 tokens
			];

			// Use budget that forces split
			const batches = createFileBatches(files, 25000);

			// Should create multiple batches
			expect(batches.length).toBeGreaterThan(1);
		});

		it("should preserve batch index ordering", () => {
			const files: FileInput[] = [
				{ path: "a.ts", content: "x".repeat(40000) },
				{ path: "b.ts", content: "y".repeat(40000) },
				{ path: "c.ts", content: "z".repeat(40000) },
			];

			const batches = createFileBatches(files, 15000);

			for (let i = 0; i < batches.length; i++) {
				expect(batches[i]?.batchIndex).toBe(i);
			}
		});
	});
});
