/**
 * Mock ConsensusClient for testing.
 * Returns predetermined findings without making API calls.
 */

import type { ModelReviewResult } from "../../review-client";
import type { Finding } from "../types";
import { toFindingId } from "../types";

/**
 * Predefined mock findings for testing
 */
export const mockFindings: Map<string, Finding[]> = new Map([
	[
		"anthropic/claude-3.5-sonnet",
		[
			{
				id: toFindingId("mock-finding-1"),
				sourceModel: "anthropic/claude-3.5-sonnet",
				category: "security",
				severity: "critical",
				title: "SQL Injection Vulnerability",
				description: "User input directly interpolated into SQL query",
				location: { file: "src/api/users.ts", line: 42 },
				suggestion: "Use parameterized queries",
				rawExcerpt: "Critical: SQL Injection Vulnerability",
				extractedAt: "2024-01-15T10:00:00Z",
				confidence: 0.95,
			},
			{
				id: toFindingId("mock-finding-2"),
				sourceModel: "anthropic/claude-3.5-sonnet",
				category: "performance",
				severity: "medium",
				title: "N+1 Query Pattern",
				description: "Fetching related records in a loop",
				location: { file: "src/api/posts.ts", line: 15, endLine: 25 },
				suggestion: "Use JOIN or batch fetch",
				rawExcerpt: "Medium: N+1 Query Pattern",
				extractedAt: "2024-01-15T10:00:00Z",
				confidence: 0.85,
			},
		],
	],
	[
		"openai/gpt-4-turbo",
		[
			{
				id: toFindingId("mock-finding-3"),
				sourceModel: "openai/gpt-4-turbo",
				category: "security",
				severity: "critical",
				title: "SQL Injection Risk",
				description: "SQL injection vulnerability in user query",
				location: { file: "src/api/users.ts", line: 42 },
				suggestion: "Use prepared statements",
				rawExcerpt: "Critical: SQL injection vulnerability",
				extractedAt: "2024-01-15T10:00:00Z",
				confidence: 0.92,
			},
			{
				id: toFindingId("mock-finding-4"),
				sourceModel: "openai/gpt-4-turbo",
				category: "security",
				severity: "critical",
				title: "Authentication Bypass",
				description: "Token expiration not checked",
				location: { file: "src/api/auth.ts", line: 28 },
				suggestion: "Validate token expiration",
				rawExcerpt: "Authentication bypass possible",
				extractedAt: "2024-01-15T10:00:00Z",
				confidence: 0.88,
			},
		],
	],
	[
		"google/gemini-pro",
		[
			{
				id: toFindingId("mock-finding-5"),
				sourceModel: "google/gemini-pro",
				category: "security",
				severity: "high",
				title: "SQL Injection",
				description: "Potential SQL injection",
				location: { file: "src/api/users.ts", line: 42 },
				suggestion: "Parameterized queries",
				rawExcerpt: "High: SQL injection",
				extractedAt: "2024-01-15T10:00:00Z",
				confidence: 0.9,
			},
		],
	],
]);

/**
 * Mock ConsensusClient class
 */
export class MockConsensusClient {
	private extractionModel: string;
	private customFindings: Map<string, Finding[]> | null = null;
	private shouldFail: boolean = false;
	private failureError: string = "Mock extraction failed";

	constructor(
		_reviewClient: unknown,
		extractionModel: string = "anthropic/claude-3-haiku",
	) {
		this.extractionModel = extractionModel;
	}

	/**
	 * Set custom findings for testing
	 */
	setMockFindings(findings: Map<string, Finding[]>): void {
		this.customFindings = findings;
	}

	/**
	 * Configure the mock to fail
	 */
	setFailure(fail: boolean, error: string = "Mock extraction failed"): void {
		this.shouldFail = fail;
		this.failureError = error;
	}

	/**
	 * Mock extractFindings
	 */
	async extractFindings(review: ModelReviewResult): Promise<Finding[]> {
		if (this.shouldFail) {
			throw new Error(this.failureError);
		}

		if (review.error || !review.review) {
			return [];
		}

		const findings =
			this.customFindings?.get(review.model) ??
			mockFindings.get(review.model) ??
			[];

		return findings;
	}

	/**
	 * Mock extractAllFindings
	 */
	async extractAllFindings(reviews: ModelReviewResult[]): Promise<{
		findings: Map<string, Finding[]>;
		errors: Array<{ model: string; error: string }>;
		totalFindings: number;
	}> {
		const findings = new Map<string, Finding[]>();
		const errors: Array<{ model: string; error: string }> = [];
		let totalFindings = 0;

		for (const review of reviews) {
			if (review.error) {
				errors.push({ model: review.model, error: review.error });
				findings.set(review.model, []);
				continue;
			}

			try {
				const extracted = await this.extractFindings(review);
				findings.set(review.model, extracted);
				totalFindings += extracted.length;
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Unknown error";
				errors.push({ model: review.model, error: message });
				findings.set(review.model, []);
			}
		}

		return { findings, errors, totalFindings };
	}

	/**
	 * Mock getAllFindingsFlat
	 */
	async getAllFindingsFlat(reviews: ModelReviewResult[]): Promise<{
		findings: Finding[];
		errors: Array<{ model: string; error: string }>;
	}> {
		const { findings: findingsMap, errors } =
			await this.extractAllFindings(reviews);

		const allFindings: Finding[] = [];
		for (const f of findingsMap.values()) {
			allFindings.push(...f);
		}

		return { findings: allFindings, errors };
	}

	getExtractionModel(): string {
		return this.extractionModel;
	}

	setExtractionModel(model: string): void {
		this.extractionModel = model;
	}
}
