/**
 * Tests for config loader functionality
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createJiti } from "jiti";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	findConfigFile,
	hasConfigFile,
	loadConfig,
	loadConfigFile,
} from "./loader";
import { CodeCouncilConfigSchema } from "./schema";

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
const mockCreateJiti = createJiti as ReturnType<typeof vi.fn>;
const mockSafeParse = CodeCouncilConfigSchema.safeParse as ReturnType<
	typeof vi.fn
>;

describe("Config Loader", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("findConfigFile", () => {
		it("returns null when no config file exists", () => {
			mockExistsSync.mockReturnValue(false);

			const result = findConfigFile("/test/project");

			expect(result).toBeNull();
			expect(mockExistsSync).toHaveBeenCalledTimes(4);
		});

		it("returns first matching config file (.code-council/config.ts)", () => {
			mockExistsSync.mockImplementation((path: string) =>
				path.endsWith(".code-council/config.ts"),
			);

			const result = findConfigFile("/test/project");

			expect(result).toBe("/test/project/.code-council/config.ts");
		});

		it("returns .code-council/config.js when .ts not found", () => {
			mockExistsSync.mockImplementation(
				(path: string) =>
					!path.endsWith(".code-council/config.ts") &&
					path.endsWith(".code-council/config.js"),
			);

			const result = findConfigFile("/test/project");

			expect(result).toBe("/test/project/.code-council/config.js");
		});

		it("returns root config.ts when directory config not found", () => {
			mockExistsSync.mockImplementation((path: string) =>
				path.endsWith("code-council.config.ts"),
			);

			const result = findConfigFile("/test/project");

			expect(result).toBe("/test/project/code-council.config.ts");
		});

		it("returns root config.js as last priority", () => {
			mockExistsSync.mockImplementation((path: string) =>
				path.endsWith("code-council.config.js"),
			);

			const result = findConfigFile("/test/project");

			expect(result).toBe("/test/project/code-council.config.js");
		});

		it("uses process.cwd() when no cwd provided", () => {
			mockExistsSync.mockReturnValue(false);

			findConfigFile();

			expect(mockExistsSync).toHaveBeenCalledWith(
				join(process.cwd(), ".code-council/config.ts"),
			);
		});
	});

	describe("loadConfigFile", () => {
		it("loads and validates config from a file", async () => {
			const mockConfig = {
				models: { defaultModels: ["model-1"] },
			};

			mockCreateJiti.mockReturnValue({
				import: vi.fn().mockResolvedValue({ default: mockConfig }),
			});

			mockSafeParse.mockReturnValue({
				success: true,
				data: mockConfig,
			});

			const result = await loadConfigFile("/test/config.ts");

			expect(result).toEqual(mockConfig);
		});

		it("handles config without default export", async () => {
			const mockConfig = {
				models: { codeReview: ["model-2"] },
			};

			mockCreateJiti.mockReturnValue({
				import: vi.fn().mockResolvedValue(mockConfig),
			});

			mockSafeParse.mockReturnValue({
				success: true,
				data: mockConfig,
			});

			const result = await loadConfigFile("/test/config.ts");

			expect(result).toEqual(mockConfig);
		});

		it("throws on invalid config with formatted errors", async () => {
			mockCreateJiti.mockReturnValue({
				import: vi.fn().mockResolvedValue({ default: { invalid: true } }),
			});

			mockSafeParse.mockReturnValue({
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

			await expect(loadConfigFile("/test/config.ts")).rejects.toThrow(
				"Invalid configuration in /test/config.ts",
			);
		});
	});

	describe("loadConfig", () => {
		it("returns empty config when no config file found", async () => {
			mockExistsSync.mockReturnValue(false);

			const result = await loadConfig("/test/project");

			expect(result).toEqual({
				config: {},
				configPath: null,
			});
		});

		it("loads config when file exists", async () => {
			mockExistsSync.mockImplementation((path: string) =>
				path.endsWith(".code-council/config.ts"),
			);

			const mockConfig = { llm: { temperature: 0.5 } };

			mockCreateJiti.mockReturnValue({
				import: vi.fn().mockResolvedValue({ default: mockConfig }),
			});

			mockSafeParse.mockReturnValue({
				success: true,
				data: mockConfig,
			});

			const result = await loadConfig("/test/project");

			expect(result.config).toEqual(mockConfig);
			expect(result.configPath).toBe("/test/project/.code-council/config.ts");
		});
	});

	describe("hasConfigFile", () => {
		it("returns true when config file exists", () => {
			mockExistsSync.mockImplementation((path: string) =>
				path.endsWith("code-council.config.ts"),
			);

			expect(hasConfigFile("/test/project")).toBe(true);
		});

		it("returns false when no config file exists", () => {
			mockExistsSync.mockReturnValue(false);

			expect(hasConfigFile("/test/project")).toBe(false);
		});
	});
});
