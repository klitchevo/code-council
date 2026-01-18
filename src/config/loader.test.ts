/**
 * Tests for config loader functionality
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock node:fs
vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
}));

// Mock jiti
vi.mock("jiti", () => ({
	createJiti: vi.fn(() => ({
		import: vi.fn(),
	})),
}));

// Mock the schema
vi.mock("./schema", () => ({
	CodeCouncilConfigSchema: {
		safeParse: vi.fn(),
	},
}));

const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;

describe("Config Loader", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetModules();
	});

	describe("findConfigFile", () => {
		it("returns null when no config file exists", async () => {
			mockExistsSync.mockReturnValue(false);

			const { findConfigFile } = await import("./loader");
			const result = findConfigFile("/test/project");

			expect(result).toBeNull();
			expect(mockExistsSync).toHaveBeenCalledTimes(4);
		});

		it("returns first matching config file (.code-council/config.ts)", async () => {
			mockExistsSync.mockImplementation((path: string) =>
				path.endsWith(".code-council/config.ts"),
			);

			const { findConfigFile } = await import("./loader");
			const result = findConfigFile("/test/project");

			expect(result).toBe("/test/project/.code-council/config.ts");
		});

		it("returns .code-council/config.js when .ts not found", async () => {
			mockExistsSync.mockImplementation(
				(path: string) =>
					!path.endsWith(".code-council/config.ts") &&
					path.endsWith(".code-council/config.js"),
			);

			const { findConfigFile } = await import("./loader");
			const result = findConfigFile("/test/project");

			expect(result).toBe("/test/project/.code-council/config.js");
		});

		it("returns root config.ts when directory config not found", async () => {
			mockExistsSync.mockImplementation((path: string) =>
				path.endsWith("code-council.config.ts"),
			);

			const { findConfigFile } = await import("./loader");
			const result = findConfigFile("/test/project");

			expect(result).toBe("/test/project/code-council.config.ts");
		});

		it("returns root config.js as last priority", async () => {
			mockExistsSync.mockImplementation((path: string) =>
				path.endsWith("code-council.config.js"),
			);

			const { findConfigFile } = await import("./loader");
			const result = findConfigFile("/test/project");

			expect(result).toBe("/test/project/code-council.config.js");
		});

		it("uses process.cwd() when no cwd provided", async () => {
			mockExistsSync.mockReturnValue(false);

			const { findConfigFile } = await import("./loader");
			findConfigFile();

			expect(mockExistsSync).toHaveBeenCalledWith(
				join(process.cwd(), ".code-council/config.ts"),
			);
		});
	});

	describe("loadConfigFile", () => {
		it("loads and validates config from a file", async () => {
			const { createJiti } = await import("jiti");
			const { CodeCouncilConfigSchema } = await import("./schema");

			const mockConfig = {
				models: { defaultModels: ["model-1"] },
			};

			(createJiti as ReturnType<typeof vi.fn>).mockReturnValue({
				import: vi.fn().mockResolvedValue({ default: mockConfig }),
			});

			(
				CodeCouncilConfigSchema.safeParse as ReturnType<typeof vi.fn>
			).mockReturnValue({
				success: true,
				data: mockConfig,
			});

			const { loadConfigFile } = await import("./loader");
			const result = await loadConfigFile("/test/config.ts");

			expect(result).toEqual(mockConfig);
		});

		it("handles config without default export", async () => {
			const { createJiti } = await import("jiti");
			const { CodeCouncilConfigSchema } = await import("./schema");

			const mockConfig = {
				models: { codeReview: ["model-2"] },
			};

			(createJiti as ReturnType<typeof vi.fn>).mockReturnValue({
				import: vi.fn().mockResolvedValue(mockConfig),
			});

			(
				CodeCouncilConfigSchema.safeParse as ReturnType<typeof vi.fn>
			).mockReturnValue({
				success: true,
				data: mockConfig,
			});

			const { loadConfigFile } = await import("./loader");
			const result = await loadConfigFile("/test/config.ts");

			expect(result).toEqual(mockConfig);
		});

		it("throws on invalid config with formatted errors", async () => {
			const { createJiti } = await import("jiti");
			const { CodeCouncilConfigSchema } = await import("./schema");

			(createJiti as ReturnType<typeof vi.fn>).mockReturnValue({
				import: vi.fn().mockResolvedValue({ default: { invalid: true } }),
			});

			(
				CodeCouncilConfigSchema.safeParse as ReturnType<typeof vi.fn>
			).mockReturnValue({
				success: false,
				error: {
					issues: [
						{
							path: ["consensus", "highConfidenceThreshold"],
							message: "Number must be at most 1",
						},
						{
							path: ["models", "defaultModels"],
							message: "Required",
						},
					],
				},
			});

			const { loadConfigFile } = await import("./loader");

			await expect(loadConfigFile("/test/config.ts")).rejects.toThrow(
				"Invalid configuration in /test/config.ts",
			);
		});
	});

	describe("loadConfig", () => {
		it("returns empty config when no config file found", async () => {
			mockExistsSync.mockReturnValue(false);

			const { loadConfig } = await import("./loader");
			const result = await loadConfig("/test/project");

			expect(result).toEqual({
				config: {},
				configPath: null,
			});
		});

		it("loads config when file exists", async () => {
			const { createJiti } = await import("jiti");
			const { CodeCouncilConfigSchema } = await import("./schema");

			mockExistsSync.mockImplementation((path: string) =>
				path.endsWith(".code-council/config.ts"),
			);

			const mockConfig = { llm: { temperature: 0.5 } };

			(createJiti as ReturnType<typeof vi.fn>).mockReturnValue({
				import: vi.fn().mockResolvedValue({ default: mockConfig }),
			});

			(
				CodeCouncilConfigSchema.safeParse as ReturnType<typeof vi.fn>
			).mockReturnValue({
				success: true,
				data: mockConfig,
			});

			const { loadConfig } = await import("./loader");
			const result = await loadConfig("/test/project");

			expect(result.config).toEqual(mockConfig);
			expect(result.configPath).toBe("/test/project/.code-council/config.ts");
		});
	});

	describe("hasConfigFile", () => {
		it("returns true when config file exists", async () => {
			mockExistsSync.mockImplementation((path: string) =>
				path.endsWith("code-council.config.ts"),
			);

			const { hasConfigFile } = await import("./loader");
			expect(hasConfigFile("/test/project")).toBe(true);
		});

		it("returns false when no config file exists", async () => {
			mockExistsSync.mockReturnValue(false);

			const { hasConfigFile } = await import("./loader");
			expect(hasConfigFile("/test/project")).toBe(false);
		});
	});
});
