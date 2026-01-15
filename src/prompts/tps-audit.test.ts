import { describe, expect, it } from "vitest";
import {
	buildUserMessage,
	parseTpsAnalysis,
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
	});
});
