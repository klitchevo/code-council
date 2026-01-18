/**
 * Tests for init_config tool
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MODELS } from "../constants";
import { handleInitConfig, initConfigSchema } from "./init-config";

// Mock node:fs
vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
	mkdirSync: vi.fn(),
	writeFileSync: vi.fn(),
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

const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
const mockMkdirSync = mkdirSync as ReturnType<typeof vi.fn>;
const mockWriteFileSync = writeFileSync as unknown as ReturnType<
	typeof vi.fn
> & {
	mock: { calls: Array<[string, string]> };
};

describe("init-config", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockExistsSync.mockReturnValue(false);
	});

	describe("initConfigSchema", () => {
		it("has correct schema definitions", () => {
			expect(initConfigSchema.location).toBeDefined();
			expect(initConfigSchema.format).toBeDefined();
			expect(initConfigSchema.include_comments).toBeDefined();
			expect(initConfigSchema.force).toBeDefined();
		});

		it("validates location enum values", () => {
			const result = initConfigSchema.location.safeParse("directory");
			expect(result.success).toBe(true);

			const result2 = initConfigSchema.location.safeParse("root");
			expect(result2.success).toBe(true);

			const result3 = initConfigSchema.location.safeParse("invalid");
			expect(result3.success).toBe(false);
		});

		it("validates format enum values", () => {
			const result = initConfigSchema.format.safeParse("typescript");
			expect(result.success).toBe(true);

			const result2 = initConfigSchema.format.safeParse("javascript");
			expect(result2.success).toBe(true);

			const result3 = initConfigSchema.format.safeParse("invalid");
			expect(result3.success).toBe(false);
		});
	});

	describe("handleInitConfig", () => {
		describe("default behavior", () => {
			it("creates TypeScript config in .code-council directory by default", () => {
				const result = handleInitConfig({});

				expect(result.success).toBe(true);
				expect(result.path).toContain(".code-council/config.ts");
				expect(mockWriteFileSync).toHaveBeenCalledTimes(1);

				const call = mockWriteFileSync.mock.calls[0] as [string, string];
				expect(call[0]).toContain(".code-council/config.ts");
				expect(call[1]).toContain("import { defineConfig }");
				expect(call[1]).toContain("export default defineConfig");
			});

			it("creates directory if it does not exist", () => {
				mockExistsSync.mockImplementation(() => {
					// File doesn't exist, directory doesn't exist
					return false;
				});

				handleInitConfig({});

				expect(mockMkdirSync).toHaveBeenCalledWith(
					expect.stringContaining(".code-council"),
					{ recursive: true },
				);
			});

			it("includes comments by default", () => {
				handleInitConfig({});

				const call = mockWriteFileSync.mock.calls[0] as [string, string];
				expect(call[1]).toContain("/**");
				expect(call[1]).toContain("* Code Council Configuration");
				expect(call[1]).toContain("* Models Configuration");
			});
		});

		describe("location option", () => {
			it("creates config in root when location is 'root'", () => {
				const result = handleInitConfig({ location: "root" });

				expect(result.success).toBe(true);
				expect(result.path).toContain("code-council.config.ts");
				expect(result.path).not.toContain(".code-council");
			});

			it("creates config in .code-council when location is 'directory'", () => {
				const result = handleInitConfig({ location: "directory" });

				expect(result.success).toBe(true);
				expect(result.path).toContain(".code-council/config.ts");
			});
		});

		describe("format option", () => {
			it("creates TypeScript config when format is 'typescript'", () => {
				handleInitConfig({ format: "typescript" });

				const [path, content] = mockWriteFileSync.mock.calls[0]!;
				expect(path).toContain(".ts");
				expect(content).toContain("import { defineConfig }");
				expect(content).toContain("export default defineConfig");
			});

			it("creates JavaScript config when format is 'javascript'", () => {
				handleInitConfig({ format: "javascript" });

				const [path, content] = mockWriteFileSync.mock.calls[0]!;
				expect(path).toContain(".js");
				expect(content).toContain("module.exports =");
				expect(content).toContain("@type {import");
			});

			it("uses correct file extension for JavaScript in root", () => {
				handleInitConfig({ format: "javascript", location: "root" });

				const [path] = mockWriteFileSync.mock.calls[0]!;
				expect(path).toContain("code-council.config.js");
			});
		});

		describe("include_comments option", () => {
			it("includes comments when include_comments is true", () => {
				handleInitConfig({ include_comments: true });

				const [, content] = mockWriteFileSync.mock.calls[0]!;
				expect(content).toContain("/**");
				expect(content).toContain("* Models Configuration");
				expect(content).toContain("// Uncomment and customize");
			});

			it("excludes comments when include_comments is false", () => {
				handleInitConfig({ include_comments: false });

				const [, content] = mockWriteFileSync.mock.calls[0]!;
				expect(content).not.toContain("* Models Configuration");
				expect(content).not.toContain("// Uncomment and customize");
			});

			it("generates minimal TypeScript config without comments", () => {
				handleInitConfig({ format: "typescript", include_comments: false });

				const [, content] = mockWriteFileSync.mock.calls[0]!;
				expect(content).toContain("import { defineConfig }");
				expect(content).toContain("export default defineConfig");
				expect(content).not.toContain("* Code Council Configuration");
			});

			it("generates minimal JavaScript config without comments", () => {
				handleInitConfig({ format: "javascript", include_comments: false });

				const [, content] = mockWriteFileSync.mock.calls[0]!;
				expect(content).toContain("module.exports =");
				expect(content).not.toContain("* Code Council Configuration");
			});
		});

		describe("force option", () => {
			it("returns error when file exists and force is false", () => {
				mockExistsSync.mockReturnValue(true);

				const result = handleInitConfig({ force: false });

				expect(result.success).toBe(false);
				expect(result.message).toContain("already exists");
				expect(result.message).toContain("force=true");
				expect(mockWriteFileSync).not.toHaveBeenCalled();
			});

			it("overwrites file when file exists and force is true", () => {
				mockExistsSync.mockImplementation((path: string) => {
					// File exists at the config path
					if (path.includes("config.ts")) return true;
					// Directory exists
					if (path.includes(".code-council")) return true;
					return false;
				});

				const result = handleInitConfig({ force: true });

				expect(result.success).toBe(true);
				expect(mockWriteFileSync).toHaveBeenCalled();
			});

			it("defaults to not forcing overwrite", () => {
				mockExistsSync.mockReturnValue(true);

				const result = handleInitConfig({});

				expect(result.success).toBe(false);
				expect(mockWriteFileSync).not.toHaveBeenCalled();
			});
		});

		describe("config content", () => {
			it("includes default models in generated config", () => {
				handleInitConfig({});

				const [, content] = mockWriteFileSync.mock.calls[0]!;
				for (const model of DEFAULT_MODELS) {
					expect(content).toContain(model);
				}
			});

			it("includes consensus settings in generated config", () => {
				handleInitConfig({});

				const [, content] = mockWriteFileSync.mock.calls[0]!;
				expect(content).toContain("consensus:");
				expect(content).toContain("highConfidenceThreshold: 0.8");
				expect(content).toContain("moderateConfidenceThreshold: 0.5");
			});

			it("includes LLM settings in generated config", () => {
				handleInitConfig({});

				const [, content] = mockWriteFileSync.mock.calls[0]!;
				expect(content).toContain("llm:");
				expect(content).toContain("temperature: 0.3");
				expect(content).toContain("maxTokens: 16384");
			});
		});

		describe("return values", () => {
			it("returns success message with path on creation", () => {
				const result = handleInitConfig({});

				expect(result.success).toBe(true);
				expect(result.message).toContain("Created configuration file at");
				expect(result.path).toBeDefined();
			});

			it("returns error message with path when file exists", () => {
				mockExistsSync.mockReturnValue(true);

				const result = handleInitConfig({});

				expect(result.success).toBe(false);
				expect(result.message).toContain("Configuration file already exists");
				expect(result.path).toBeDefined();
			});
		});

		describe("edge cases", () => {
			it("handles all option combinations", () => {
				const combinations = [
					{
						location: "directory",
						format: "typescript",
						include_comments: true,
					},
					{
						location: "directory",
						format: "typescript",
						include_comments: false,
					},
					{
						location: "directory",
						format: "javascript",
						include_comments: true,
					},
					{
						location: "directory",
						format: "javascript",
						include_comments: false,
					},
					{ location: "root", format: "typescript", include_comments: true },
					{ location: "root", format: "typescript", include_comments: false },
					{ location: "root", format: "javascript", include_comments: true },
					{ location: "root", format: "javascript", include_comments: false },
				];

				for (const options of combinations) {
					vi.clearAllMocks();
					mockExistsSync.mockReturnValue(false);

					const result = handleInitConfig(options);
					expect(result.success).toBe(true);
					expect(mockWriteFileSync).toHaveBeenCalledTimes(1);

					const [path, content] = mockWriteFileSync.mock.calls[0]!;

					// Verify extension matches format
					if (options.format === "typescript") {
						expect(path).toContain(".ts");
					} else {
						expect(path).toContain(".js");
					}

					// Verify location
					if (options.location === "root") {
						expect(path).not.toContain(".code-council");
					} else {
						expect(path).toContain(".code-council");
					}

					// Verify comments
					if (options.include_comments) {
						expect(content).toContain("/**");
					}
				}
			});

			it("does not create directory for root location", () => {
				mockExistsSync.mockImplementation((p: string) => {
					// File doesn't exist, but parent directory does
					if (p.includes("code-council.config")) return false;
					return true;
				});

				handleInitConfig({ location: "root" });

				// mkdirSync should not be called for root location
				// since we're writing directly to cwd
				const mkdirCalls = mockMkdirSync.mock.calls.filter(
					(call) => !(call[0] as string).includes(".code-council"),
				);
				// No new directory creation for root (might create if dirname differs)
				expect(mkdirCalls.length).toBe(0);
			});
		});
	});
});
