import { describe, expect, it } from "vitest";
import {
	BATCH_SYSTEM_PROMPT,
	buildBatchUserMessage,
	buildSynthesisUserMessage,
	buildUserMessage,
	parseTpsAnalysis,
	SYNTHESIS_SYSTEM_PROMPT,
	SYSTEM_PROMPT,
	type TpsAnalysis,
} from "./tps-audit";

describe("tps-audit prompts", () => {
	describe("SYSTEM_PROMPT", () => {
		it("should contain TPS principles", () => {
			expect(SYSTEM_PROMPT).toContain("Toyota Production System");
			expect(SYSTEM_PROMPT).toContain("Flow");
			expect(SYSTEM_PROMPT).toContain("Muda");
			expect(SYSTEM_PROMPT.toLowerCase()).toContain("bottleneck");
			expect(SYSTEM_PROMPT.toLowerCase()).toContain("jidoka");
		});

		it("should explain the 7 wastes", () => {
			expect(SYSTEM_PROMPT).toContain("Defects");
			expect(SYSTEM_PROMPT).toContain("Overproduction");
			expect(SYSTEM_PROMPT).toContain("Waiting");
			expect(SYSTEM_PROMPT).toContain("Transportation");
			expect(SYSTEM_PROMPT).toContain("Inventory");
			expect(SYSTEM_PROMPT).toContain("Motion");
			expect(SYSTEM_PROMPT).toContain("Extra-processing");
		});

		it("should mention scoring guidelines", () => {
			expect(SYSTEM_PROMPT).toContain("Scoring Guidelines");
			expect(SYSTEM_PROMPT).toContain("0-100");
		});

		it("should require JSON output", () => {
			expect(SYSTEM_PROMPT).toContain("JSON");
			expect(SYSTEM_PROMPT).toContain("TpsAnalysis");
		});
	});

	describe("buildUserMessage", () => {
		it("should include aggregated content", () => {
			const content =
				"=== FILE: index.ts ===\nconsole.log('test');\n=== END FILE ===";
			const message = buildUserMessage(content);

			expect(message).toContain(content);
		});

		it("should include repo name when provided", () => {
			const message = buildUserMessage("content", { repoName: "my-project" });

			expect(message).toContain("## Repository: my-project");
		});

		it("should include focus areas when provided", () => {
			const message = buildUserMessage("content", {
				focusAreas: ["performance", "security"],
			});

			expect(message).toContain("## Focus Areas");
			expect(message).toContain("performance");
			expect(message).toContain("security");
		});

		it("should include additional context when provided", () => {
			const message = buildUserMessage("content", {
				additionalContext: "This is a Node.js microservice",
			});

			expect(message).toContain("## Additional Context");
			expect(message).toContain("Node.js microservice");
		});

		it("should request JSON response", () => {
			const message = buildUserMessage("content");

			expect(message).toContain("JSON");
			expect(message).toContain("TpsAnalysis");
		});
	});

	describe("parseTpsAnalysis", () => {
		const validAnalysis: TpsAnalysis = {
			scores: { overall: 75, flow: 80, waste: 70, quality: 78 },
			flowAnalysis: {
				entryPoints: ["src/index.ts"],
				diagram: "index -> router -> handlers",
				pathways: ["Request flow", "Data flow"],
				observations: ["Clean separation"],
			},
			bottlenecks: [
				{
					id: "B1",
					severity: "high",
					location: "src/api.ts:45",
					title: "Sequential API calls",
					description: "Multiple sequential API calls",
					impact: "Increased latency",
					suggestion: "Use Promise.all",
				},
			],
			waste: {
				inventory: [
					{
						location: "src/utils.ts",
						description: "Unused helper functions",
						suggestion: "Remove dead code",
						effort: "trivial",
					},
				],
			},
			jidoka: {
				score: 80,
				strengths: ["Good error handling"],
				weaknesses: ["Missing input validation"],
			},
			recommendations: [
				{
					priority: 1,
					title: "Parallelize API calls",
					description: "Use Promise.all for concurrent requests",
					effort: "small",
					impact: "high",
					category: "flow",
				},
			],
			summary: {
				strengths: ["Clean architecture"],
				concerns: ["Performance bottlenecks"],
				quickWins: ["Remove dead code"],
			},
		};

		it("should parse valid JSON", () => {
			const json = JSON.stringify(validAnalysis);
			const result = parseTpsAnalysis(json);

			expect(result).not.toBeNull();
			expect(result?.scores.overall).toBe(75);
			expect(result?.bottlenecks).toHaveLength(1);
		});

		it("should handle JSON in markdown code blocks", () => {
			const wrapped = "```json\n" + JSON.stringify(validAnalysis) + "\n```";
			const result = parseTpsAnalysis(wrapped);

			expect(result).not.toBeNull();
			expect(result?.scores.overall).toBe(75);
		});

		it("should handle JSON in plain code blocks", () => {
			const wrapped = "```\n" + JSON.stringify(validAnalysis) + "\n```";
			const result = parseTpsAnalysis(wrapped);

			expect(result).not.toBeNull();
		});

		it("should return null for invalid JSON", () => {
			expect(parseTpsAnalysis("not valid json")).toBeNull();
			expect(parseTpsAnalysis("{invalid}")).toBeNull();
		});

		it("should return null when no scores can be extracted", () => {
			// No scores object and no flat score fields
			expect(parseTpsAnalysis("{}")).toBeNull();
			expect(parseTpsAnalysis('{"foo": "bar"}')).toBeNull();
		});

		it("should fill defaults for partial scores", () => {
			// Parser now fills in defaults for flexible model responses
			const result1 = parseTpsAnalysis('{"scores": {}}');
			expect(result1).not.toBeNull();
			expect(result1?.scores.overall).toBe(0);

			const result2 = parseTpsAnalysis('{"scores": {"overall": 50}}');
			expect(result2).not.toBeNull();
			expect(result2?.scores.overall).toBe(50);
			expect(result2?.scores.flow).toBe(0);
		});

		it("should handle whitespace around JSON", () => {
			const json = "  \n" + JSON.stringify(validAnalysis) + "\n  ";
			const result = parseTpsAnalysis(json);

			expect(result).not.toBeNull();
		});

		it("should handle flat score fields (overallScore, flowScore, etc.)", () => {
			const flatScores = {
				overallScore: 65,
				flowScore: 70,
				wasteScore: 60,
				qualityScore: 68,
			};
			const result = parseTpsAnalysis(JSON.stringify(flatScores));

			expect(result).not.toBeNull();
			expect(result?.scores.overall).toBe(65);
			expect(result?.scores.flow).toBe(70);
			expect(result?.scores.waste).toBe(60);
			expect(result?.scores.quality).toBe(68);
		});

		it("should handle string number scores", () => {
			const stringScores = {
				scores: {
					overall: "75",
					flow: "80",
					waste: "70",
					quality: "78",
				},
			};
			const result = parseTpsAnalysis(JSON.stringify(stringScores));

			expect(result).not.toBeNull();
			expect(result?.scores.overall).toBe(75);
		});

		it("should preserve object entries in arrays", () => {
			const withObjects = {
				scores: { overall: 50, flow: 50, waste: 50, quality: 50 },
				flowAnalysis: {
					entryPoints: [
						{ path: "src/index.ts", description: "Main entry" },
						"simple string entry",
					],
					pathways: [{ name: "Auth flow", from: "login", to: "dashboard" }],
					diagram: "",
					observations: [],
				},
				summary: {
					quickWins: [{ action: "Fix bug", effort: "low", impact: "high" }],
					strengths: [],
					concerns: [],
				},
			};
			const result = parseTpsAnalysis(JSON.stringify(withObjects));

			expect(result).not.toBeNull();
			expect(result?.flowAnalysis.entryPoints[0]).toEqual({
				path: "src/index.ts",
				description: "Main entry",
			});
			expect(result?.flowAnalysis.entryPoints[1]).toBe("simple string entry");
		});

		it("should handle missing optional fields gracefully", () => {
			const minimal = {
				scores: { overall: 50, flow: 50, waste: 50, quality: 50 },
			};
			const result = parseTpsAnalysis(JSON.stringify(minimal));

			expect(result).not.toBeNull();
			expect(result?.flowAnalysis.entryPoints).toEqual([]);
			expect(result?.bottlenecks).toEqual([]);
			expect(result?.waste).toEqual({});
			expect(result?.jidoka.score).toBe(0);
			expect(result?.recommendations).toEqual([]);
			expect(result?.summary.strengths).toEqual([]);
		});

		it("should handle non-array values for array fields", () => {
			const withNonArrays = {
				scores: { overall: 50, flow: 50, waste: 50, quality: 50 },
				flowAnalysis: {
					entryPoints: "not an array",
					pathways: 123,
					observations: null,
					diagram: "",
				},
				jidoka: {
					score: 80,
					strengths: "single string",
					weaknesses: { not: "an array" },
				},
				summary: {
					strengths: undefined,
					concerns: false,
					quickWins: 0,
				},
			};
			const result = parseTpsAnalysis(JSON.stringify(withNonArrays));

			expect(result).not.toBeNull();
			expect(result?.flowAnalysis.entryPoints).toEqual([]);
			expect(result?.flowAnalysis.pathways).toEqual([]);
			expect(result?.jidoka.strengths).toEqual([]);
			expect(result?.summary.concerns).toEqual([]);
		});
	});

	describe("BATCH_SYSTEM_PROMPT", () => {
		it("should contain base TPS principles", () => {
			expect(BATCH_SYSTEM_PROMPT).toContain("Toyota Production System");
			expect(BATCH_SYSTEM_PROMPT).toContain("Flow");
		});

		it("should mention batch context", () => {
			expect(BATCH_SYSTEM_PROMPT).toContain("BATCH");
			expect(BATCH_SYSTEM_PROMPT).toContain("{{BATCH_INDEX}}");
			expect(BATCH_SYSTEM_PROMPT).toContain("{{TOTAL_BATCHES}}");
		});
	});

	describe("SYNTHESIS_SYSTEM_PROMPT", () => {
		it("should describe synthesis task", () => {
			expect(SYNTHESIS_SYSTEM_PROMPT).toContain("synthesizing");
			expect(SYNTHESIS_SYSTEM_PROMPT).toContain("batch analyses");
		});

		it("should mention aggregation steps", () => {
			expect(SYNTHESIS_SYSTEM_PROMPT).toContain("Aggregate Scores");
			expect(SYNTHESIS_SYSTEM_PROMPT).toContain("Merge Findings");
			expect(SYNTHESIS_SYSTEM_PROMPT).toContain("Identify Patterns");
		});
	});

	describe("buildBatchUserMessage", () => {
		it("should include batch index and total", () => {
			const message = buildBatchUserMessage("content", 0, 3);

			expect(message).toContain("[BATCH 1 of 3]");
		});

		it("should include base user message content", () => {
			const message = buildBatchUserMessage("test content", 1, 5, {
				repoName: "my-repo",
			});

			expect(message).toContain("test content");
			expect(message).toContain("## Repository: my-repo");
			expect(message).toContain("[BATCH 2 of 5]");
		});

		it("should include focus areas when provided", () => {
			const message = buildBatchUserMessage("content", 0, 2, {
				focusAreas: ["security"],
			});

			expect(message).toContain("## Focus Areas");
			expect(message).toContain("security");
		});
	});

	describe("buildSynthesisUserMessage", () => {
		const sampleAnalysis: TpsAnalysis = {
			scores: { overall: 75, flow: 80, waste: 70, quality: 78 },
			flowAnalysis: {
				entryPoints: ["src/index.ts"],
				diagram: "",
				pathways: [],
				observations: [],
			},
			bottlenecks: [],
			waste: {},
			jidoka: { score: 80, strengths: [], weaknesses: [] },
			recommendations: [],
			summary: { strengths: [], concerns: [], quickWins: [] },
		};

		it("should include repo name when provided", () => {
			const message = buildSynthesisUserMessage([], "test-repo");

			expect(message).toContain("## Repository: test-repo");
		});

		it("should include batch count", () => {
			const batches = [
				{
					batchIndex: 0,
					tokenCount: 1000,
					analysis: sampleAnalysis,
					rawResponse: "",
				},
				{
					batchIndex: 1,
					tokenCount: 2000,
					analysis: sampleAnalysis,
					rawResponse: "",
				},
			];
			const message = buildSynthesisUserMessage(batches);

			expect(message).toContain("2 batch analyses");
			expect(message).toContain("### Batch 1 (~1000 tokens)");
			expect(message).toContain("### Batch 2 (~2000 tokens)");
		});

		it("should include analysis JSON when available", () => {
			const batches = [
				{
					batchIndex: 0,
					tokenCount: 1000,
					analysis: sampleAnalysis,
					rawResponse: "",
				},
			];
			const message = buildSynthesisUserMessage(batches);

			expect(message).toContain("```json");
			expect(message).toContain('"overall": 75');
		});

		it("should include raw response when analysis failed", () => {
			const batches = [
				{
					batchIndex: 0,
					tokenCount: 1000,
					analysis: null,
					rawResponse: "Some error occurred during analysis",
				},
			];
			const message = buildSynthesisUserMessage(batches);

			expect(message).toContain("*Analysis failed to parse. Raw response:*");
			expect(message).toContain("Some error occurred");
		});

		it("should truncate long raw responses", () => {
			const longResponse = "x".repeat(1500);
			const batches = [
				{
					batchIndex: 0,
					tokenCount: 1000,
					analysis: null,
					rawResponse: longResponse,
				},
			];
			const message = buildSynthesisUserMessage(batches);

			expect(message).toContain("...");
			expect(message.length).toBeLessThan(longResponse.length + 500);
		});

		it("should include synthesis instructions", () => {
			const message = buildSynthesisUserMessage([]);

			expect(message).toContain("Synthesize all batches");
			expect(message).toContain("Combine and deduplicate");
			expect(message).toContain("Your unified JSON response:");
		});
	});
});
