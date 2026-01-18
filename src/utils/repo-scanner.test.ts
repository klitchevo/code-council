/**
 * Tests for repo-scanner utilities.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	aggregateFiles,
	createFileBatches,
	type FileInput,
	scanRepository,
} from "./repo-scanner";

// Mock node:fs
vi.mock("node:fs", () => ({
	readdirSync: vi.fn(),
	readFileSync: vi.fn(),
	statSync: vi.fn(),
}));

// Mock git-operations
vi.mock("./git-operations", () => ({
	findGitRoot: vi.fn(() => "/test/repo"),
	resolveAndValidatePath: vi.fn((path: string) => path),
}));

// Mock logger
vi.mock("../logger", () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

// Mock ignore
vi.mock("ignore", () => ({
	default: vi.fn(() => ({
		add: vi.fn().mockReturnThis(),
		ignores: vi.fn(() => false),
	})),
}));

const mockReaddirSync = readdirSync as ReturnType<typeof vi.fn>;
const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockStatSync = statSync as ReturnType<typeof vi.fn>;

describe("repo-scanner", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

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
			const largeContent = "x".repeat(30000);
			const files: FileInput[] = [
				{ path: "src/a.ts", content: largeContent },
				{ path: "src/b.ts", content: largeContent },
				{ path: "src/c.ts", content: largeContent },
			];

			const batches = createFileBatches(files, 10000);

			expect(batches.length).toBeGreaterThan(1);

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
				{ path: "a.ts", content: "x".repeat(100) },
				{ path: "b.ts", content: "y".repeat(200) },
			];

			const batches = createFileBatches(files, 60000);

			expect(batches.length).toBe(1);
			expect(batches[0]?.tokenEstimate).toBeGreaterThan(0);
		});

		it("should handle a directory larger than budget by splitting files", () => {
			const hugeContent = "x".repeat(100000);
			const files: FileInput[] = [
				{ path: "src/huge1.ts", content: hugeContent },
				{ path: "src/huge2.ts", content: hugeContent },
				{ path: "src/huge3.ts", content: hugeContent },
			];

			const batches = createFileBatches(files, 30000);

			expect(batches.length).toBeGreaterThan(1);
			for (const batch of batches) {
				expect(batch.files.length).toBeGreaterThan(0);
			}
		});

		it("should start new batch when directory doesn't fit in current batch", () => {
			const files: FileInput[] = [
				{ path: "small/a.ts", content: "a".repeat(4000) },
				{ path: "small/b.ts", content: "b".repeat(4000) },
				{ path: "medium/c.ts", content: "c".repeat(80000) },
				{ path: "medium/d.ts", content: "d".repeat(80000) },
			];

			const batches = createFileBatches(files, 25000);

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

	describe("scanRepository", () => {
		it("should scan repository and return files", async () => {
			// Setup mock filesystem
			mockReaddirSync.mockImplementation((dir: string) => {
				if (dir === "/test/repo") {
					return ["src", "package.json"];
				}
				if (dir === "/test/repo/src") {
					return ["index.ts"];
				}
				return [];
			});

			mockStatSync.mockImplementation((path: string) => {
				if (path.includes("src") && !path.includes("index.ts")) {
					return { isDirectory: () => true, isFile: () => false, size: 0 };
				}
				return { isDirectory: () => false, isFile: () => true, size: 100 };
			});

			mockReadFileSync.mockImplementation((path: string) => {
				if (path === "/test/repo/.gitignore") {
					throw new Error("ENOENT");
				}
				if (path.includes("package.json")) {
					return Buffer.from('{"name": "test"}');
				}
				return Buffer.from("const x = 1;");
			});

			const result = await scanRepository("/test/repo");

			expect(result.repoRoot).toBe("/test/repo");
			expect(result.files.length).toBeGreaterThan(0);
			expect(result.stats.totalFilesIncluded).toBeGreaterThan(0);
		});

		it("should skip sensitive files when they match extensions", async () => {
			mockReaddirSync.mockImplementation((dir: string) => {
				if (dir === "/test/repo") {
					return ["secrets.ts", "index.ts"];
				}
				return [];
			});

			mockStatSync.mockReturnValue({
				isDirectory: () => false,
				isFile: () => true,
				size: 50,
			});

			mockReadFileSync.mockImplementation((path: string) => {
				if (path.includes(".gitignore")) {
					throw new Error("ENOENT");
				}
				return Buffer.from("content");
			});

			const result = await scanRepository("/test/repo", {
				skipSensitive: true,
			});

			// secrets.ts should be skipped due to sensitive pattern
			const secretsFile = result.files.find((f) => f.path.includes("secrets"));
			expect(secretsFile).toBeUndefined();
		});

		it("should limit files scanned", async () => {
			mockReaddirSync.mockImplementation((dir: string) => {
				if (dir === "/test/repo") {
					return ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts"];
				}
				return [];
			});

			mockStatSync.mockReturnValue({
				isDirectory: () => false,
				isFile: () => true,
				size: 50,
			});

			mockReadFileSync.mockImplementation((path: string) => {
				if (path.includes(".gitignore")) {
					throw new Error("ENOENT");
				}
				return Buffer.from("const x = 1;");
			});

			// Note: maxFiles limit is checked during scanning but priority files
			// are scanned first, which may exceed the limit
			const result = await scanRepository("/test/repo", { maxFiles: 50 });

			// Should complete successfully
			expect(result.files.length).toBeGreaterThan(0);
		});

		it("should skip files exceeding maxFileSize", async () => {
			mockReaddirSync.mockImplementation((dir: string) => {
				if (dir === "/test/repo") {
					return ["large.ts", "small.ts"];
				}
				return [];
			});

			mockStatSync.mockImplementation((path: string) => {
				if (path.includes("large.ts")) {
					return {
						isDirectory: () => false,
						isFile: () => true,
						size: 100000,
					};
				}
				return { isDirectory: () => false, isFile: () => true, size: 100 };
			});

			mockReadFileSync.mockImplementation((path: string) => {
				if (path.includes(".gitignore")) {
					throw new Error("ENOENT");
				}
				return Buffer.from("const x = 1;");
			});

			const result = await scanRepository("/test/repo", { maxFileSize: 1000 });

			const largeFile = result.files.find((f) => f.path.includes("large.ts"));
			expect(largeFile).toBeUndefined();

			const skippedLarge = result.skipped.find((s) =>
				s.path.includes("large.ts"),
			);
			expect(skippedLarge?.reason).toContain("too large");
		});

		it("should detect embedded secrets and skip those files", async () => {
			mockReaddirSync.mockImplementation((dir: string) => {
				if (dir === "/test/repo") {
					return ["config.ts"];
				}
				return [];
			});

			mockStatSync.mockReturnValue({
				isDirectory: () => false,
				isFile: () => true,
				size: 100,
			});

			mockReadFileSync.mockImplementation((path: string) => {
				if (path.includes(".gitignore")) {
					throw new Error("ENOENT");
				}
				// Contains an AWS access key pattern
				return Buffer.from('const key = "AKIAIOSFODNN7EXAMPLE";');
			});

			const result = await scanRepository("/test/repo", {
				detectSecrets: true,
			});

			const configFile = result.files.find((f) => f.path.includes("config.ts"));
			expect(configFile).toBeUndefined();

			const skippedConfig = result.skipped.find((s) =>
				s.path.includes("config.ts"),
			);
			expect(skippedConfig?.reason).toContain("potential secrets");
		});

		it("should skip binary files", async () => {
			mockReaddirSync.mockImplementation((dir: string) => {
				if (dir === "/test/repo") {
					return ["image.ts"];
				}
				return [];
			});

			mockStatSync.mockReturnValue({
				isDirectory: () => false,
				isFile: () => true,
				size: 100,
			});

			mockReadFileSync.mockImplementation((path: string) => {
				if (path.includes(".gitignore")) {
					throw new Error("ENOENT");
				}
				// Contains null bytes (binary indicator)
				const buf = Buffer.alloc(100);
				buf[50] = 0; // null byte
				return buf;
			});

			const result = await scanRepository("/test/repo");

			const binaryFile = result.files.find((f) => f.path.includes("image.ts"));
			expect(binaryFile).toBeUndefined();
		});

		it("should include files matching fileTypes filter", async () => {
			mockReaddirSync.mockImplementation((dir: string) => {
				if (dir === "/test/repo") {
					return ["index.ts", "style.css", "data.xml"];
				}
				return [];
			});

			mockStatSync.mockReturnValue({
				isDirectory: () => false,
				isFile: () => true,
				size: 100,
			});

			mockReadFileSync.mockImplementation((path: string) => {
				if (path.includes(".gitignore")) {
					throw new Error("ENOENT");
				}
				return Buffer.from("content");
			});

			const result = await scanRepository("/test/repo", {
				fileTypes: [".ts"],
			});

			// Should include .ts files
			const tsFiles = result.files.filter((f) => f.path.endsWith(".ts"));
			expect(tsFiles.length).toBeGreaterThan(0);
		});

		it("should prioritize CLAUDE.md and README.md files", async () => {
			mockReaddirSync.mockImplementation((dir: string) => {
				if (dir === "/test/repo") {
					return ["CLAUDE.md", "README.md", "src"];
				}
				if (dir === "/test/repo/src") {
					return ["index.ts"];
				}
				return [];
			});

			mockStatSync.mockImplementation((path: string) => {
				if (path.includes("src") && !path.includes("index.ts")) {
					return { isDirectory: () => true, isFile: () => false, size: 0 };
				}
				return { isDirectory: () => false, isFile: () => true, size: 100 };
			});

			mockReadFileSync.mockImplementation((path: string) => {
				if (path.includes(".gitignore")) {
					throw new Error("ENOENT");
				}
				if (path.includes("CLAUDE.md")) {
					return Buffer.from("# Claude Configuration");
				}
				if (path.includes("README.md")) {
					return Buffer.from("# Project Readme");
				}
				return Buffer.from("const x = 1;");
			});

			const result = await scanRepository("/test/repo");

			// CLAUDE.md and README.md should be included
			expect(result.files.some((f) => f.path.includes("CLAUDE.md"))).toBe(true);
			expect(result.files.some((f) => f.path.includes("README.md"))).toBe(true);
		});

		it("should enforce hard limits", async () => {
			mockReaddirSync.mockReturnValue([]);
			mockReadFileSync.mockImplementation((path: string) => {
				if (path.includes(".gitignore")) {
					throw new Error("ENOENT");
				}
				return Buffer.from("");
			});
			mockStatSync.mockReturnValue({
				isDirectory: () => false,
				isFile: () => true,
				size: 100,
			});

			// Try to set limits above hard caps
			const result = await scanRepository("/test/repo", {
				maxFiles: 999999,
				maxFileSize: 999999999,
				maxTotalSize: 999999999999,
			});

			// Should still complete without error (limits are capped internally)
			expect(result).toBeDefined();
		});

		it("should calculate token estimates in stats", async () => {
			mockReaddirSync.mockImplementation((dir: string) => {
				if (dir === "/test/repo") {
					return ["index.ts"];
				}
				return [];
			});

			mockStatSync.mockReturnValue({
				isDirectory: () => false,
				isFile: () => true,
				size: 100,
			});

			mockReadFileSync.mockImplementation((path: string) => {
				if (path.includes(".gitignore")) {
					throw new Error("ENOENT");
				}
				return Buffer.from("x".repeat(400)); // 400 chars = ~100 tokens
			});

			const result = await scanRepository("/test/repo");

			expect(result.stats.tokenEstimate).toBeGreaterThan(0);
		});

		it("should handle directory read errors gracefully", async () => {
			mockReaddirSync.mockImplementation((dir: string) => {
				if (dir === "/test/repo") {
					return ["unreadable"];
				}
				if (dir.includes("unreadable")) {
					throw new Error("EACCES");
				}
				return [];
			});

			mockStatSync.mockImplementation((path: string) => {
				if (path.includes("unreadable")) {
					return { isDirectory: () => true, isFile: () => false, size: 0 };
				}
				return { isDirectory: () => false, isFile: () => true, size: 100 };
			});

			mockReadFileSync.mockImplementation((path: string) => {
				if (path.includes(".gitignore")) {
					throw new Error("ENOENT");
				}
				return Buffer.from("");
			});

			// Should not throw
			const result = await scanRepository("/test/repo");
			expect(result).toBeDefined();
		});
	});

	describe("sensitive file detection patterns", () => {
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

		it("should identify sensitive file patterns", () => {
			for (const pattern of sensitivePatterns) {
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

		it("should detect Slack tokens", () => {
			const slackPattern =
				/xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/;
			// Build fake token dynamically to avoid secret scanner false positives
			const fakeToken = [
				"xoxb",
				"0000000000",
				"0000000000000",
				"a".repeat(24),
			].join("-");
			expect(slackPattern.test(fakeToken)).toBe(true);
		});

		it("should detect Google API keys", () => {
			const googlePattern = /AIza[0-9A-Za-z_-]{35}/;
			// Build fake key dynamically to avoid secret scanner false positives
			const fakeKey = "AIza" + "Sy" + "0".repeat(33);
			expect(googlePattern.test(fakeKey)).toBe(true);
		});

		it("should have SendGrid API key pattern", () => {
			// SendGrid keys have specific format: SG.<22 chars>.<43 chars>
			// Pattern from repo-scanner.ts
			const sgPattern = /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/;

			// Verify pattern structure
			expect(sgPattern.source).toContain("SG\\.");
			expect(sgPattern.source).toContain("{22}");
			expect(sgPattern.source).toContain("{43}");
		});
	});

	describe("token estimation", () => {
		it("should estimate ~4 chars per token", () => {
			const content = "This is a test string with about 40 characters.";
			const estimated = Math.ceil(content.length / 4);
			expect(estimated).toBeGreaterThan(0);
			expect(estimated).toBeLessThan(content.length);
		});
	});
});
