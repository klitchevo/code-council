/**
 * Formatters for consensus reports.
 * Supports markdown, JSON, and HTML output formats.
 */

import type {
	ConsensusReport,
	Disagreement,
	FindingCluster,
	OutputFormat,
} from "./types";

/**
 * Format a consensus report in the specified format
 */
export function formatReport(
	report: ConsensusReport,
	format: OutputFormat = "markdown",
): string {
	switch (format) {
		case "json":
			return formatJson(report);
		case "html":
			return formatHtml(report);
		default:
			return formatMarkdown(report);
	}
}

/**
 * Format as JSON
 */
function formatJson(report: ConsensusReport): string {
	return JSON.stringify(report, null, 2);
}

/**
 * Format severity as emoji for markdown
 */
function severityEmoji(severity: string): string {
	switch (severity) {
		case "critical":
			return "🔴";
		case "high":
			return "🟠";
		case "medium":
			return "🟡";
		case "low":
			return "🔵";
		case "info":
			return "⚪";
		default:
			return "⚪";
	}
}

/**
 * Format consensus type as badge
 */
function consensusBadge(consensusType: string): string {
	switch (consensusType) {
		case "unanimous":
			return "✅ Unanimous";
		case "majority":
			return "👥 Majority";
		case "minority":
			return "⚠️ Minority";
		case "single":
			return "👤 Single";
		default:
			return consensusType;
	}
}

/**
 * Format a cluster for markdown
 */
function formatClusterMarkdown(cluster: FindingCluster, index: number): string {
	const lines: string[] = [];

	// Header with severity and title
	lines.push(
		`### ${index + 1}. ${severityEmoji(cluster.severity)} ${cluster.title}`,
	);
	lines.push("");

	// Metadata
	lines.push(`**Category:** ${cluster.category}`);
	lines.push(`**Severity:** ${cluster.severity}`);
	lines.push(`**Confidence:** ${(cluster.confidence * 100).toFixed(0)}%`);
	lines.push(`**Consensus:** ${consensusBadge(cluster.consensusType)}`);

	if (cluster.canonicalLocation) {
		const loc = cluster.canonicalLocation;
		const lineInfo = loc.line
			? loc.endLine
				? `:${loc.line}-${loc.endLine}`
				: `:${loc.line}`
			: "";
		lines.push(`**Location:** \`${loc.file}${lineInfo}\``);
	}

	lines.push("");

	// Agreeing models
	if (cluster.agreeingModels.length > 0) {
		lines.push(
			`**Reported by:** ${cluster.agreeingModels.map((m) => `\`${m}\``).join(", ")}`,
		);
	}

	// Silent models
	if (cluster.silentModels.length > 0) {
		lines.push(
			`**Not mentioned by:** ${cluster.silentModels.map((m) => `\`${m}\``).join(", ")}`,
		);
	}

	lines.push("");

	// Individual findings
	if (cluster.findings.length > 0) {
		lines.push("**Details from each model:**");
		lines.push("");
		for (const finding of cluster.findings) {
			lines.push(`- **${finding.sourceModel}**: ${finding.description}`);
			if (finding.suggestion) {
				lines.push(`  - *Suggestion:* ${finding.suggestion}`);
			}
		}
	}

	lines.push("");
	lines.push("---");
	lines.push("");

	return lines.join("\n");
}

/**
 * Format a disagreement for markdown
 */
function formatDisagreementMarkdown(
	disagreement: Disagreement,
	index: number,
): string {
	const lines: string[] = [];

	lines.push(`### ⚔️ Disagreement ${index + 1}: ${disagreement.topic}`);
	lines.push("");

	lines.push(`**Category:** ${disagreement.category}`);
	if (disagreement.location) {
		const loc = disagreement.location;
		const lineInfo = loc.line ? `:${loc.line}` : "";
		lines.push(`**Location:** \`${loc.file}${lineInfo}\``);
	}
	lines.push("");

	lines.push("**Positions:**");
	lines.push("");
	for (const pos of disagreement.positions) {
		lines.push(`- **${pos.model}**: ${pos.stance}`);
		if (pos.reasoning) {
			lines.push(`  - *Reasoning:* ${pos.reasoning.substring(0, 200)}...`);
		}
	}
	lines.push("");

	lines.push(`**Action Required:** ${disagreement.humanActionRequired}`);
	lines.push("");
	lines.push("---");
	lines.push("");

	return lines.join("\n");
}

/**
 * Format as Markdown
 */
function formatMarkdown(report: ConsensusReport): string {
	const lines: string[] = [];

	// Header
	lines.push("# Consensus Code Review Report");
	lines.push("");
	lines.push(`*Generated: ${report.generatedAt}*`);
	lines.push(`*Execution time: ${report.executionTimeMs}ms*`);
	lines.push("");

	// Summary
	lines.push("## Summary");
	lines.push("");
	lines.push(
		`- **Participating Models:** ${report.participatingModels.length}`,
	);
	lines.push(`- **Total Findings:** ${report.totalFindings}`);
	lines.push(`- **High Confidence Issues:** ${report.highConfidence.length}`);
	lines.push(
		`- **Moderate Confidence Issues:** ${report.moderateConfidence.length}`,
	);
	lines.push(`- **Low Confidence Issues:** ${report.lowConfidence.length}`);
	lines.push(
		`- **Disagreements Requiring Review:** ${report.disagreements.length}`,
	);
	lines.push("");

	// Stats
	lines.push("### Consensus Distribution");
	lines.push("");
	lines.push(`| Type | Count |`);
	lines.push(`|------|-------|`);
	lines.push(`| ✅ Unanimous | ${report.stats.unanimous} |`);
	lines.push(`| 👥 Majority | ${report.stats.majority} |`);
	lines.push(`| ⚠️ Minority | ${report.stats.minority} |`);
	lines.push(`| 👤 Single | ${report.stats.single} |`);
	lines.push(`| ⚔️ Disagreements | ${report.stats.disagreements} |`);
	lines.push("");

	// Models
	lines.push("### Participating Models");
	lines.push("");
	for (const model of report.participatingModels) {
		const weight = report.modelWeights[model] ?? 1.0;
		lines.push(`- \`${model}\` (weight: ${weight})`);
	}
	lines.push("");

	// High confidence findings
	if (report.highConfidence.length > 0) {
		lines.push("## 🔥 High Confidence Findings");
		lines.push("");
		lines.push(
			`*These findings have ${report.thresholds.high * 100}%+ model agreement*`,
		);
		lines.push("");

		report.highConfidence.forEach((cluster, i) => {
			lines.push(formatClusterMarkdown(cluster, i));
		});
	}

	// Moderate confidence findings
	if (report.moderateConfidence.length > 0) {
		lines.push("## ⚡ Moderate Confidence Findings");
		lines.push("");
		lines.push(
			`*These findings have ${report.thresholds.moderate * 100}%-${report.thresholds.high * 100}% model agreement*`,
		);
		lines.push("");

		report.moderateConfidence.forEach((cluster, i) => {
			lines.push(formatClusterMarkdown(cluster, i));
		});
	}

	// Low confidence findings
	if (report.lowConfidence.length > 0) {
		lines.push("## 💭 Low Confidence Findings");
		lines.push("");
		lines.push(
			`*These findings have less than ${report.thresholds.moderate * 100}% model agreement*`,
		);
		lines.push("");

		report.lowConfidence.forEach((cluster, i) => {
			lines.push(formatClusterMarkdown(cluster, i));
		});
	}

	// Disagreements
	if (report.disagreements.length > 0) {
		lines.push("## ⚔️ Disagreements Requiring Human Review");
		lines.push("");
		lines.push(
			"*These issues have conflicting opinions from different models and need human decision*",
		);
		lines.push("");

		report.disagreements.forEach((disagreement, i) => {
			lines.push(formatDisagreementMarkdown(disagreement, i));
		});
	}

	// Metadata
	if (report.metadata) {
		lines.push("## Metadata");
		lines.push("");
		lines.push(
			`- **Extraction Model:** \`${report.metadata.extractionModel}\``,
		);
		lines.push(`- **Extraction Errors:** ${report.metadata.extractionErrors}`);
		lines.push("");
	}

	// Footer
	lines.push("---");
	lines.push("*Report generated by code-council consensus analysis*");

	return lines.join("\n");
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/**
 * Format cluster for HTML
 */
function formatClusterHtml(cluster: FindingCluster): string {
	const severityClass = `severity-${cluster.severity}`;
	const location = cluster.canonicalLocation
		? `<code>${escapeHtml(cluster.canonicalLocation.file)}${cluster.canonicalLocation.line ? `:${cluster.canonicalLocation.line}` : ""}</code>`
		: "N/A";

	return `
    <div class="finding-cluster ${severityClass}">
      <h3>${severityEmoji(cluster.severity)} ${escapeHtml(cluster.title)}</h3>
      <div class="metadata">
        <span class="badge category">${escapeHtml(cluster.category)}</span>
        <span class="badge severity">${escapeHtml(cluster.severity)}</span>
        <span class="badge confidence">${(cluster.confidence * 100).toFixed(0)}%</span>
        <span class="badge consensus">${consensusBadge(cluster.consensusType)}</span>
      </div>
      <p><strong>Location:</strong> ${location}</p>
      <p><strong>Reported by:</strong> ${cluster.agreeingModels.map((m) => `<code>${escapeHtml(m)}</code>`).join(", ")}</p>
      ${cluster.silentModels.length > 0 ? `<p><strong>Not mentioned by:</strong> ${cluster.silentModels.map((m) => `<code>${escapeHtml(m)}</code>`).join(", ")}</p>` : ""}
      <div class="findings">
        ${cluster.findings
					.map(
						(f) => `
          <div class="finding">
            <strong>${escapeHtml(f.sourceModel)}:</strong> ${escapeHtml(f.description)}
            ${f.suggestion ? `<br><em>Suggestion: ${escapeHtml(f.suggestion)}</em>` : ""}
          </div>
        `,
					)
					.join("")}
      </div>
    </div>
  `;
}

/**
 * Format disagreement for HTML
 */
function formatDisagreementHtml(disagreement: Disagreement): string {
	return `
    <div class="disagreement">
      <h3>⚔️ ${escapeHtml(disagreement.topic)}</h3>
      <p><strong>Category:</strong> ${escapeHtml(disagreement.category)}</p>
      ${disagreement.location ? `<p><strong>Location:</strong> <code>${escapeHtml(disagreement.location.file)}${disagreement.location.line ? `:${disagreement.location.line}` : ""}</code></p>` : ""}
      <div class="positions">
        <h4>Positions:</h4>
        <ul>
          ${disagreement.positions
						.map(
							(p) => `
            <li>
              <strong>${escapeHtml(p.model)}:</strong> ${escapeHtml(p.stance)}
              ${p.reasoning ? `<br><em>${escapeHtml(p.reasoning.substring(0, 200))}...</em>` : ""}
            </li>
          `,
						)
						.join("")}
        </ul>
      </div>
      <p class="action-required"><strong>Action Required:</strong> ${escapeHtml(disagreement.humanActionRequired)}</p>
    </div>
  `;
}

/**
 * Format as HTML
 */
function formatHtml(report: ConsensusReport): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Consensus Code Review Report</title>
  <style>
    :root {
      --critical: #dc2626;
      --high: #f97316;
      --medium: #eab308;
      --low: #3b82f6;
      --info: #6b7280;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
      background: #f9fafb;
      color: #1f2937;
    }
    h1 { color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; }
    h2 { color: #374151; margin-top: 2rem; }
    .summary { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stats-table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    .stats-table th, .stats-table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
    .stats-table th { background: #f3f4f6; }
    .finding-cluster, .disagreement {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      margin: 1rem 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border-left: 4px solid var(--info);
    }
    .severity-critical { border-left-color: var(--critical); }
    .severity-high { border-left-color: var(--high); }
    .severity-medium { border-left-color: var(--medium); }
    .severity-low { border-left-color: var(--low); }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.875rem;
      margin-right: 0.5rem;
      background: #e5e7eb;
    }
    .badge.category { background: #dbeafe; color: #1e40af; }
    .badge.severity { background: #fef3c7; color: #92400e; }
    .badge.confidence { background: #d1fae5; color: #065f46; }
    .badge.consensus { background: #f3e8ff; color: #6b21a8; }
    code { background: #f3f4f6; padding: 0.125rem 0.375rem; border-radius: 4px; font-size: 0.875rem; }
    .findings { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; }
    .finding { margin: 0.5rem 0; }
    .disagreement { border-left-color: #ef4444; }
    .action-required { background: #fef2f2; padding: 1rem; border-radius: 4px; margin-top: 1rem; }
    .metadata { margin: 0.5rem 0; }
    footer { margin-top: 2rem; color: #6b7280; font-size: 0.875rem; text-align: center; }
  </style>
</head>
<body>
  <h1>🎯 Consensus Code Review Report</h1>

  <div class="summary">
    <h2>Summary</h2>
    <p><strong>Generated:</strong> ${escapeHtml(report.generatedAt)}</p>
    <p><strong>Execution Time:</strong> ${report.executionTimeMs}ms</p>
    <p><strong>Participating Models:</strong> ${report.participatingModels.map((m) => `<code>${escapeHtml(m)}</code>`).join(", ")}</p>
    <p><strong>Total Findings:</strong> ${report.totalFindings}</p>

    <table class="stats-table">
      <tr><th>Consensus Type</th><th>Count</th></tr>
      <tr><td>✅ Unanimous</td><td>${report.stats.unanimous}</td></tr>
      <tr><td>👥 Majority</td><td>${report.stats.majority}</td></tr>
      <tr><td>⚠️ Minority</td><td>${report.stats.minority}</td></tr>
      <tr><td>👤 Single</td><td>${report.stats.single}</td></tr>
      <tr><td>⚔️ Disagreements</td><td>${report.stats.disagreements}</td></tr>
    </table>
  </div>

  ${
		report.highConfidence.length > 0
			? `
    <h2>🔥 High Confidence Findings (${report.thresholds.high * 100}%+ agreement)</h2>
    ${report.highConfidence.map(formatClusterHtml).join("")}
  `
			: ""
	}

  ${
		report.moderateConfidence.length > 0
			? `
    <h2>⚡ Moderate Confidence Findings (${report.thresholds.moderate * 100}%-${report.thresholds.high * 100}% agreement)</h2>
    ${report.moderateConfidence.map(formatClusterHtml).join("")}
  `
			: ""
	}

  ${
		report.lowConfidence.length > 0
			? `
    <h2>💭 Low Confidence Findings (&lt;${report.thresholds.moderate * 100}% agreement)</h2>
    ${report.lowConfidence.map(formatClusterHtml).join("")}
  `
			: ""
	}

  ${
		report.disagreements.length > 0
			? `
    <h2>⚔️ Disagreements Requiring Human Review</h2>
    ${report.disagreements.map(formatDisagreementHtml).join("")}
  `
			: ""
	}

  ${
		report.metadata
			? `
    <h2>Metadata</h2>
    <p><strong>Extraction Model:</strong> <code>${escapeHtml(report.metadata.extractionModel)}</code></p>
    <p><strong>Extraction Errors:</strong> ${report.metadata.extractionErrors}</p>
  `
			: ""
	}

  <footer>
    Report generated by code-council consensus analysis
  </footer>
</body>
</html>`;
}
