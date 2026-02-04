/**
 * YAML parser with progressive fallback strategies.
 * Inspired by PR-Agent's try_fix_yaml() approach.
 */

import yaml from "js-yaml";
import { logger } from "../logger";

/**
 * Result of a YAML parse attempt
 */
interface ParseAttemptResult {
	success: boolean;
	data?: unknown;
	strategy?: string;
	error?: string;
}

/**
 * Strip markdown code blocks from text
 */
function stripMarkdownCodeBlocks(text: string): string {
	let result = text.trim();

	// Remove ```yaml or ```json blocks
	if (result.startsWith("```yaml")) {
		result = result.slice(7);
	} else if (result.startsWith("```json")) {
		result = result.slice(7);
	} else if (result.startsWith("```")) {
		result = result.slice(3);
	}

	if (result.endsWith("```")) {
		result = result.slice(0, -3);
	}

	return result.trim();
}

/**
 * Try to add block scalar indicators where needed
 */
function addBlockScalarIndicators(text: string): string {
	// Replace strings that might have escape issues with block scalars
	// This is a heuristic - look for lines with problematic content
	return text.replace(
		/^(\s*)(\w+):\s*"([^"]*\\[^"]*)"$/gm,
		(_, indent, key, value) => {
			// Convert escaped strings to block scalars
			const unescaped = value
				.replace(/\\n/g, "\n")
				.replace(/\\t/g, "\t")
				.replace(/\\"/g, '"')
				.replace(/\\\\/g, "\\");
			return `${indent}${key}: |\n${indent}  ${unescaped.replace(/\n/g, `\n${indent}  `)}`;
		},
	);
}

/**
 * Convert | to |2 for indent issues
 */
function fixBlockScalarIndent(text: string): string {
	return text.replace(/\|(?!\d)/g, "|2");
}

/**
 * Extract YAML content from between markers
 */
function extractYamlFromMarkers(
	text: string,
	firstKey: string,
	lastKey?: string,
): string | null {
	const firstKeyIndex = text.indexOf(`${firstKey}:`);
	if (firstKeyIndex === -1) return null;

	let endIndex = text.length;
	if (lastKey) {
		// Find the last occurrence of the last key and go to end of its value
		const lastKeyIndex = text.lastIndexOf(`${lastKey}:`);
		if (lastKeyIndex !== -1) {
			// Find the end of this key's value (next key at same indent level or end)
			const afterLastKey = text.slice(lastKeyIndex);
			const nextKeyMatch = afterLastKey.match(/\n[a-zA-Z_]/);
			if (nextKeyMatch?.index) {
				endIndex = lastKeyIndex + nextKeyMatch.index;
			}
		}
	}

	return text.slice(firstKeyIndex, endIndex).trim();
}

/**
 * Remove curly brackets that might be confusing the YAML parser
 */
function removeCurlyBrackets(text: string): string {
	// Only remove top-level curly brackets, not nested ones in strings
	let result = text.trim();
	if (result.startsWith("{") && result.endsWith("}")) {
		result = result.slice(1, -1).trim();
	}
	return result;
}

/**
 * Remove leading + symbols (common in diff-style output)
 */
function removeLeadingPlusSymbols(text: string): string {
	return text.replace(/^\+\s*/gm, "");
}

/**
 * Extract YAML starting from "findings:" keyword
 * Handles models that add explanatory text before the YAML
 */
function extractFromFindingsKeyword(text: string): string {
	const stripped = stripMarkdownCodeBlocks(text);
	const findingsIndex = stripped.indexOf("findings:");
	if (findingsIndex === -1) {
		return stripped;
	}
	// Take everything from "findings:" onwards
	return stripped.slice(findingsIndex).trim();
}

/**
 * Fix duplicate keys by keeping only the first occurrence
 * Some models output invalid YAML like:
 *   location:
 *     file: foo.ts
 *     file: bar.ts  <- duplicate key
 */
function removeDuplicateKeys(text: string): string {
	const lines = text.split("\n");
	const result: string[] = [];
	const seenKeys = new Map<number, Set<string>>(); // indent level -> seen keys

	for (const line of lines) {
		const match = line.match(/^(\s*)(\w+):/);
		if (match) {
			const indent = match[1]?.length ?? 0;
			const key = match[2] ?? "";

			// Clear keys at higher indent levels (we've moved back)
			for (const [level] of seenKeys) {
				if (level > indent) {
					seenKeys.delete(level);
				}
			}

			// Check if this key was already seen at this indent level
			const keysAtLevel = seenKeys.get(indent) ?? new Set();
			if (keysAtLevel.has(key)) {
				// Skip duplicate key
				continue;
			}

			keysAtLevel.add(key);
			seenKeys.set(indent, keysAtLevel);
		}

		result.push(line);
	}

	return result.join("\n");
}

/**
 * Replace tabs with spaces
 */
function replaceTabsWithSpaces(text: string): string {
	return text.replace(/\t/g, "  ");
}

/**
 * Try to fix common YAML issues
 */
function tryFixYamlIssues(text: string): string {
	let result = text;

	// Fix unquoted strings that look like they should be quoted
	// e.g., key: some value with: colons
	// But skip YAML array items (values starting with -) and block scalars
	result = result.replace(
		/^(\s*)(\w+):\s+([^|\n]*:[^\n]*)$/gm,
		(_, indent, key, value) => {
			const trimmedValue = value.trim();
			// Don't quote if:
			// - Already quoted
			// - Is a block scalar indicator
			// - Starts with - (YAML array/multiline indicator)
			// - Is a known YAML special value
			if (
				trimmedValue.startsWith('"') ||
				trimmedValue.startsWith("'") ||
				trimmedValue.startsWith("|") ||
				trimmedValue.startsWith(">") ||
				trimmedValue.startsWith("-") ||
				trimmedValue.startsWith("[") ||
				trimmedValue.startsWith("{")
			) {
				return `${indent}${key}: ${value}`;
			}
			return `${indent}${key}: "${trimmedValue.replace(/"/g, '\\"')}"`;
		},
	);

	return result;
}

/**
 * Attempt to parse text as YAML with a specific strategy
 */
function attemptParse(text: string, strategyName: string): ParseAttemptResult {
	try {
		const data = yaml.load(text);
		if (data !== null && data !== undefined) {
			return { success: true, data, strategy: strategyName };
		}
		return { success: false, error: "Parsed to null/undefined" };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return { success: false, error: message };
	}
}

/**
 * Attempt to parse text as JSON
 */
function attemptJsonParse(text: string): ParseAttemptResult {
	try {
		const data = JSON.parse(text);
		return { success: true, data, strategy: "json-fallback" };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return { success: false, error: message };
	}
}

/**
 * Parse YAML with progressive fallback strategies.
 * Falls back to JSON parsing if all YAML strategies fail.
 *
 * @param text - The raw text to parse
 * @param firstKey - Optional key that marks the start of the YAML content
 * @param lastKey - Optional key that marks the end of the YAML content
 * @returns Parsed object
 * @throws Error if all parsing strategies fail
 */
export function parseYamlWithFallbacks(
	text: string,
	firstKey?: string,
	lastKey?: string,
): unknown {
	const strategies: Array<{ name: string; transform: (t: string) => string }> =
		[
			// Try simple approaches first (least likely to break valid YAML)
			{ name: "raw", transform: (t) => t },
			{ name: "strip-markdown", transform: stripMarkdownCodeBlocks },
			{
				name: "extract-findings-keyword",
				transform: extractFromFindingsKeyword,
			},
			{
				name: "strip-markdown+tabs",
				transform: (t) => replaceTabsWithSpaces(stripMarkdownCodeBlocks(t)),
			},
			{
				name: "remove-duplicate-keys",
				transform: (t) => removeDuplicateKeys(stripMarkdownCodeBlocks(t)),
			},
			{
				name: "extract-findings+dedup",
				transform: (t) => removeDuplicateKeys(extractFromFindingsKeyword(t)),
			},
			{
				name: "extract-findings+dedup+tabs",
				transform: (t) =>
					replaceTabsWithSpaces(
						removeDuplicateKeys(extractFromFindingsKeyword(t)),
					),
			},
			// Then try more aggressive fixes
			{
				name: "strip-markdown+fix-issues",
				transform: (t) => tryFixYamlIssues(stripMarkdownCodeBlocks(t)),
			},
			{
				name: "block-scalars",
				transform: (t) => addBlockScalarIndicators(stripMarkdownCodeBlocks(t)),
			},
			{
				name: "fix-indent",
				transform: (t) => fixBlockScalarIndent(stripMarkdownCodeBlocks(t)),
			},
			{
				name: "remove-curly",
				transform: (t) => removeCurlyBrackets(stripMarkdownCodeBlocks(t)),
			},
			{
				name: "remove-plus",
				transform: (t) => removeLeadingPlusSymbols(stripMarkdownCodeBlocks(t)),
			},
			{
				name: "tabs-to-spaces",
				transform: (t) => replaceTabsWithSpaces(stripMarkdownCodeBlocks(t)),
			},
			{
				name: "combined-fixes",
				transform: (t) =>
					tryFixYamlIssues(
						replaceTabsWithSpaces(
							removeLeadingPlusSymbols(
								removeCurlyBrackets(stripMarkdownCodeBlocks(t)),
							),
						),
					),
			},
			{
				name: "extract-findings-keyword+fixes",
				transform: (t) =>
					tryFixYamlIssues(
						replaceTabsWithSpaces(extractFromFindingsKeyword(t)),
					),
			},
			{
				name: "remove-duplicate-keys+all-fixes",
				transform: (t) =>
					tryFixYamlIssues(
						replaceTabsWithSpaces(
							removeDuplicateKeys(extractFromFindingsKeyword(t)),
						),
					),
			},
		];

	// Add marker-based extraction if keys provided
	if (firstKey) {
		strategies.push({
			name: "extract-by-markers",
			transform: (t) => {
				const extracted = extractYamlFromMarkers(
					stripMarkdownCodeBlocks(t),
					firstKey,
					lastKey,
				);
				return extracted ?? t;
			},
		});
		strategies.push({
			name: "extract-by-markers+dedup",
			transform: (t) => {
				const extracted = extractYamlFromMarkers(
					stripMarkdownCodeBlocks(t),
					firstKey,
					lastKey,
				);
				return removeDuplicateKeys(extracted ?? t);
			},
		});
	}

	const errors: string[] = [];

	// Try each YAML strategy
	for (const strategy of strategies) {
		const transformed = strategy.transform(text);
		const result = attemptParse(transformed, strategy.name);

		if (result.success) {
			logger.debug("YAML parsed successfully", { strategy: strategy.name });
			return result.data;
		}

		errors.push(`${strategy.name}: ${result.error}`);
	}

	// Final fallback: try JSON parsing on stripped text
	const strippedText = stripMarkdownCodeBlocks(text);
	const jsonResult = attemptJsonParse(strippedText);

	if (jsonResult.success) {
		logger.debug("Fell back to JSON parsing");
		return jsonResult.data;
	}

	errors.push(`json-fallback: ${jsonResult.error}`);

	// All strategies failed - log the raw input for debugging
	const errorSummary = errors.slice(-3).join("; "); // Last 3 errors
	const truncatedInput = text.length > 200 ? `${text.slice(0, 200)}...` : text;
	logger.error("YAML/JSON parsing failed", {
		inputLength: text.length,
		inputPreview: truncatedInput,
		strategiesTried: strategies.length + 1,
		lastErrors: errors.slice(-3),
	});
	throw new Error(
		`Failed to parse YAML/JSON after ${strategies.length + 1} attempts. Last errors: ${errorSummary}`,
	);
}

/**
 * Parse extraction response specifically (findings array)
 * Uses "findings" as the expected first key for marker extraction
 */
export function parseExtractionYaml(text: string): unknown {
	return parseYamlWithFallbacks(text, "findings");
}
