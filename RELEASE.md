# Release v0.1.0

## TPS Audit: Multi-Model Council Architecture

This release significantly enhances the TPS (Toyota Production System) audit tool with a true council architecture where **all models analyze all code**, then synthesize their findings into a unified report.

### New Features

#### Multi-Model Council Analysis
- **All models see all code**: Each configured model now analyzes the entire codebase (in batches), then synthesizes their batch findings into a comprehensive analysis
- **Smart batching**: Large codebases are automatically split into ~60K token batches to stay within model context limits
- **Parallel processing**: All models analyze batches concurrently for faster results
- **Synthesis step**: Each model produces a final synthesized report from their batch analyses

#### Priority File Scanning
- **`.claude/` directory support**: Claude Code project configuration files are now scanned first as they contain critical project context
- **`.beads/` directory support**: Issue tracking files are prioritized
- **Priority root files**: `CLAUDE.md`, `README.md`, `package.json`, `tsconfig.json`, `pyproject.toml`, `Cargo.toml`, `go.mod` are scanned first
- **Config file support**: Added `.json`, `.yaml`, `.yml`, `.toml`, `.md` to default file types

#### Rich HTML Report Formatting
- **Smart formatters**: Entry points, pathways, quick wins, and other list items now render as beautifully formatted HTML instead of raw JSON
- **Flexible data handling**: Template handles both string and object formats from different model responses
- **Field name normalization**: Handles varied model output formats (`action`/`change`/`title`, `path`/`file`, `from`/`to`/`steps`, etc.)

#### Improved JSON Parser
- **Flexible parsing**: Models return varied JSON structures; parser now normalizes all formats to a consistent `TpsAnalysis` structure
- **No more stringification**: Objects are passed through to the template as-is for rich formatting
- **Graceful degradation**: Parser fills defaults for missing fields instead of failing

### Breaking Changes

None - this is a backwards-compatible enhancement.

### Technical Details

- **Files changed**: 7 files, +914/-49 lines
- **Test coverage**: All 240 tests passing
- **API calls per audit**: `(batches × models) + models` (e.g., 3 batches × 4 models + 4 synthesis = 16 calls)

### Example Output

```
📊 Scan Results:
  - Files analyzed: 180
  - Token estimate: 127,373
  - Skipped files: 665

📈 TPS Scores:
  - Overall: 66/100
  - Flow: 62/100
  - Waste: 68/100
  - Quality: 70/100
```

Reports are saved to `.code-council/tps-audit.html` with:
- Glass-morphism dark theme
- Animated score gauges
- Collapsible sections for bottlenecks and recommendations
- Tabbed model perspectives
- Properly formatted entry points, pathways, and quick wins

### Upgrade

```bash
npx @klitchevo/code-council@latest
```

Or update your MCP config to use the latest version.
