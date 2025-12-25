import { describe, expect, it } from "vitest";
import { buildUserMessage } from "./code-review";

describe("code-review prompts", () => {
	it("should build message with code only", () => {
		const message = buildUserMessage("const x = 1;");
		expect(message).toBe("Code to review:\n```\nconst x = 1;\n```");
	});

	it("should build message with code and context", () => {
		const message = buildUserMessage(
			"const x = 1;",
			"JavaScript variable declaration",
		);
		expect(message).toBe(
			"JavaScript variable declaration\n\nCode to review:\n```\nconst x = 1;\n```",
		);
	});
});
