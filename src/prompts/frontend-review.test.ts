import { describe, expect, it } from "vitest";
import { buildUserMessage } from "./frontend-review";

describe("frontend-review prompts", () => {
	it("should build full review message", () => {
		const message = buildUserMessage("<div>Hello</div>", "full");
		expect(message).toContain(
			"Provide a comprehensive frontend review covering accessibility, performance, and user experience",
		);
		expect(message).toContain("Code to review:");
		expect(message).toContain("<div>Hello</div>");
	});

	it("should build accessibility-focused message", () => {
		const message = buildUserMessage("<div>Hello</div>", "accessibility");
		expect(message).toContain(
			"Focus specifically on accessibility (WCAG compliance, ARIA labels",
		);
	});

	it("should build performance-focused message", () => {
		const message = buildUserMessage("<div>Hello</div>", "performance");
		expect(message).toContain(
			"Focus specifically on frontend performance (bundle size, render optimization",
		);
	});

	it("should build UX-focused message", () => {
		const message = buildUserMessage("<div>Hello</div>", "ux");
		expect(message).toContain(
			"Focus specifically on user experience (intuitive design, error handling",
		);
	});

	it("should include framework context", () => {
		const message = buildUserMessage("<div>Hello</div>", "full", "react");
		expect(message).toContain("Framework: react");
	});

	it("should include additional context", () => {
		const message = buildUserMessage(
			"<div>Hello</div>",
			"full",
			undefined,
			"This is a landing page",
		);
		expect(message).toContain("This is a landing page");
	});

	it("should include both framework and context", () => {
		const message = buildUserMessage(
			"<div>Hello</div>",
			"accessibility",
			"vue",
			"Mobile-first design",
		);
		expect(message).toContain("Framework: vue");
		expect(message).toContain("Mobile-first design");
	});
});
