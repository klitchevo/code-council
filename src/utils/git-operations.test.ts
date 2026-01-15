import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	findGitRoot,
	getCurrentBranch,
	getRemoteUrl,
	isGitRepository,
	isInsideRepo,
	resolveAndValidatePath,
} from "./git-operations";

// Mock the logger
vi.mock("../logger", () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

// Mock node:fs
vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
	lstatSync: vi.fn(),
	realpathSync: vi.fn(),
}));

// Mock node:child_process
vi.mock("node:child_process", () => ({
	execSync: vi.fn(),
}));

const mockExistsSync = fs.existsSync as unknown as ReturnType<typeof vi.fn>;
const mockLstatSync = fs.lstatSync as unknown as ReturnType<typeof vi.fn>;
const mockRealpathSync = fs.realpathSync as unknown as ReturnType<typeof vi.fn>;
const mockExecSync = childProcess.execSync as unknown as ReturnType<
	typeof vi.fn
>;

describe("git-operations", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("findGitRoot", () => {
		it("should find git root in current directory", () => {
			mockExistsSync.mockImplementation((path: unknown) => {
				return String(path).endsWith(".git");
			});

			const result = findGitRoot("/project");
			expect(result).toBe("/project");
		});

		it("should find git root in parent directory", () => {
			mockExistsSync.mockImplementation((path: unknown) => {
				return path === "/project/.git";
			});

			const result = findGitRoot("/project/src/components");
			expect(result).toBe("/project");
		});

		it("should throw if not in a git repository", () => {
			mockExistsSync.mockReturnValue(false);

			expect(() => findGitRoot("/not-a-repo")).toThrow(
				"Not in a git repository",
			);
		});

		it("should throw if max depth exceeded", () => {
			// This tests the depth limit by mocking a very deep path
			mockExistsSync.mockReturnValue(false);

			// Create a path that would exceed depth
			const deepPath = "/a".repeat(30);
			expect(() => findGitRoot(deepPath)).toThrow();
		});
	});

	describe("isInsideRepo", () => {
		it("should return true for paths inside repo", () => {
			expect(isInsideRepo("/repo/src/file.ts", "/repo")).toBe(true);
			expect(isInsideRepo("/repo/nested/deep/file.ts", "/repo")).toBe(true);
		});

		it("should return false for paths outside repo", () => {
			expect(isInsideRepo("/other/file.ts", "/repo")).toBe(false);
			expect(isInsideRepo("/repo/../other/file.ts", "/repo")).toBe(false);
		});

		it("should handle path traversal attempts", () => {
			expect(isInsideRepo("/repo/src/../../etc/passwd", "/repo")).toBe(false);
		});
	});

	describe("resolveAndValidatePath", () => {
		it("should return path for regular files inside repo", () => {
			mockLstatSync.mockReturnValue({
				isSymbolicLink: () => false,
			} as ReturnType<typeof fs.lstatSync>);

			const result = resolveAndValidatePath("src/file.ts", "/repo");
			expect(result).toBe("/repo/src/file.ts");
		});

		it("should resolve symlinks and validate target", () => {
			mockLstatSync.mockReturnValue({
				isSymbolicLink: () => true,
			} as ReturnType<typeof fs.lstatSync>);
			mockRealpathSync.mockReturnValue("/repo/actual/file.ts");

			const result = resolveAndValidatePath("link.ts", "/repo");
			expect(result).toBe("/repo/actual/file.ts");
		});

		it("should reject symlinks pointing outside repo", () => {
			mockLstatSync.mockReturnValue({
				isSymbolicLink: () => true,
			} as ReturnType<typeof fs.lstatSync>);
			mockRealpathSync.mockReturnValue("/etc/passwd");

			const result = resolveAndValidatePath("evil-link.ts", "/repo");
			expect(result).toBeNull();
		});

		it("should return null on errors", () => {
			mockLstatSync.mockImplementation(() => {
				throw new Error("File not found");
			});

			const result = resolveAndValidatePath("nonexistent.ts", "/repo");
			expect(result).toBeNull();
		});
	});

	describe("isGitRepository", () => {
		it("should return true if .git exists", () => {
			mockExistsSync.mockReturnValue(true);

			expect(isGitRepository("/project")).toBe(true);
		});

		it("should return false if .git does not exist", () => {
			mockExistsSync.mockReturnValue(false);

			expect(isGitRepository("/not-a-repo")).toBe(false);
		});
	});

	describe("getCurrentBranch", () => {
		it("should return branch name", () => {
			mockExecSync.mockReturnValue("main\n");

			expect(getCurrentBranch("/repo")).toBe("main");
		});

		it("should return null for detached HEAD", () => {
			mockExecSync.mockReturnValue("HEAD\n");

			expect(getCurrentBranch("/repo")).toBeNull();
		});

		it("should return null on error", () => {
			mockExecSync.mockImplementation(() => {
				throw new Error("Not a git repository");
			});

			expect(getCurrentBranch("/not-a-repo")).toBeNull();
		});
	});

	describe("getRemoteUrl", () => {
		it("should return remote URL", () => {
			mockExecSync.mockReturnValue("git@github.com:user/repo.git\n");

			expect(getRemoteUrl("/repo")).toBe("git@github.com:user/repo.git");
		});

		it("should return null if no remote configured", () => {
			mockExecSync.mockImplementation(() => {
				throw new Error("No remote");
			});

			expect(getRemoteUrl("/repo")).toBeNull();
		});
	});
});
