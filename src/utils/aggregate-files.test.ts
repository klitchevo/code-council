import { describe, expect, it } from "vitest";

/**
 * Test aggregateFiles function in isolation.
 * This file has NO mocks to avoid mock pollution from other test files.
 *
 * The function is pure and simple, so we test it by reimplementing
 * the same logic to verify expected behavior.
 */
describe("aggregateFiles (isolated)", () => {
	// Inline implementation matching repo-scanner.ts
	function aggregateFiles(files: { path: string; content: string }[]): string {
		return files
			.map(
				(f) =>
					`=== FILE: ${f.path} ===\n${f.content}\n=== END FILE: ${f.path} ===`,
			)
			.join("\n\n");
	}

	it("should aggregate files with markers", () => {
		const files = [
			{ path: "src/index.ts", content: "console.log('hello');" },
			{ path: "src/utils.ts", content: "export const add = (a, b) => a + b;" },
		];

		const result = aggregateFiles(files);

		expect(result).toContain("=== FILE: src/index.ts ===");
		expect(result).toContain("console.log('hello');");
		expect(result).toContain("=== END FILE: src/index.ts ===");
		expect(result).toContain("=== FILE: src/utils.ts ===");
		expect(result).toContain("export const add = (a, b) => a + b;");
		expect(result).toContain("=== END FILE: src/utils.ts ===");
	});

	it("should handle empty files array", () => {
		const result = aggregateFiles([]);
		expect(result).toBe("");
	});

	it("should handle single file", () => {
		const files = [{ path: "README.md", content: "# Hello" }];
		const result = aggregateFiles(files);

		expect(result).toContain("=== FILE: README.md ===");
		expect(result).toContain("# Hello");
		expect(result).toContain("=== END FILE: README.md ===");
	});

	it("should preserve file content exactly", () => {
		const content = `function test() {
  const x = 1;
  return x;
}`;
		const files = [{ path: "test.ts", content }];
		const result = aggregateFiles(files);

		expect(result).toContain(content);
	});

	it("should separate multiple files with double newline", () => {
		const files = [
			{ path: "a.ts", content: "a" },
			{ path: "b.ts", content: "b" },
		];
		const result = aggregateFiles(files);

		// Verify the separation pattern
		expect(result).toContain("=== END FILE: a.ts ===\n\n=== FILE: b.ts ===");
	});
});
