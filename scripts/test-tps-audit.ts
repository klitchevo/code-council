#!/usr/bin/env bun
/**
 * Test script for TPS audit with batching
 */

import { DEFAULT_MODELS } from "../src/constants";
import { ReviewClient } from "../src/review-client";
import { formatTpsAuditResults, handleTpsAudit } from "../src/tools/tps-audit";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
	console.error("Error: OPENROUTER_API_KEY environment variable is required");
	process.exit(1);
}

const targetPath =
	process.argv[2] || "/home/pho7on/primehire/the-invention-network-monorepo";

console.log(`\n🔍 Running TPS audit on: ${targetPath}\n`);

const client = new ReviewClient(OPENROUTER_API_KEY);

const models = DEFAULT_MODELS;

try {
	const result = await handleTpsAudit(client, models, {
		path: targetPath,
		max_files: 2000,
		output_format: "html",
	});

	console.log("\n📊 Scan Results:");
	console.log(`  - Files analyzed: ${result.scanResult.files.length}`);
	console.log(`  - Token estimate: ${result.scanResult.stats.tokenEstimate}`);
	console.log(`  - Skipped files: ${result.scanResult.skipped.length}`);

	if (result.analysis) {
		console.log("\n📈 TPS Scores:");
		console.log(`  - Overall: ${result.analysis.scores.overall}/100`);
		console.log(`  - Flow: ${result.analysis.scores.flow}/100`);
		console.log(`  - Waste: ${result.analysis.scores.waste}/100`);
		console.log(`  - Quality: ${result.analysis.scores.quality}/100`);
	}

	// Format and save the report
	const formatted = formatTpsAuditResults(result);
	console.log("\n✅ Report generated successfully!");

	// The filepath is included in the formatted output
	if (formatted.includes("Report saved to:")) {
		const match = formatted.match(/Report saved to:\s*`([^`]+)`/);
		if (match) {
			console.log(`📁 Report saved to: ${match[1]}`);
		}
	}
} catch (error) {
	console.error("\n❌ Error:", error instanceof Error ? error.message : error);
	process.exit(1);
}
