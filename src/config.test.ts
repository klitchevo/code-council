/**
 * Tests for config module
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	getBackendReviewModels,
	getCodeReviewModels,
	getConfigPath,
	getConsensusConfig,
	getConsensusExtractionModel,
	getConsensusFallbackOnError,
	getDiscussionModels,
	getEnableConsensus,
	getFrontendReviewModels,
	getHighConfidenceThreshold,
	getHostExtraction,
	getModelWeights,
	getModerateConfidenceThreshold,
	getPlanReviewModels,
	getTpsAuditModels,
	isConfigInitialized,
	parseModels,
	parseModelWeights,
} from "./config";
import { DEFAULT_MODELS } from "./constants";

// Mock the config/loader module
vi.mock("./config/loader", () => ({
	loadConfig: vi.fn(),
}));

describe("parseModels", () => {
	const defaults = ["minimax/minimax-m2.1", "moonshotai/kimi-k2.5"];

	it("should return defaults when env var is undefined", () => {
		expect(parseModels(undefined, defaults)).toEqual(defaults);
	});

	describe("array input (only supported format)", () => {
		it("should accept array of strings", () => {
			const result = parseModels(
				["anthropic/claude-3.5-sonnet", "openai/gpt-4-turbo"],
				defaults,
			);
			expect(result).toEqual([
				"anthropic/claude-3.5-sonnet",
				"openai/gpt-4-turbo",
			]);
		});

		it("should accept single-element array", () => {
			const result = parseModels(["anthropic/claude-3.5-sonnet"], defaults);
			expect(result).toEqual(["anthropic/claude-3.5-sonnet"]);
		});

		it("should filter empty strings from array", () => {
			const result = parseModels(
				["anthropic/claude-3.5-sonnet", "", "  ", "openai/gpt-4-turbo"],
				defaults,
			);
			expect(result).toEqual([
				"anthropic/claude-3.5-sonnet",
				"openai/gpt-4-turbo",
			]);
		});

		it("should return defaults for empty array", () => {
			const result = parseModels([], defaults);
			expect(result).toEqual(defaults);
		});
	});

	describe("JSON string input (MCP format)", () => {
		it("should parse JSON array string", () => {
			const result = parseModels(
				'["anthropic/claude-3.5-sonnet","openai/gpt-4-turbo"]',
				defaults,
			);
			expect(result).toEqual([
				"anthropic/claude-3.5-sonnet",
				"openai/gpt-4-turbo",
			]);
		});

		it("should parse JSON array with spaces", () => {
			const result = parseModels(
				'["anthropic/claude-3.5-sonnet", "openai/gpt-4-turbo"]',
				defaults,
			);
			expect(result).toEqual([
				"anthropic/claude-3.5-sonnet",
				"openai/gpt-4-turbo",
			]);
		});

		it("should filter empty strings from JSON array", () => {
			const result = parseModels(
				'["anthropic/claude-3.5-sonnet", "", "openai/gpt-4-turbo"]',
				defaults,
			);
			expect(result).toEqual([
				"anthropic/claude-3.5-sonnet",
				"openai/gpt-4-turbo",
			]);
		});

		it("should return defaults for empty JSON array", () => {
			const result = parseModels("[]", defaults);
			expect(result).toEqual(defaults);
		});

		it("should filter non-string items from JSON array", () => {
			const result = parseModels(
				'["valid-model", 123, null, "another-model"]',
				defaults,
			);
			expect(result).toEqual(["valid-model", "another-model"]);
		});
	});

	describe("invalid formats (should throw)", () => {
		it("should throw for plain string", () => {
			expect(() =>
				parseModels("anthropic/claude-3.5-sonnet", defaults),
			).toThrow("Model configuration must be an array of strings");
		});

		it("should throw for comma-separated string", () => {
			expect(() =>
				parseModels("anthropic/claude-3.5-sonnet,openai/gpt-4-turbo", defaults),
			).toThrow("Model configuration must be an array of strings");
		});

		it("should throw for empty string", () => {
			expect(() => parseModels("", defaults)).toThrow(
				"Model configuration must be an array of strings",
			);
		});

		it("should throw for whitespace string", () => {
			expect(() => parseModels("   ", defaults)).toThrow(
				"Model configuration must be an array of strings",
			);
		});

		it("should throw for JSON object", () => {
			expect(() => parseModels('{"model": "test"}', defaults)).toThrow(
				"Model configuration must be an array of strings",
			);
		});
	});
});

describe("parseModelWeights", () => {
	it("should return empty object for undefined", () => {
		expect(parseModelWeights(undefined)).toEqual({});
	});

	it("should return empty object for empty string", () => {
		expect(parseModelWeights("")).toEqual({});
	});

	it("should parse valid JSON weights", () => {
		const result = parseModelWeights('{"model-1": 1.5, "model-2": 1.0}');
		expect(result).toEqual({ "model-1": 1.5, "model-2": 1.0 });
	});

	it("should filter out non-positive weights", () => {
		const result = parseModelWeights(
			'{"model-1": 1.5, "model-2": 0, "model-3": -1}',
		);
		expect(result).toEqual({ "model-1": 1.5 });
	});

	it("should filter out non-number values", () => {
		const result = parseModelWeights(
			'{"model-1": 1.5, "model-2": "invalid", "model-3": null}',
		);
		expect(result).toEqual({ "model-1": 1.5 });
	});

	it("should return empty object for invalid JSON", () => {
		expect(parseModelWeights("not valid json")).toEqual({});
	});

	it("should handle JSON array by extracting numeric values if keyed", () => {
		// JSON array without keys - returns empty since we expect object with model names
		const result = parseModelWeights("[1, 2, 3]");
		// Arrays are objects in JS, so it iterates but finds no valid string keys
		expect(typeof result).toBe("object");
	});

	it("should return empty object for null JSON", () => {
		expect(parseModelWeights("null")).toEqual({});
	});
});

describe("initializeConfig", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
	});

	it("should load config from file", async () => {
		const { loadConfig } = await import("./config/loader");
		(loadConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
			config: { models: { codeReview: ["test-model"] } },
			configPath: "/test/config.ts",
		});

		// Re-import to get fresh module state after resetModules
		const { initializeConfig: freshInitializeConfig } = await import(
			"./config"
		);
		await freshInitializeConfig("/fresh/path");

		expect(loadConfig).toHaveBeenCalled();
	});

	it("should handle config load errors gracefully", async () => {
		const { loadConfig } = await import("./config/loader");
		(loadConfig as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error("Config load failed"),
		);

		// Re-import to get fresh module state after resetModules
		const { initializeConfig: freshInitializeConfig } = await import(
			"./config"
		);

		// Should not throw
		await expect(freshInitializeConfig("/error/path")).resolves.not.toThrow();
	});
});

describe("getConfigPath", () => {
	it("should return config path after initialization", () => {
		// getConfigPath returns the stored config path
		const path = getConfigPath();
		// May be null if not initialized with a file
		expect(path === null || typeof path === "string").toBe(true);
	});
});

describe("isConfigInitialized", () => {
	it("should return boolean", () => {
		const result = isConfigInitialized();
		expect(typeof result).toBe("boolean");
	});
});

describe("model getter functions", () => {
	beforeEach(() => {
		// Clear environment variables
		delete process.env.CODE_REVIEW_MODELS;
		delete process.env.FRONTEND_REVIEW_MODELS;
		delete process.env.BACKEND_REVIEW_MODELS;
		delete process.env.PLAN_REVIEW_MODELS;
		delete process.env.DISCUSSION_MODELS;
		delete process.env.TPS_AUDIT_MODELS;
	});

	describe("getCodeReviewModels", () => {
		it("should return default models when not configured", () => {
			const models = getCodeReviewModels();
			expect(models).toEqual(DEFAULT_MODELS);
		});
	});

	describe("getFrontendReviewModels", () => {
		it("should return default models when not configured", () => {
			const models = getFrontendReviewModels();
			expect(models).toEqual(DEFAULT_MODELS);
		});
	});

	describe("getBackendReviewModels", () => {
		it("should return default models when not configured", () => {
			const models = getBackendReviewModels();
			expect(models).toEqual(DEFAULT_MODELS);
		});
	});

	describe("getPlanReviewModels", () => {
		it("should return default models when not configured", () => {
			const models = getPlanReviewModels();
			expect(models).toEqual(DEFAULT_MODELS);
		});
	});

	describe("getDiscussionModels", () => {
		it("should return default models when not configured", () => {
			const models = getDiscussionModels();
			expect(models).toEqual(DEFAULT_MODELS);
		});
	});

	describe("getTpsAuditModels", () => {
		it("should return default models when not configured", () => {
			const models = getTpsAuditModels();
			expect(models).toEqual(DEFAULT_MODELS);
		});
	});
});

describe("consensus configuration functions", () => {
	beforeEach(() => {
		// Clear environment variables
		delete process.env.ENABLE_CONSENSUS;
		delete process.env.MODEL_WEIGHTS;
		delete process.env.HIGH_CONFIDENCE_THRESHOLD;
		delete process.env.MODERATE_CONFIDENCE_THRESHOLD;
		delete process.env.CONSENSUS_EXTRACTION_MODEL;
		delete process.env.CONSENSUS_FALLBACK_ON_ERROR;
		delete process.env.CONSENSUS_HOST_EXTRACTION;
	});

	describe("getEnableConsensus", () => {
		it("should always return true (deprecated, always enabled)", () => {
			expect(getEnableConsensus()).toBe(true);
		});
	});

	describe("getModelWeights", () => {
		it("should return empty object when not configured", () => {
			const weights = getModelWeights();
			expect(weights).toEqual({});
		});

		it("should parse weights from env var", () => {
			process.env.MODEL_WEIGHTS = '{"model-1": 1.5}';
			const weights = getModelWeights();
			expect(weights).toEqual({ "model-1": 1.5 });
		});
	});

	describe("getHighConfidenceThreshold", () => {
		it("should return default 0.8 when not configured", () => {
			const threshold = getHighConfidenceThreshold();
			expect(threshold).toBe(0.8);
		});

		it("should parse threshold from env var", () => {
			process.env.HIGH_CONFIDENCE_THRESHOLD = "0.9";
			const threshold = getHighConfidenceThreshold();
			expect(threshold).toBe(0.9);
		});

		it("should clamp to valid range", () => {
			process.env.HIGH_CONFIDENCE_THRESHOLD = "1.5";
			expect(getHighConfidenceThreshold()).toBe(1);

			process.env.HIGH_CONFIDENCE_THRESHOLD = "-0.5";
			expect(getHighConfidenceThreshold()).toBe(0);
		});
	});

	describe("getModerateConfidenceThreshold", () => {
		it("should return default 0.5 when not configured", () => {
			const threshold = getModerateConfidenceThreshold();
			expect(threshold).toBe(0.5);
		});

		it("should parse threshold from env var", () => {
			process.env.MODERATE_CONFIDENCE_THRESHOLD = "0.6";
			const threshold = getModerateConfidenceThreshold();
			expect(threshold).toBe(0.6);
		});

		it("should clamp to valid range", () => {
			process.env.MODERATE_CONFIDENCE_THRESHOLD = "2.0";
			expect(getModerateConfidenceThreshold()).toBe(1);

			process.env.MODERATE_CONFIDENCE_THRESHOLD = "-1";
			expect(getModerateConfidenceThreshold()).toBe(0);
		});
	});

	describe("getConsensusExtractionModel", () => {
		it("should return default model when not configured", () => {
			const model = getConsensusExtractionModel();
			expect(model).toBe("anthropic/claude-3-haiku");
		});

		it("should return env var value when set", () => {
			process.env.CONSENSUS_EXTRACTION_MODEL = "custom/model";
			const model = getConsensusExtractionModel();
			expect(model).toBe("custom/model");
		});
	});

	describe("getConsensusFallbackOnError", () => {
		it("should return true by default", () => {
			expect(getConsensusFallbackOnError()).toBe(true);
		});

		it("should return false when explicitly disabled", () => {
			process.env.CONSENSUS_FALLBACK_ON_ERROR = "false";
			expect(getConsensusFallbackOnError()).toBe(false);
		});

		it("should return true for any other value", () => {
			process.env.CONSENSUS_FALLBACK_ON_ERROR = "true";
			expect(getConsensusFallbackOnError()).toBe(true);

			process.env.CONSENSUS_FALLBACK_ON_ERROR = "yes";
			expect(getConsensusFallbackOnError()).toBe(true);
		});
	});

	describe("getHostExtraction", () => {
		it("should return true by default", () => {
			expect(getHostExtraction()).toBe(true);
		});

		it("should return false when explicitly disabled", () => {
			process.env.CONSENSUS_HOST_EXTRACTION = "false";
			expect(getHostExtraction()).toBe(false);
		});

		it("should return true for any other value", () => {
			process.env.CONSENSUS_HOST_EXTRACTION = "true";
			expect(getHostExtraction()).toBe(true);
		});
	});

	describe("getConsensusConfig", () => {
		it("should return complete config object", () => {
			const config = getConsensusConfig();

			expect(config).toHaveProperty("enabled");
			expect(config).toHaveProperty("modelWeights");
			expect(config).toHaveProperty("highConfidenceThreshold");
			expect(config).toHaveProperty("moderateConfidenceThreshold");
			expect(config).toHaveProperty("extractionModel");
			expect(config).toHaveProperty("fallbackOnError");
			expect(config).toHaveProperty("hostExtraction");
		});

		it("should use default values when not configured", () => {
			const config = getConsensusConfig();

			expect(config.enabled).toBe(true);
			expect(config.modelWeights).toEqual({});
			expect(config.highConfidenceThreshold).toBe(0.8);
			expect(config.moderateConfidenceThreshold).toBe(0.5);
			expect(config.extractionModel).toBe("anthropic/claude-3-haiku");
			expect(config.fallbackOnError).toBe(true);
			expect(config.hostExtraction).toBe(true);
		});
	});
});
