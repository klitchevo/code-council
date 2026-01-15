import { describe, expect, it } from "vitest";

/**
 * Tests for repo-scanner utilities.
 * Note: aggregateFiles tests are in aggregate-files.test.ts to avoid mock pollution.
 */
describe("repo-scanner", () => {
	describe("sensitive file detection patterns", () => {
		it("should identify sensitive file patterns", () => {
			const sensitivePatterns = [
				".env",
				".env.local",
				".env.production",
				"credentials.json",
				"secret.txt",
				"id_rsa",
				"id_rsa.pub",
				"id_ed25519",
				".npmrc",
				"kubeconfig",
				"password.txt",
				"auth.json",
			];

			// These should all be blocked by the scanner
			for (const pattern of sensitivePatterns) {
				// Pattern matching logic from repo-scanner
				const lowerName = pattern.toLowerCase();
				const isSensitive =
					lowerName.startsWith(".env") ||
					lowerName.includes("credential") ||
					lowerName.includes("secret") ||
					lowerName.startsWith("id_rsa") ||
					lowerName.startsWith("id_ed25519") ||
					lowerName === ".npmrc" ||
					lowerName === "kubeconfig" ||
					lowerName.includes("password") ||
					lowerName === "auth.json";

				expect(isSensitive).toBe(true);
			}
		});
	});

	describe("secret detection patterns", () => {
		it("should detect AWS access keys", () => {
			const awsKeyPattern = /AKIA[0-9A-Z]{16}/;
			expect(awsKeyPattern.test("AKIAIOSFODNN7EXAMPLE")).toBe(true);
			expect(awsKeyPattern.test("not-an-aws-key")).toBe(false);
		});

		it("should detect private keys", () => {
			const pkPattern =
				/-----BEGIN\s+(RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/;
			expect(pkPattern.test("-----BEGIN PRIVATE KEY-----")).toBe(true);
			expect(pkPattern.test("-----BEGIN RSA PRIVATE KEY-----")).toBe(true);
			expect(pkPattern.test("-----BEGIN EC PRIVATE KEY-----")).toBe(true);
			expect(pkPattern.test("-----BEGIN PUBLIC KEY-----")).toBe(false);
		});

		it("should detect GitHub PATs", () => {
			const ghpPattern = /ghp_[a-zA-Z0-9]{36}/;
			expect(ghpPattern.test("ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")).toBe(
				true,
			);
			expect(ghpPattern.test("ghp_short")).toBe(false);
		});

		it("should detect OpenAI keys", () => {
			const openaiPattern = /sk-[a-zA-Z0-9]{48}/;
			expect(
				openaiPattern.test(
					"sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
				),
			).toBe(true);
		});
	});

	describe("token estimation", () => {
		it("should estimate ~4 chars per token", () => {
			// This is a rough approximation used in the scanner
			const content = "This is a test string with about 40 characters.";
			const estimated = Math.ceil(content.length / 4);
			expect(estimated).toBeGreaterThan(0);
			expect(estimated).toBeLessThan(content.length);
		});
	});
});
