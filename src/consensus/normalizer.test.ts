/**
 * Tests for the normalizer module.
 */

import { describe, expect, it } from "vitest";
import {
	getCanonicalLocation,
	locationsMatch,
	normalizeCategory,
	normalizeFilePath,
	normalizeFinding,
	normalizeLocation,
	normalizeSeverity,
} from "./normalizer";
import type { Finding } from "./types";
import { toFindingId } from "./types";

describe("normalizeSeverity", () => {
	it("normalizes standard severities", () => {
		expect(normalizeSeverity("critical")).toBe("critical");
		expect(normalizeSeverity("high")).toBe("high");
		expect(normalizeSeverity("medium")).toBe("medium");
		expect(normalizeSeverity("low")).toBe("low");
		expect(normalizeSeverity("info")).toBe("info");
	});

	it("handles case variations", () => {
		expect(normalizeSeverity("CRITICAL")).toBe("critical");
		expect(normalizeSeverity("High")).toBe("high");
		expect(normalizeSeverity("MEDIUM")).toBe("medium");
	});

	it("maps severity aliases", () => {
		expect(normalizeSeverity("severe")).toBe("critical");
		expect(normalizeSeverity("urgent")).toBe("critical");
		expect(normalizeSeverity("blocker")).toBe("critical");
		expect(normalizeSeverity("important")).toBe("high");
		expect(normalizeSeverity("major")).toBe("high");
		expect(normalizeSeverity("moderate")).toBe("medium");
		expect(normalizeSeverity("minor")).toBe("low");
		expect(normalizeSeverity("trivial")).toBe("low");
		expect(normalizeSeverity("nitpick")).toBe("low");
		expect(normalizeSeverity("suggestion")).toBe("info");
		expect(normalizeSeverity("note")).toBe("info");
	});

	it("maps priority labels", () => {
		expect(normalizeSeverity("p0")).toBe("critical");
		expect(normalizeSeverity("p1")).toBe("high");
		expect(normalizeSeverity("p2")).toBe("medium");
		expect(normalizeSeverity("p3")).toBe("low");
		expect(normalizeSeverity("p4")).toBe("info");
	});

	it("defaults unknown severities to medium", () => {
		expect(normalizeSeverity("unknown")).toBe("medium");
		expect(normalizeSeverity("random")).toBe("medium");
	});
});

describe("normalizeCategory", () => {
	it("normalizes standard categories", () => {
		expect(normalizeCategory("security")).toBe("security");
		expect(normalizeCategory("performance")).toBe("performance");
		expect(normalizeCategory("bug")).toBe("bug");
		expect(normalizeCategory("maintainability")).toBe("maintainability");
	});

	it("handles case variations", () => {
		expect(normalizeCategory("SECURITY")).toBe("security");
		expect(normalizeCategory("Performance")).toBe("performance");
	});

	it("maps category aliases", () => {
		expect(normalizeCategory("sec")).toBe("security");
		expect(normalizeCategory("vulnerability")).toBe("security");
		expect(normalizeCategory("auth")).toBe("security");
		expect(normalizeCategory("perf")).toBe("performance");
		expect(normalizeCategory("speed")).toBe("performance");
		expect(normalizeCategory("error")).toBe("bug");
		expect(normalizeCategory("defect")).toBe("bug");
		expect(normalizeCategory("readability")).toBe("maintainability");
		expect(normalizeCategory("complexity")).toBe("maintainability");
		expect(normalizeCategory("tech debt")).toBe("maintainability");
		expect(normalizeCategory("a11y")).toBe("accessibility");
		expect(normalizeCategory("arch")).toBe("architecture");
		expect(normalizeCategory("docs")).toBe("documentation");
		expect(normalizeCategory("test")).toBe("testing");
	});

	it("defaults unknown categories to other", () => {
		expect(normalizeCategory("unknown")).toBe("other");
		expect(normalizeCategory("random")).toBe("other");
	});
});

describe("normalizeFilePath", () => {
	it("handles backslashes", () => {
		expect(normalizeFilePath("src\\api\\users.ts")).toBe("src/api/users.ts");
	});

	it("removes leading ./", () => {
		expect(normalizeFilePath("./src/api/users.ts")).toBe("src/api/users.ts");
	});

	it("removes duplicate slashes", () => {
		expect(normalizeFilePath("src//api///users.ts")).toBe("src/api/users.ts");
	});

	it("removes trailing slash", () => {
		expect(normalizeFilePath("src/api/")).toBe("src/api");
	});

	it("trims whitespace", () => {
		expect(normalizeFilePath("  src/api/users.ts  ")).toBe("src/api/users.ts");
	});

	it("handles already normalized paths", () => {
		expect(normalizeFilePath("src/api/users.ts")).toBe("src/api/users.ts");
	});
});

describe("normalizeLocation", () => {
	it("returns undefined for undefined input", () => {
		expect(normalizeLocation(undefined)).toBeUndefined();
	});

	it("returns undefined for empty file", () => {
		expect(normalizeLocation({ file: "" })).toBeUndefined();
	});

	it("normalizes file path", () => {
		const result = normalizeLocation({ file: "./src\\api\\users.ts" });
		expect(result?.file).toBe("src/api/users.ts");
	});

	it("preserves valid line numbers", () => {
		const result = normalizeLocation({ file: "src/api/users.ts", line: 42 });
		expect(result?.line).toBe(42);
	});

	it("preserves line 0 (valid 0-indexed line)", () => {
		const result = normalizeLocation({ file: "src/api/users.ts", line: 0 });
		expect(result?.line).toBe(0);
	});

	it("removes negative line numbers", () => {
		const result = normalizeLocation({ file: "src/api/users.ts", line: -1 });
		expect(result?.line).toBeUndefined();
	});

	it("swaps line and endLine if reversed", () => {
		const result = normalizeLocation({
			file: "src/api/users.ts",
			line: 50,
			endLine: 40,
		});
		expect(result?.line).toBe(40);
		expect(result?.endLine).toBe(50);
	});

	it("preserves endLine 0 (valid 0-indexed line)", () => {
		const result = normalizeLocation({
			file: "src/api/users.ts",
			line: 0,
			endLine: 0,
		});
		expect(result?.line).toBe(0);
		expect(result?.endLine).toBe(0);
	});

	it("removes negative endLine", () => {
		const result = normalizeLocation({
			file: "src/api/users.ts",
			line: 40,
			endLine: -1,
		});
		expect(result?.line).toBe(40);
		expect(result?.endLine).toBeUndefined();
	});
});

describe("locationsMatch", () => {
	it("matches two undefined locations", () => {
		expect(locationsMatch(undefined, undefined)).toBe(true);
	});

	it("does not match undefined with defined", () => {
		expect(locationsMatch(undefined, { file: "src/test.ts" })).toBe(false);
		expect(locationsMatch({ file: "src/test.ts" }, undefined)).toBe(false);
	});

	it("matches same file without lines", () => {
		expect(
			locationsMatch({ file: "src/test.ts" }, { file: "src/test.ts" }),
		).toBe(true);
	});

	it("does not match different files", () => {
		expect(locationsMatch({ file: "src/a.ts" }, { file: "src/b.ts" })).toBe(
			false,
		);
	});

	it("matches same file with nearby lines", () => {
		expect(
			locationsMatch(
				{ file: "src/test.ts", line: 40 },
				{ file: "src/test.ts", line: 42 },
			),
		).toBe(true);
	});

	it("matches within tolerance", () => {
		expect(
			locationsMatch(
				{ file: "src/test.ts", line: 40 },
				{ file: "src/test.ts", line: 45 },
				5,
			),
		).toBe(true);
	});

	it("does not match outside tolerance", () => {
		expect(
			locationsMatch(
				{ file: "src/test.ts", line: 40 },
				{ file: "src/test.ts", line: 50 },
				5,
			),
		).toBe(false);
	});

	it("matches same file when one has line and one doesn't", () => {
		expect(
			locationsMatch(
				{ file: "src/test.ts", line: 40 },
				{ file: "src/test.ts" },
			),
		).toBe(true);
	});

	it("normalizes file paths for comparison", () => {
		expect(
			locationsMatch(
				{ file: "./src/test.ts", line: 40 },
				{ file: "src\\test.ts", line: 42 },
			),
		).toBe(true);
	});
});

describe("getCanonicalLocation", () => {
	it("returns undefined for empty array", () => {
		expect(getCanonicalLocation([])).toBeUndefined();
	});

	it("returns undefined for all undefined locations", () => {
		expect(getCanonicalLocation([undefined, undefined])).toBeUndefined();
	});

	it("returns the location with file", () => {
		const result = getCanonicalLocation([
			undefined,
			{ file: "src/test.ts" },
			undefined,
		]);
		expect(result?.file).toBe("src/test.ts");
	});

	it("prefers location with line number", () => {
		const result = getCanonicalLocation([
			{ file: "src/test.ts" },
			{ file: "src/test.ts", line: 42 },
		]);
		expect(result?.line).toBe(42);
	});

	it("prefers location with endLine", () => {
		const result = getCanonicalLocation([
			{ file: "src/test.ts", line: 40 },
			{ file: "src/test.ts", line: 40, endLine: 45 },
		]);
		expect(result?.endLine).toBe(45);
	});

	it("normalizes the returned location", () => {
		const result = getCanonicalLocation([{ file: "./src\\test.ts", line: 42 }]);
		expect(result?.file).toBe("src/test.ts");
	});
});

describe("normalizeFinding", () => {
	const baseFinding: Finding = {
		id: toFindingId("test-finding"),
		sourceModel: "test-model",
		category: "security",
		severity: "high",
		title: "  Test Title  ",
		description: "  Test Description  ",
		location: { file: "./src\\test.ts", line: 42 },
		suggestion: "  Fix it  ",
		rawExcerpt: "  raw excerpt  ",
		extractedAt: "2024-01-15T10:00:00Z",
		confidence: 0.85,
	};

	it("trims title and description", () => {
		const result = normalizeFinding(baseFinding);
		expect(result.title).toBe("Test Title");
		expect(result.description).toBe("Test Description");
	});

	it("trims suggestion", () => {
		const result = normalizeFinding(baseFinding);
		expect(result.suggestion).toBe("Fix it");
	});

	it("trims rawExcerpt", () => {
		const result = normalizeFinding(baseFinding);
		expect(result.rawExcerpt).toBe("raw excerpt");
	});

	it("normalizes location", () => {
		const result = normalizeFinding(baseFinding);
		expect(result.location?.file).toBe("src/test.ts");
	});

	it("clamps confidence to 0-1", () => {
		const tooHigh = normalizeFinding({ ...baseFinding, confidence: 1.5 });
		expect(tooHigh.confidence).toBe(1);

		const tooLow = normalizeFinding({ ...baseFinding, confidence: -0.5 });
		expect(tooLow.confidence).toBe(0);
	});

	it("preserves valid category and severity", () => {
		const result = normalizeFinding(baseFinding);
		expect(result.category).toBe("security");
		expect(result.severity).toBe("high");
	});
});
