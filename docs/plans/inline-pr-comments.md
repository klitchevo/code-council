# Inline PR Comments for Code Council

## Goal

Add inline PR comment support to Code Council so findings appear on specific lines in GitHub PRs, not just as a single review body.

## Architecture

```
Existing Pipeline:
  git diff → ReviewClient → consensus/builder → FindingCluster[] (with canonicalLocation)

New Components:
  diff-parser.ts       → Parse unified diff, track changed lines per file
  comment-mapper.ts    → Map FindingCluster locations to diff line positions
  pr-comment-formatter.ts → Format as GitHub API JSON structure
```

## Data Flow

```
1. getGitDiff() returns unified diff text
2. parseUnifiedDiff() → DiffFile[] with changed line sets per file
3. buildConsensus() → FindingCluster[] with canonicalLocation
4. mapClustersToComments() → Filter to only findings on changed lines
5. formatPrComments() → GitHubPrReview JSON for API
6. CLI outputs JSON → workflow posts via gh api
```

## Implementation

### Phase 1: Diff Parser

**Create `src/utils/diff-parser.ts`**

```typescript
export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
}

export interface DiffFile {
  oldPath: string;
  newPath: string;
  hunks: DiffHunk[];
  changedLines: Set<number>;  // Lines added/modified in new file
}

export interface ParsedDiff {
  files: DiffFile[];
}

export function parseUnifiedDiff(diffText: string): ParsedDiff;
export function getChangedLinesForFile(diff: ParsedDiff, filePath: string): Set<number> | undefined;
```

Parse unified diff format:
- Split by `diff --git` markers
- Extract paths from `--- a/` and `+++ b/` lines
- Parse hunks from `@@ -old,count +new,count @@`
- Track line numbers: additions go in `changedLines` set

### Phase 2: Comment Mapper

**Create `src/consensus/comment-mapper.ts`**

```typescript
export interface MappedComment {
  cluster: FindingCluster;
  path: string;
  line: number;
}

export interface MappingResult {
  comments: MappedComment[];
  unmapped: FindingCluster[];  // No location or not on changed line
}

export function mapClustersToComments(
  clusters: FindingCluster[],
  diff: ParsedDiff
): MappingResult;
```

Logic:
1. For each cluster with `canonicalLocation`:
   - Find matching DiffFile (normalize paths)
   - Check if `location.line` is in `changedLines`
   - If yes → add to `comments`
   - If no → add to `unmapped`
2. Clusters without location → `unmapped`

### Phase 3: PR Comment Formatter

**Create `src/consensus/pr-comment-formatter.ts`**

```typescript
export interface GitHubPrComment {
  path: string;
  line: number;
  body: string;
}

export interface GitHubPrReview {
  body: string;           // Summary + unmapped findings
  event: "COMMENT";
  comments: GitHubPrComment[];
}

export function formatPrComments(
  report: ConsensusReport,
  mappingResult: MappingResult
): GitHubPrReview;
```

Comment body format:
```markdown
**[SEVERITY] Title** (Category)

X/Y models agree • Confidence: XX%

Description

**Suggestion:** Fix recommendation
```

### Phase 4: Integration

**Modify `src/consensus/types.ts:77`**
```typescript
// Add "pr-comments" to OUTPUT_FORMATS
export const OUTPUT_FORMATS = ["markdown", "json", "html", "pr-comments"] as const;
```

**Modify `src/consensus/formatter.ts:16-29`**
```typescript
export function formatReport(
  report: ConsensusReport,
  format: OutputFormat = "markdown",
  diffText?: string,  // New parameter for pr-comments
): string {
  switch (format) {
    case "pr-comments":
      return formatPrCommentsOutput(report, diffText);
    // ... existing cases
  }
}
```

**Modify `src/tools/review-git.ts:84-115`**
```typescript
// Return diffText in result for pr-comments format
export async function handleGitReview(...): Promise<{
  results: ...;
  models: string[];
  reviewType: string;
  diffText: string;  // Add this
}> {
  const diff = getGitDiff(reviewType, input.commit_hash);
  // ...
  return { results, models, reviewType, diffText: diff };
}
```

**Modify `src/cli/types.ts`**
```typescript
export type OutputFormat = "markdown" | "json" | "html" | "pr-comments";
```

**Modify `src/cli/commands/review.ts`**
- Pass `diffText` through to `formatReviewOutput`
- Handle `pr-comments` format in git review handler

### Phase 5: Workflow Update

**Modify `.github/workflows/code-council-review.yml`**

```yaml
- name: Run Code Council Review
  env:
    OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
  run: |
    npx @klitchevo/code-council review git \
      --review-type diff \
      --format pr-comments \
      > review.json

- name: Post Inline Review
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    gh api repos/${{ github.repository }}/pulls/${{ github.event.pull_request.number }}/reviews \
      --method POST \
      --input review.json
```

## Files Summary

| Action | File |
|--------|------|
| Create | `src/utils/diff-parser.ts` |
| Create | `src/utils/diff-parser.test.ts` |
| Create | `src/consensus/comment-mapper.ts` |
| Create | `src/consensus/comment-mapper.test.ts` |
| Create | `src/consensus/pr-comment-formatter.ts` |
| Create | `src/consensus/pr-comment-formatter.test.ts` |
| Modify | `src/consensus/types.ts` - add `pr-comments` format |
| Modify | `src/consensus/formatter.ts` - route to new formatter |
| Modify | `src/tools/review-git.ts` - return diffText |
| Modify | `src/cli/types.ts` - add OutputFormat |
| Modify | `src/cli/commands/review.ts` - handle pr-comments |
| Modify | `.github/workflows/code-council-review.yml` |

## Edge Cases

1. **Findings not on changed lines** → Include in summary body, not inline
2. **No location in finding** → Include in summary body
3. **Path mismatches** → Normalize paths (strip `./`, handle `src/` prefix)
4. **Empty diff** → Return empty comments with summary only
5. **Multi-line findings** → Use start line for comment position

## Verification

1. **Unit tests** for each new module:
   - `diff-parser.test.ts` - Parse various diff formats
   - `comment-mapper.test.ts` - Mapping logic, path normalization
   - `pr-comment-formatter.test.ts` - Output JSON structure

2. **Integration test**:
   ```bash
   # Create test changes
   echo "test" >> test-file.ts
   git add test-file.ts

   # Run with pr-comments format
   npx @klitchevo/code-council review git --format pr-comments

   # Verify JSON output matches GitHub API schema
   ```

3. **Manual PR test**:
   - Create test branch with intentional issues
   - Open PR, run workflow
   - Verify inline comments appear on correct lines
