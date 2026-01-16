import { describe, expect, it } from "vitest";
import {
	CodeCouncilConfigSchema,
	ConsensusConfigSchema,
	InputLimitsConfigSchema,
	LLMConfigSchema,
	ModelsConfigSchema,
	SessionConfigSchema,
} from "./schema";

describe("Config Schemas", () => {
	describe("ModelsConfigSchema", () => {
		it("accepts valid model arrays", () => {
			const result = ModelsConfigSchema.safeParse({
				codeReview: ["model1", "model2"],
				frontendReview: ["model3"],
			});
			expect(result.success).toBe(true);
		});

		it("accepts empty config", () => {
			const result = ModelsConfigSchema.safeParse({});
			expect(result.success).toBe(true);
		});

		it("accepts undefined", () => {
			const result = ModelsConfigSchema.safeParse(undefined);
			expect(result.success).toBe(true);
		});

		it("rejects empty strings in model arrays", () => {
			const result = ModelsConfigSchema.safeParse({
				codeReview: ["model1", ""],
			});
			expect(result.success).toBe(false);
		});
	});

	describe("ConsensusConfigSchema", () => {
		it("accepts valid consensus config", () => {
			const result = ConsensusConfigSchema.safeParse({
				enabled: true,
				modelWeights: { "model-1": 1.5 },
				highConfidenceThreshold: 0.8,
				moderateConfidenceThreshold: 0.5,
				extractionModel: "anthropic/claude-3-haiku",
				fallbackOnError: true,
			});
			expect(result.success).toBe(true);
		});

		it("accepts partial config", () => {
			const result = ConsensusConfigSchema.safeParse({
				enabled: true,
			});
			expect(result.success).toBe(true);
		});

		it("rejects invalid threshold (> 1)", () => {
			const result = ConsensusConfigSchema.safeParse({
				highConfidenceThreshold: 1.5,
			});
			expect(result.success).toBe(false);
		});

		it("rejects invalid threshold (< 0)", () => {
			const result = ConsensusConfigSchema.safeParse({
				moderateConfidenceThreshold: -0.1,
			});
			expect(result.success).toBe(false);
		});

		it("rejects negative model weights", () => {
			const result = ConsensusConfigSchema.safeParse({
				modelWeights: { model: -1 },
			});
			expect(result.success).toBe(false);
		});

		it("rejects zero model weights", () => {
			const result = ConsensusConfigSchema.safeParse({
				modelWeights: { model: 0 },
			});
			expect(result.success).toBe(false);
		});
	});

	describe("LLMConfigSchema", () => {
		it("accepts valid LLM config", () => {
			const result = LLMConfigSchema.safeParse({
				temperature: 0.7,
				maxTokens: 4096,
			});
			expect(result.success).toBe(true);
		});

		it("accepts partial config", () => {
			const result = LLMConfigSchema.safeParse({
				temperature: 0.3,
			});
			expect(result.success).toBe(true);
		});

		it("rejects temperature > 2", () => {
			const result = LLMConfigSchema.safeParse({
				temperature: 2.5,
			});
			expect(result.success).toBe(false);
		});

		it("rejects negative temperature", () => {
			const result = LLMConfigSchema.safeParse({
				temperature: -0.1,
			});
			expect(result.success).toBe(false);
		});

		it("rejects non-positive maxTokens", () => {
			const result = LLMConfigSchema.safeParse({
				maxTokens: 0,
			});
			expect(result.success).toBe(false);
		});

		it("rejects non-integer maxTokens", () => {
			const result = LLMConfigSchema.safeParse({
				maxTokens: 1024.5,
			});
			expect(result.success).toBe(false);
		});
	});

	describe("SessionConfigSchema", () => {
		it("accepts valid session config", () => {
			const result = SessionConfigSchema.safeParse({
				maxSessions: 50,
				maxMessagesPerModel: 25,
				ttlMs: 60000,
				rateLimitPerMinute: 5,
			});
			expect(result.success).toBe(true);
		});

		it("rejects non-positive values", () => {
			const result = SessionConfigSchema.safeParse({
				maxSessions: 0,
			});
			expect(result.success).toBe(false);
		});
	});

	describe("InputLimitsConfigSchema", () => {
		it("accepts valid input limits", () => {
			const result = InputLimitsConfigSchema.safeParse({
				maxCodeLength: 50000,
				maxContextLength: 2500,
				maxModels: 5,
			});
			expect(result.success).toBe(true);
		});

		it("rejects non-positive values", () => {
			const result = InputLimitsConfigSchema.safeParse({
				maxModels: -1,
			});
			expect(result.success).toBe(false);
		});
	});

	describe("CodeCouncilConfigSchema", () => {
		it("accepts complete valid config", () => {
			const result = CodeCouncilConfigSchema.safeParse({
				models: {
					codeReview: ["anthropic/claude-sonnet-4"],
					frontendReview: ["openai/gpt-4o"],
				},
				consensus: {
					enabled: true,
					highConfidenceThreshold: 0.8,
				},
				llm: {
					temperature: 0.3,
					maxTokens: 16384,
				},
				session: {
					maxSessions: 100,
				},
				inputLimits: {
					maxCodeLength: 100000,
				},
			});
			expect(result.success).toBe(true);
		});

		it("accepts empty config", () => {
			const result = CodeCouncilConfigSchema.safeParse({});
			expect(result.success).toBe(true);
		});

		it("rejects unknown top-level properties with strict mode off", () => {
			// Note: Zod by default strips unknown properties, not reject them
			const result = CodeCouncilConfigSchema.safeParse({
				unknownKey: "value",
			});
			expect(result.success).toBe(true);
			// The unknown key should be stripped
			expect(
				(result.data as { unknownKey?: string }).unknownKey,
			).toBeUndefined();
		});
	});
});
