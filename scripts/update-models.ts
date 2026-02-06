#!/usr/bin/env bun
/**
 * Codegen script: fetches all available models from OpenRouter's public API
 * and regenerates the KnownModel type union in src/config/types.ts.
 *
 * Usage: bun scripts/update-models.ts
 */

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/models";
const TYPES_FILE = new URL("../src/config/types.ts", import.meta.url).pathname;
const START_MARKER = "// --- GENERATED:KnownModel:START ---";
const END_MARKER = "// --- GENERATED:KnownModel:END ---";

interface OpenRouterModel {
	id: string;
	architecture?: {
		output_modalities?: string[];
	};
}

interface OpenRouterResponse {
	data: OpenRouterModel[];
}

async function fetchModels(): Promise<string[]> {
	console.log(`Fetching models from ${OPENROUTER_API_URL}...`);
	const response = await fetch(OPENROUTER_API_URL);

	if (!response.ok) {
		throw new Error(
			`Failed to fetch models: ${response.status} ${response.statusText}`,
		);
	}

	const json = (await response.json()) as OpenRouterResponse;
	const models = json.data;
	console.log(`Fetched ${models.length} total models`);

	const filtered = models
		.filter((m) => {
			const outputModalities = m.architecture?.output_modalities ?? [];
			return outputModalities.includes("text");
		})
		.map((m) => m.id)
		.filter((id) => !/:free$/.test(id) && !/:extended$/.test(id));

	console.log(`${filtered.length} text-output models after filtering`);
	return filtered;
}

function groupByProvider(ids: string[]): Map<string, string[]> {
	const groups = new Map<string, string[]>();

	for (const id of ids) {
		const slashIdx = id.indexOf("/");
		const provider = slashIdx !== -1 ? id.slice(0, slashIdx) : id;
		const existing = groups.get(provider) ?? [];
		groups.set(provider, [...existing, id]);
	}

	// Sort providers alphabetically
	const sorted = new Map(
		[...groups.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([provider, modelIds]) => [provider, [...modelIds].sort()]),
	);

	return sorted;
}

function generateTypeUnion(groups: Map<string, string[]>): string {
	const timestamp = new Date().toISOString();
	const lines: string[] = [
		START_MARKER,
		"/**",
		" * Known OpenRouter model IDs for autocomplete.",
		" * This is not exhaustive - any valid OpenRouter model ID string will work.",
		" *",
		" * Find all models at: https://openrouter.ai/models",
		` * Auto-generated on ${timestamp} - run \`bun run update-models\` to regenerate.`,
		" */",
		"export type KnownModel =",
	];

	let isFirst = true;
	for (const [provider, ids] of groups) {
		lines.push(`\t// ${provider}`);
		for (const id of ids) {
			const prefix = isFirst ? "\t" : "\t|";
			lines.push(`${prefix} "${id}"`);
			isFirst = false;
		}
	}

	// Close the last line with a semicolon
	const lastIdx = lines.length - 1;
	const lastLine = lines[lastIdx];
	if (lastLine !== undefined) {
		lines[lastIdx] = `${lastLine};`;
	}

	lines.push(END_MARKER);
	return lines.join("\n");
}

async function main(): Promise<void> {
	const ids = await fetchModels();
	const groups = groupByProvider(ids);

	console.log(
		`Grouped into ${groups.size} providers: ${[...groups.keys()].join(", ")}`,
	);

	const typeUnion = generateTypeUnion(groups);

	const file = Bun.file(TYPES_FILE);
	const content = await file.text();

	const startIdx = content.indexOf(START_MARKER);
	const endIdx = content.indexOf(END_MARKER);

	if (startIdx === -1 || endIdx === -1) {
		throw new Error(
			`Could not find markers in ${TYPES_FILE}. Expected:\n  ${START_MARKER}\n  ${END_MARKER}`,
		);
	}

	const before = content.slice(0, startIdx);
	const after = content.slice(endIdx + END_MARKER.length);
	const updated = `${before}${typeUnion}${after}`;

	await Bun.write(TYPES_FILE, updated);
	console.log(`Updated ${TYPES_FILE}`);

	// Format with biome
	console.log("Formatting with biome...");
	const fmt = Bun.spawn(["bun", "run", "format"], {
		cwd: new URL("..", import.meta.url).pathname,
		stdout: "inherit",
		stderr: "inherit",
	});
	const exitCode = await fmt.exited;
	if (exitCode !== 0) {
		throw new Error(`Formatting failed with exit code ${exitCode}`);
	}

	console.log("Done!");
}

main().catch((err: unknown) => {
	console.error("Error:", err);
	process.exit(1);
});
