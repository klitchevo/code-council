import { describe, expect, it } from "vitest";
import { defineConfig } from "./define-config";
import type { CodeCouncilConfig } from "./types";

describe("defineConfig", () => {
	it("returns the same config object", () => {
		const config: CodeCouncilConfig = {
			models: {
				codeReview: ["model1", "model2"],
			},
			consensus: {
				enabled: true,
			},
		};

		const result = defineConfig(config);
		expect(result).toBe(config);
	});

	it("preserves all properties", () => {
		const config: CodeCouncilConfig = {
			models: {
				codeReview: ["anthropic/claude-sonnet-4"],
				frontendReview: ["openai/gpt-4o"],
				backendReview: ["google/gemini-pro"],
				planReview: ["model-1"],
				discussion: ["model-2"],
				tpsAudit: ["model-3"],
			},
			consensus: {
				enabled: true,
				modelWeights: { "anthropic/claude-sonnet-4": 1.2 },
				highConfidenceThreshold: 0.85,
				moderateConfidenceThreshold: 0.55,
				extractionModel: "anthropic/claude-3-haiku",
				fallbackOnError: false,
			},
			llm: {
				temperature: 0.5,
				maxTokens: 8192,
			},
			session: {
				maxSessions: 50,
				maxMessagesPerModel: 25,
				ttlMs: 900000,
				rateLimitPerMinute: 5,
			},
			inputLimits: {
				maxCodeLength: 50000,
				maxContextLength: 2500,
				maxModels: 5,
			},
		};

		const result = defineConfig(config);

		// Check all properties are preserved
		expect(result.models?.codeReview).toEqual(["anthropic/claude-sonnet-4"]);
		expect(result.consensus?.enabled).toBe(true);
		expect(result.consensus?.modelWeights).toEqual({
			"anthropic/claude-sonnet-4": 1.2,
		});
		expect(result.llm?.temperature).toBe(0.5);
		expect(result.session?.maxSessions).toBe(50);
		expect(result.inputLimits?.maxCodeLength).toBe(50000);
	});

	it("works with empty config", () => {
		const result = defineConfig({});
		expect(result).toEqual({});
	});

	it("works with partial config", () => {
		const config: CodeCouncilConfig = {
			consensus: {
				enabled: true,
			},
		};

		const result = defineConfig(config);
		expect(result.consensus?.enabled).toBe(true);
		expect(result.models).toBeUndefined();
	});
});
