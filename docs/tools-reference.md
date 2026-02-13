# Tools Reference

Complete reference for all Code Council tools.

## review_code

Review code for quality, bugs, performance, and security issues.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | string | Yes | The code to review |
| `language` | string | No | Programming language (e.g., typescript, python) |
| `context` | string | No | Additional context about the code |
| `output_format` | string | No | `markdown` (default), `json`, or `html` |

### Example

```
Use review_code to check this TypeScript function:

function processUser(data: any) {
  const query = `SELECT * FROM users WHERE id = ${data.id}`;
  return db.execute(query);
}
```

### Sample Output

```markdown
## Consensus Analysis

### Unanimous Findings (High Confidence)

**Critical: SQL Injection Vulnerability**
- File: inline code, Line ~2
- All 4 models flagged this issue
- The user input is directly interpolated into the SQL query

**Recommendation:** Use parameterized queries instead.

### Majority Findings (Moderate Confidence)

**High: Missing Input Validation**
- 3 of 4 models flagged this
- The `data` parameter uses `any` type with no validation
```

---

## review_frontend

Review frontend code with focus on accessibility, performance, and UX.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | string | Yes | The frontend code to review |
| `framework` | string | No | Framework name (react, vue, svelte, angular) |
| `review_type` | string | No | `accessibility`, `performance`, `ux`, or `full` (default) |
| `context` | string | No | Additional context |
| `output_format` | string | No | `markdown` (default), `json`, or `html` |

### Example

```
Use review_frontend with review_type=accessibility to check this React component:

function Button({ onClick, label }) {
  return <div onClick={onClick}>{label}</div>;
}
```

### Review Types

- **accessibility** - WCAG compliance, screen reader support, keyboard navigation
- **performance** - Re-render optimization, bundle size, lazy loading
- **ux** - User experience patterns, interaction design
- **full** - All of the above (default)

---

## review_backend

Review backend code for security, performance, and architecture.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | string | Yes | The backend code to review |
| `language` | string | No | Language/framework (node, python, go, rust) |
| `review_type` | string | No | `security`, `performance`, `architecture`, or `full` (default) |
| `context` | string | No | Additional context |
| `output_format` | string | No | `markdown` (default), `json`, or `html` |

### Example

```
Use review_backend with review_type=security to analyze this API endpoint:

app.post('/api/users', (req, res) => {
  const { email, password } = req.body;
  db.query(`INSERT INTO users VALUES ('${email}', '${password}')`);
  res.json({ success: true });
});
```

### Review Types

- **security** - SQL injection, XSS, authentication, authorization
- **performance** - Query optimization, caching, connection pooling
- **architecture** - Design patterns, separation of concerns, scalability
- **full** - All of the above (default)

---

## review_plan

Review implementation plans BEFORE coding to catch issues early.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `plan` | string | Yes | The implementation plan to review |
| `review_type` | string | No | `feasibility`, `completeness`, `risks`, `timeline`, or `full` (default) |
| `context` | string | No | Project constraints or context |
| `output_format` | string | No | `markdown` (default), `json`, or `html` |

### Example

```
Use review_plan to analyze this implementation plan:

## User Authentication Feature

1. Add login/logout endpoints
2. Store passwords in the database
3. Use cookies for sessions
4. Deploy to production
```

### Review Types

- **feasibility** - Technical viability, resource requirements
- **completeness** - Missing steps, edge cases, error handling
- **risks** - Security concerns, scalability issues, technical debt
- **timeline** - Effort estimation, dependencies, blockers
- **full** - All of the above (default)

---

## review_git_changes

Review git changes directly from your repository.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `review_type` | string | No | `staged` (default), `unstaged`, `diff`, or `commit` |
| `commit_hash` | string | Conditional | Required when `review_type` is `commit` |
| `context` | string | No | Additional context about the changes |
| `output_format` | string | No | `markdown` (default), `json`, or `html` |

### Review Types

- **staged** - Review staged changes (`git diff --cached`)
- **unstaged** - Review unstaged changes (`git diff`)
- **diff** - Review branch diff (`git diff main..HEAD`)
- **commit** - Review a specific commit (requires `commit_hash`)

### Examples

```
Use review_git_changes to review my staged changes
```

```
Use review_git_changes with review_type=commit and commit_hash=abc123 to review that commit
```

```
Use review_git_changes with review_type=diff to review all changes on this branch
```

---

## discuss_with_council

Have multi-turn conversations with the AI council. Start a discussion, get feedback from all models, then ask follow-up questions while maintaining context.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | string | Yes | Your message or question for the council |
| `session_id` | string | No | Session ID to continue an existing discussion |
| `discussion_type` | string | No | `code_review`, `plan_review`, or `general` (default) |
| `context` | string | No | Additional context (code snippets, plan details, etc.) |

### Examples

**Start a new discussion:**
```
Use discuss_with_council to ask: What's the best way to implement error handling in a Node.js API?
```

**Continue a discussion:**
```
Use discuss_with_council with session_id=<id-from-previous-response> to ask: Can you elaborate on the circuit breaker pattern you mentioned?
```

### Features

- Each model maintains its own conversation history for authentic diverse perspectives
- Sessions persist for 30 minutes of inactivity
- Rate limited to 10 requests per minute per session
- Context windowing keeps conversations efficient

---

## tps_audit

Analyze any codebase using Toyota Production System (TPS) principles. Generates beautiful HTML reports with scores for flow, waste, bottlenecks, and quality.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | No | Path to repository root (auto-detects git root) |
| `focus_areas` | string[] | No | Specific areas to focus on |
| `max_files` | number | No | Maximum files to analyze (default: 50, max: 100) |
| `file_types` | string[] | No | File extensions to include |
| `include_sensitive` | boolean | No | Include potentially sensitive files (default: false) |
| `output_format` | string | No | `html` (default), `markdown`, or `json` |

### Focus Areas

- `flow` - How data and control flow through the system
- `waste` - The 7 wastes (muda): defects, overproduction, waiting, etc.
- `bottlenecks` - Where flow is constrained
- `quality` - Built-in quality patterns, error handling
- `security` - Security-specific analysis
- `performance` - Performance-specific analysis

### Examples

```
Use tps_audit to analyze this repository
```

```
Use tps_audit with output_format=markdown and focus_areas=["security", "performance"]
```

### What It Analyzes

- **Flow**: Entry points, data pathways, control flow patterns
- **Muda (Waste)**: Defects, overproduction, waiting, transportation, inventory, motion, extra-processing
- **Bottlenecks**: Constrained areas, severity and impact assessment
- **Jidoka**: Built-in quality, fail-fast patterns, error handling
- **Recommendations**: Prioritized improvements with effort/impact ratings

### Security Features

- Automatically skips sensitive files (`.env`, credentials, keys, tokens)
- Scans file contents for embedded secrets (AWS keys, GitHub PATs, etc.)
- Validates paths to prevent directory traversal attacks
- Enforces size limits to prevent resource exhaustion

### Output

Reports are saved to `.code-council/` directory:
- `tps-audit.html` - Interactive styled report with glass-morphism dark theme
- `tps-audit.md` - Markdown version
- `tps-audit.json` - Raw JSON data

---

## list_review_config

Show which AI models are currently configured for each review type.

### Parameters

None.

### Example

```
Use list_review_config to see my current model configuration
```

### Sample Output

```markdown
## Current Configuration

### Code Review Models
- minimax/minimax-m2.5
- z-ai/glm-4.7
- moonshotai/kimi-k2.5
- deepseek/deepseek-v3.2

### Frontend Review Models
(using defaults)

### Backend Review Models
(using defaults)

...
```

---

## init_config

Generate a Code Council configuration file with default values.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `location` | string | No | `directory` (default) or `root` |
| `format` | string | No | `typescript` (default) or `javascript` |
| `include_comments` | boolean | No | Include explanatory comments (default: true) |
| `force` | boolean | No | Overwrite existing config file (default: false) |

### Locations

- **directory** - Creates `.code-council/config.ts`
- **root** - Creates `code-council.config.ts` in project root

### Examples

```
Use init_config to generate a configuration file
```

```
Use init_config with location=root and format=javascript
```

---

## Output Formats

All review tools support three output formats:

### Markdown (default)

Human-readable format with headers, lists, and code blocks. Best for reading in chat interfaces.

### JSON

Structured data format for programmatic consumption:

```json
{
  "consensus": {
    "unanimous": [...],
    "majority": [...],
    "minority": [...],
    "single": [...]
  },
  "modelResults": [...],
  "metadata": {
    "modelsUsed": 4,
    "executionTimeMs": 2340
  }
}
```

### HTML

Styled report with interactive elements. Saved to `.code-council/` directory.
