/**
 * Sample ModelReviewResult fixtures for testing consensus analysis.
 * These are realistic examples of multi-model review outputs.
 */

import type { ModelReviewResult } from "../../review-client";

/**
 * Sample security-focused review from Claude
 */
export const claudeSecurityReview: ModelReviewResult = {
	model: "anthropic/claude-3.5-sonnet",
	review: `## Code Review

### Security Issues

**Critical: SQL Injection Vulnerability**
File: \`src/api/users.ts\`, Line 42

The user input is directly interpolated into the SQL query without sanitization:
\`\`\`typescript
const query = \`SELECT * FROM users WHERE id = \${userId}\`;
\`\`\`

This allows attackers to inject malicious SQL. Use parameterized queries instead:
\`\`\`typescript
const query = 'SELECT * FROM users WHERE id = $1';
await db.query(query, [userId]);
\`\`\`

**High: Missing Input Validation**
File: \`src/api/users.ts\`, Line 38

The \`userId\` parameter is used without validation. Add type checking and bounds validation.

### Performance Issues

**Medium: N+1 Query Pattern**
File: \`src/api/posts.ts\`, Lines 15-25

The code fetches posts then loops to get authors individually. Use a JOIN or batch fetch instead.

### Code Quality

**Low: Magic Numbers**
File: \`src/utils/pagination.ts\`, Line 12

The value \`20\` should be extracted to a named constant \`DEFAULT_PAGE_SIZE\`.
`,
};

/**
 * Sample review from GPT-4 (different perspective)
 */
export const gpt4Review: ModelReviewResult = {
	model: "openai/gpt-4-turbo",
	review: `# Code Review Results

## Critical Findings

1. **SQL Injection Risk** (src/api/users.ts:42)
   The database query constructs SQL strings using template literals with user input. This is a textbook SQL injection vulnerability. Recommendation: Use prepared statements.

2. **Authentication Bypass Possible** (src/api/auth.ts:28)
   The session validation doesn't check token expiration. An attacker could use expired tokens indefinitely.

## Important Improvements

- **Input Validation Missing** (src/api/users.ts:38) - The userId isn't validated before use
- **Error Messages Leak Information** (src/api/users.ts:55) - Stack traces exposed to clients

## Minor Suggestions

- Consider adding JSDoc comments to public API functions
- The pagination utility could benefit from TypeScript generics
`,
};

/**
 * Sample review from Gemini (yet another perspective)
 */
export const geminiReview: ModelReviewResult = {
	model: "google/gemini-pro",
	review: `## Review Summary

The code has several issues that need attention:

### High Priority

**Security: SQL Injection**
In \`src/api/users.ts\` around line 42, there's a SQL injection vulnerability where user input is directly concatenated. This needs immediate fixing with parameterized queries.

**Security: Session Management**
The auth module at \`src/api/auth.ts\` line 28 has a session handling flaw - tokens aren't checked for expiration.

### Medium Priority

**Performance: Database Queries**
The posts API has an N+1 query problem. Each post triggers a separate author lookup. Consider using JOINs.

### Low Priority

**Style: Constants**
Magic numbers like the page size of 20 should be constants.

**Documentation: Missing Types**
Some functions lack TypeScript type annotations.
`,
};

/**
 * Sample review with parsing challenges (markdown code blocks, etc.)
 */
export const challengingFormatReview: ModelReviewResult = {
	model: "meta-llama/llama-3.1-70b",
	review: `Here's my analysis:

\`\`\`
CRITICAL ISSUES:
- SQL injection in users.ts line 42
- Missing auth checks
\`\`\`

Some notes:
1. The **pagination** could be better (see utils/pagination.ts:12)
2. Consider error handling improvements

That's all for now!
`,
};

/**
 * Empty review (model didn't find issues)
 */
export const emptyReview: ModelReviewResult = {
	model: "anthropic/claude-3-haiku",
	review: `## Code Review

The code looks good overall. No significant issues found.

Nice job on:
- Clean code structure
- Good variable naming
- Appropriate error handling
`,
};

/**
 * Review with error
 */
export const errorReview: ModelReviewResult = {
	model: "openai/gpt-4",
	review: "",
	error: "Rate limit exceeded. Please try again later.",
};

/**
 * Complete set of reviews for testing consensus
 */
export const sampleReviewSet: ModelReviewResult[] = [
	claudeSecurityReview,
	gpt4Review,
	geminiReview,
];

/**
 * Reviews with one error
 */
export const reviewSetWithError: ModelReviewResult[] = [
	claudeSecurityReview,
	gpt4Review,
	errorReview,
];

/**
 * Reviews with formatting challenges
 */
export const challengingReviewSet: ModelReviewResult[] = [
	challengingFormatReview,
	emptyReview,
];

/**
 * Single model review
 */
export const singleModelReview: ModelReviewResult[] = [claudeSecurityReview];

/**
 * All models errored
 */
export const allErrorReviews: ModelReviewResult[] = [
	errorReview,
	{ ...errorReview, model: "google/gemini-pro" },
];
