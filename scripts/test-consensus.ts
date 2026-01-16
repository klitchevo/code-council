#!/usr/bin/env bun

/**
 * Test script for the consensus feature
 *
 * Usage: bun scripts/test-consensus.ts [--api-extraction]
 *
 * By default, uses host extraction mode (recommended for MCP).
 * Pass --api-extraction to use the old API-based extraction.
 *
 * Requires OPENROUTER_API_KEY environment variable to be set
 */

import {
	getCodeReviewModels,
	getConsensusConfig,
	initializeConfig,
} from "../src/config";
import { buildConsensus } from "../src/consensus";
import { ReviewClient } from "../src/review-client";

// Parse CLI args
const useApiExtraction = process.argv.includes("--api-extraction");

// Sample code to review - TRICKY VERSION with subtle vulnerabilities
const sampleCode = `
import crypto from 'crypto';
import path from 'path';
import { Redis } from 'ioredis';

const redis = new Redis();
const UPLOAD_DIR = '/var/uploads';

interface User {
  id: string;
  role: string;
  permissions: string[];
}

// Rate limiter using sliding window
class RateLimiter {
  private windowMs = 60000;
  private maxRequests = 100;

  async isAllowed(userId: string): Promise<boolean> {
    const key = \`ratelimit:\${userId}\`;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Remove old entries and count recent ones
    await redis.zremrangebyscore(key, 0, windowStart);
    const count = await redis.zcard(key);

    if (count < this.maxRequests) {
      await redis.zadd(key, now, \`\${now}-\${Math.random()}\`);
      await redis.expire(key, 60);
      return true;
    }
    return false;
  }
}

// Generate secure token for password reset
function generateResetToken(email: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  const token = crypto.createHash('sha256')
    .update(\`\${email}:\${timestamp}:\${random}\`)
    .digest('hex');
  return token;
}

// Validate file path for user uploads
function getUploadPath(userId: string, filename: string): string {
  const sanitizedFilename = filename.replace(/\\.\\./g, '');
  const userDir = path.join(UPLOAD_DIR, userId);
  return path.join(userDir, sanitizedFilename);
}

// Check if user has permission (supports wildcards)
function hasPermission(user: User, requiredPermission: string): boolean {
  return user.permissions.some(perm => {
    if (perm.includes('*')) {
      const regex = new RegExp('^' + perm.replace(/\\*/g, '.*') + '$');
      return regex.test(requiredPermission);
    }
    return perm === requiredPermission;
  });
}

// Deep merge configuration objects
function deepMerge(target: any, source: any): any {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object') {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// Parse user-provided JSON with size limit
function safeJsonParse(input: string, maxSize: number = 1024 * 1024): any {
  if (input.length > maxSize) {
    throw new Error('Input too large');
  }
  return JSON.parse(input);
}

// Cache user sessions with automatic cleanup
const sessionCache = new Map<string, { user: User; expires: number }>();

function getSession(sessionId: string): User | null {
  const session = sessionCache.get(sessionId);
  if (session && session.expires > Date.now()) {
    return session.user;
  }
  sessionCache.delete(sessionId);
  return null;
}

// Compare passwords securely
function verifyPassword(inputPassword: string, storedHash: string): boolean {
  const inputHash = crypto.createHash('sha256').update(inputPassword).digest('hex');
  return inputHash === storedHash;
}

// URL validator for redirect
function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'https://myapp.com');
    return parsed.hostname.endsWith('myapp.com');
  } catch {
    return false;
  }
}

// Sanitize HTML output
function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Export user data with field filtering
async function exportUserData(userId: string, fields: string[]): Promise<Record<string, any>> {
  const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  const result: Record<string, any> = {};

  for (const field of fields) {
    if (user[field] !== undefined) {
      result[field] = user[field];
    }
  }

  return result;
}

// API endpoint handler
export async function handleApiRequest(req: Request): Promise<Response> {
  const rateLimiter = new RateLimiter();
  const sessionId = req.headers.get('X-Session-Id') || '';
  const user = getSession(sessionId);

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!await rateLimiter.isAllowed(user.id)) {
    return new Response('Too Many Requests', { status: 429 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  switch (action) {
    case 'export':
      const fields = url.searchParams.get('fields')?.split(',') || [];
      const data = await exportUserData(user.id, fields);
      return new Response(JSON.stringify(data));

    case 'upload':
      const formData = await req.formData();
      const file = formData.get('file') as File;
      const uploadPath = getUploadPath(user.id, file.name);
      await Bun.write(uploadPath, file);
      return new Response('Uploaded');

    default:
      return new Response('Unknown action', { status: 400 });
  }
}
`;

async function main() {
	console.log("🚀 Starting consensus test...\n");

	// Check for API key
	const apiKey = process.env.OPENROUTER_API_KEY;
	if (!apiKey) {
		console.error("❌ OPENROUTER_API_KEY environment variable is required");
		process.exit(1);
	}

	// Initialize config from file
	await initializeConfig();

	// Get config values
	const models = getCodeReviewModels();
	const consensusConfig = getConsensusConfig();

	// Determine extraction mode
	const hostExtraction = !useApiExtraction;

	console.log("📋 Configuration:");
	console.log("   Models:", models);
	console.log("   Consensus enabled:", consensusConfig.enabled);
	console.log(
		"   High confidence threshold:",
		consensusConfig.highConfidenceThreshold,
	);
	console.log("   Host extraction:", hostExtraction);
	if (!hostExtraction) {
		console.log("   Extraction model:", consensusConfig.extractionModel);
	}
	console.log("");

	if (!consensusConfig.enabled) {
		console.log("⚠️  Consensus is not enabled in config. Enable it to test.");
		console.log("   Set consensus.enabled = true in .code-council/config.ts");
		process.exit(0);
	}

	// Create review client
	const client = new ReviewClient(apiKey);

	console.log("📝 Reviewing sample code with", models.length, "models...\n");
	console.log("Sample code:");
	console.log("─".repeat(60));
	console.log(sampleCode.trim());
	console.log("─".repeat(60));
	console.log("");

	// Get reviews from each model
	console.log("⏳ Getting reviews from models...");
	const startTime = Date.now();

	const results = await client.reviewCode(
		sampleCode,
		models,
		"Language: TypeScript. Review this code for security issues, bugs, and best practices.",
	);

	const reviewTime = Date.now() - startTime;
	console.log(`✅ Got ${results.length} reviews in ${reviewTime}ms\n`);

	// Show individual reviews
	console.log("📊 Individual Reviews:");
	console.log("═".repeat(60));
	for (const result of results) {
		console.log(`\n🤖 ${result.model}:`);
		if (result.error) {
			console.log(`   ❌ Error: ${result.error}`);
		} else {
			// Show first 500 chars of review
			const preview = result.review.slice(0, 500);
			console.log(`   ${preview}${result.review.length > 500 ? "..." : ""}`);
		}
	}
	console.log("\n" + "═".repeat(60));

	// Run consensus analysis
	if (hostExtraction) {
		console.log("\n🏠 Using HOST EXTRACTION mode (recommended for MCP)...");
		console.log(
			"   No additional API calls - host model will analyze the reviews.\n",
		);
	} else {
		console.log("\n🔧 Using API EXTRACTION mode...");
		console.log(
			`   Will call ${consensusConfig.extractionModel} to extract findings.\n`,
		);
	}

	const consensusStart = Date.now();

	try {
		const { report, formatted } = await buildConsensus(results, client, {
			modelWeights: consensusConfig.modelWeights,
			highConfidenceThreshold: consensusConfig.highConfidenceThreshold,
			moderateConfidenceThreshold: consensusConfig.moderateConfidenceThreshold,
			extractionModel: consensusConfig.extractionModel,
			hostExtraction,
			outputFormat: "markdown",
		});

		const consensusTime = Date.now() - consensusStart;

		console.log(
			`✅ Consensus ${hostExtraction ? "formatting" : "analysis"} complete in ${consensusTime}ms\n`,
		);

		if (hostExtraction) {
			console.log("📄 Output (ready for host model analysis):");
			console.log("═".repeat(60));
			console.log(formatted);
			console.log("═".repeat(60));
			console.log(
				"\n💡 In MCP mode, this output is returned to the host model (e.g., Claude)",
			);
			console.log(
				"   which will synthesize the findings and provide a unified analysis.",
			);
		} else {
			console.log("📈 Consensus Report Summary:");
			console.log("   Total findings:", report.totalFindings);
			console.log("   High confidence:", report.highConfidence.length);
			console.log("   Moderate confidence:", report.moderateConfidence.length);
			console.log("   Low confidence:", report.lowConfidence.length);
			console.log("   Disagreements:", report.disagreements.length);
			console.log("");

			console.log("📄 Formatted Report:");
			console.log("═".repeat(60));
			console.log(formatted);
			console.log("═".repeat(60));
		}
	} catch (error) {
		console.error("❌ Consensus analysis failed:", error);
		process.exit(1);
	}

	console.log("\n✅ Test complete!");
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
