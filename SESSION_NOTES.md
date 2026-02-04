# Code Council Review Session Notes

## Current State (2026-02-03)

Branch: `test/shitty-code-fresh-2`
PR: #5 (open)

## What We Fixed

### 1. Consensus Output (Previously Raw Reviews)
- **Problem**: Markdown format was dumping raw model reviews instead of synthesized consensus
- **Fix**: `formatReviewOutput` now builds actual consensus report via `buildConsensusReport()`
- **File**: `src/cli/commands/review.ts`

### 2. Inline Comment Mapping (Only 1 Comment)
- **Problem**: Comments only mapped to exact changed lines, most went to summary
- **Fix**: Now maps to nearby changed lines (within 20 lines) and uses first changed line for file-only findings
- **File**: `src/consensus/comment-mapper.ts`

### 3. Extraction Failures (4/6 Models Failed)
- **Problem**: Extraction failed for most models due to:
  - Missing `rawExcerpt` field (ZodError)
  - Malformed JSON (bad escapes like `\'`)
  - Unescaped control characters
- **Fixes**:
  - Made `rawExcerpt` optional with default empty string (`src/schemas/consensus.ts`)
  - Added JSON repair for `\'`, `` \` ``, and control characters (`src/consensus/extractor.ts`)

### 4. Clustering Improvements (Earlier in Session)
- Two-phase clustering: file+category+issue-type grouping, then similarity
- Keyword-based issue type matching (SQL injection, XSS, etc.)
- "Best match OR average threshold" merge logic
- **File**: `src/consensus/clustering.ts`

## What's Still Broken / TODO

### 1. Not All Issues Found in user-service.ts
The test file has ~10 obvious vulnerabilities but only a few show up:
- SQL injection
- XSS
- Command injection
- Hardcoded secrets (API_KEY, DB_PASSWORD)
- Insecure randomness (Math.random for tokens)
- Race condition
- Missing return statement
- etc.

**Possible causes**:
- Models might not be reporting all issues
- Extraction model (Haiku) might be missing some when parsing
- Clustering might be over-merging

### 2. Low Model Agreement (1/6 models)
Most findings show "1/6 models | Confidence: 17%"
- Models describe same issues differently
- Titles/descriptions vary too much to cluster
- May need semantic similarity (embeddings) instead of keyword matching

### 3. Summary Section Still Exists
User wants ALL findings inline, no summary section
- Current: Findings without location go to summary
- Need: Force all findings to attach to some line in the file

## Key Files

| File | Purpose |
|------|---------|
| `src/consensus/clustering.ts` | Similarity scoring, keyword matching, cluster merging |
| `src/consensus/comment-mapper.ts` | Maps findings to PR comment positions |
| `src/consensus/extractor.ts` | Parses model reviews into structured findings |
| `src/schemas/consensus.ts` | Zod schemas for extraction validation |
| `src/cli/commands/review.ts` | CLI handler, output formatting |
| `src/utils/user-service.ts` | Intentionally bad test file (excluded from tsc) |

## Workflow Logs to Check

```bash
gh run view <run-id> --log 2>&1 | grep -i "finding"
gh run view <run-id> --log 2>&1 | grep -i "extraction"
```

## Next Steps

1. **Run new workflow** - Check if fixes improved inline comments
2. **Debug extraction** - See what findings each model actually returns
3. **Improve clustering** - Consider:
   - Semantic similarity with embeddings
   - More aggressive same-file clustering
   - Better keyword list
4. **Force inline comments** - Remove summary section entirely, attach everything to nearest line

## Commands to Resume

```bash
cd /home/pho7on/Work/code-council
git checkout test/shitty-code-fresh-2
gh pr view 5
gh run list --branch test/shitty-code-fresh-2 --limit 3
```
