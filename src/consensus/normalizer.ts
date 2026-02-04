/**
 * Normalizes extracted findings to ensure consistent format.
 * Handles variations in location formats, severities, and categories.
 */

import type {
	CodeLocation,
	Finding,
	FindingCategory,
	FindingSeverity,
} from "./types";
import { FINDING_CATEGORIES, FINDING_SEVERITIES } from "./types";

/**
 * Severity aliases that models might use
 */
const SEVERITY_ALIASES: Record<string, FindingSeverity> = {
	// Critical aliases
	critical: "critical",
	severe: "critical",
	urgent: "critical",
	blocker: "critical",
	p0: "critical",
	"must fix": "critical",
	// High aliases
	high: "high",
	important: "high",
	significant: "high",
	major: "high",
	p1: "high",
	"should fix": "high",
	// Medium aliases
	medium: "medium",
	moderate: "medium",
	normal: "medium",
	p2: "medium",
	// Low aliases
	low: "low",
	minor: "low",
	trivial: "low",
	p3: "low",
	nitpick: "low",
	// Info aliases
	info: "info",
	informational: "info",
	note: "info",
	suggestion: "info",
	fyi: "info",
	p4: "info",
};

/**
 * Category aliases that models might use
 */
const CATEGORY_ALIASES: Record<string, FindingCategory> = {
	// Security
	security: "security",
	sec: "security",
	vulnerability: "security",
	vuln: "security",
	"sql injection": "security",
	xss: "security",
	auth: "security",
	authentication: "security",
	authorization: "security",
	// Performance
	performance: "performance",
	perf: "performance",
	speed: "performance",
	efficiency: "performance",
	"n+1": "performance",
	memory: "performance",
	// Bug
	bug: "bug",
	error: "bug",
	defect: "bug",
	issue: "bug",
	fault: "bug",
	logic: "bug",
	// Maintainability
	maintainability: "maintainability",
	maintenance: "maintainability",
	readability: "maintainability",
	complexity: "maintainability",
	"code quality": "maintainability",
	"tech debt": "maintainability",
	"technical debt": "maintainability",
	"code smell": "maintainability",
	// Accessibility
	accessibility: "accessibility",
	a11y: "accessibility",
	wcag: "accessibility",
	"screen reader": "accessibility",
	// Architecture
	architecture: "architecture",
	arch: "architecture",
	design: "architecture",
	pattern: "architecture",
	structure: "architecture",
	coupling: "architecture",
	// Style
	style: "style",
	formatting: "style",
	convention: "style",
	lint: "style",
	// Documentation
	documentation: "documentation",
	docs: "documentation",
	comment: "documentation",
	jsdoc: "documentation",
	typedoc: "documentation",
	// Testing
	testing: "testing",
	test: "testing",
	tests: "testing",
	coverage: "testing",
	"unit test": "testing",
	// Other
	other: "other",
	misc: "other",
	general: "other",
};

/**
 * Normalize a severity string to a valid FindingSeverity
 */
export function normalizeSeverity(severity: string): FindingSeverity {
	const normalized = severity.toLowerCase().trim();
	return SEVERITY_ALIASES[normalized] ?? "medium";
}

/**
 * Normalize a category string to a valid FindingCategory
 */
export function normalizeCategory(category: string): FindingCategory {
	const normalized = category.toLowerCase().trim();
	return CATEGORY_ALIASES[normalized] ?? "other";
}

/**
 * Normalize a file path to a consistent format
 */
export function normalizeFilePath(filePath: string): string {
	let normalized = filePath.trim();

	// Convert backslashes to forward slashes
	normalized = normalized.replace(/\\/g, "/");

	// Remove leading ./ if present
	if (normalized.startsWith("./")) {
		normalized = normalized.slice(2);
	}

	// Remove duplicate slashes
	normalized = normalized.replace(/\/+/g, "/");

	// Remove trailing slash
	if (normalized.endsWith("/")) {
		normalized = normalized.slice(0, -1);
	}

	return normalized;
}

/**
 * Normalize a code location
 */
export function normalizeLocation(
	location: CodeLocation | undefined,
): CodeLocation | undefined {
	if (!location || !location.file) {
		return undefined;
	}

	const file = normalizeFilePath(location.file);

	// Validate line numbers
	let line = location.line;
	let endLine = location.endLine;

	if (line !== undefined && line < 0) {
		line = undefined;
	}

	if (endLine !== undefined) {
		if (endLine < 0) {
			endLine = undefined;
		} else if (line !== undefined && endLine < line) {
			// Swap if end is before start
			[line, endLine] = [endLine, line];
		}
	}

	return {
		file,
		line,
		endLine,
	};
}

/**
 * Normalize a complete Finding object
 */
export function normalizeFinding(finding: Finding): Finding {
	// Validate category and severity are in the valid set
	const category = FINDING_CATEGORIES.includes(finding.category)
		? finding.category
		: normalizeCategory(finding.category);

	const severity = FINDING_SEVERITIES.includes(finding.severity)
		? finding.severity
		: normalizeSeverity(finding.severity);

	return {
		...finding,
		category,
		severity,
		title: finding.title.trim(),
		description: finding.description.trim(),
		location: normalizeLocation(finding.location),
		suggestion: finding.suggestion?.trim(),
		rawExcerpt: finding.rawExcerpt?.trim(),
		confidence:
			finding.confidence !== undefined
				? Math.max(0, Math.min(1, finding.confidence))
				: undefined,
	};
}

/**
 * Normalize an array of findings
 */
export function normalizeFindings(findings: Finding[]): Finding[] {
	return findings.map(normalizeFinding);
}

/**
 * Check if two locations refer to the same area (within a tolerance)
 */
export function locationsMatch(
	loc1: CodeLocation | undefined,
	loc2: CodeLocation | undefined,
	lineTolerance: number = 5,
): boolean {
	// If both are undefined, they match (no location = could be anywhere)
	if (!loc1 && !loc2) {
		return true;
	}

	// If one is undefined, they don't match
	if (!loc1 || !loc2) {
		return false;
	}

	// Files must match (after normalization)
	if (normalizeFilePath(loc1.file) !== normalizeFilePath(loc2.file)) {
		return false;
	}

	// If neither has line numbers, they match (same file)
	if (loc1.line === undefined && loc2.line === undefined) {
		return true;
	}

	// If one has line numbers and the other doesn't, consider them a match
	// (same file, one is more specific than the other)
	if (loc1.line === undefined || loc2.line === undefined) {
		return true;
	}

	// Check if line numbers are within tolerance
	const diff = Math.abs(loc1.line - loc2.line);
	return diff <= lineTolerance;
}

/**
 * Calculate the canonical location from multiple findings
 * Uses the most specific location (has line numbers)
 */
export function getCanonicalLocation(
	locations: (CodeLocation | undefined)[],
): CodeLocation | undefined {
	const validLocations = locations.filter(
		(loc): loc is CodeLocation => loc !== undefined && !!loc.file,
	);

	if (validLocations.length === 0) {
		return undefined;
	}

	// Prefer locations with line numbers
	const withLines = validLocations.filter((loc) => loc.line !== undefined);
	if (withLines.length > 0) {
		// Return the one with the most detail (has endLine)
		const withEndLine = withLines.find((loc) => loc.endLine !== undefined);
		if (withEndLine) {
			return normalizeLocation(withEndLine);
		}
		return normalizeLocation(withLines[0]);
	}

	// Fall back to first valid location
	return normalizeLocation(validLocations[0]);
}
