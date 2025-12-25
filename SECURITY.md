# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please follow these steps:

### 1. **Do Not** Open a Public Issue

Security vulnerabilities should not be reported through public GitHub issues.

### 2. Report Privately

Email security details to: **YOUR_EMAIL@example.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### 3. Response Timeline

- **24 hours**: Initial response acknowledging receipt
- **7 days**: Assessment and proposed timeline for fix
- **30 days**: Target for releasing a fix (varies by severity)

## Security Best Practices

### API Key Security

**Critical**: Never commit your `OPENROUTER_API_KEY` to version control.

✅ **DO**:
- Store API keys in environment variables
- Use the `env` section in MCP client configurations
- Keep `.env` files in `.gitignore`
- Rotate API keys periodically

❌ **DON'T**:
- Hardcode API keys in source code
- Commit `.env` files
- Share API keys in public forums
- Use the same key across multiple projects

### Input Validation

While this package validates inputs using Zod schemas, remember:
- Users control their own API costs
- The package is a wrapper, not a security boundary
- Input validation prevents crashes, not abuse
- Rate limiting is handled by OpenRouter

### Dependencies

We monitor dependencies for security vulnerabilities:

```bash
npm audit
```

Run this regularly and update dependencies when security patches are available.

### MCP Client Security

When configuring MCP clients:

**Secure** (Recommended):
```json
{
  "mcpServers": {
    "openrouter-review": {
      "command": "npx",
      "args": ["-y", "openrouter-review-mcp"],
      "env": {
        "OPENROUTER_API_KEY": "sk-or-v1-..."
      }
    }
  }
}
```

**Insecure** (Never do this):
```json
{
  "mcpServers": {
    "openrouter-review": {
      "command": "npx",
      "args": ["-y", "openrouter-review-mcp", "--api-key=sk-or-v1-..."]
    }
  }
}
```

### Environment Files

- `.env` files should **never** be committed
- Use `.env.example` for templates
- Verify `.gitignore` includes `.env`

### npm Publishing

Before publishing:

```bash
# Verify no secrets in package
npm pack --dry-run
tar -tzf openrouter-review-mcp-*.tgz

# Check for sensitive data
grep -r "sk-or-v1" . --exclude-dir=node_modules
```

## Known Security Considerations

### 1. API Key Exposure

- **Risk**: API keys could be leaked through logs, error messages, or version control
- **Mitigation**:
  - Never log API keys
  - Sanitize error messages
  - Keep `.env` in `.gitignore`
  - Use environment variables in MCP configs

### 2. Code Injection

- **Risk**: User-provided code is sent to LLMs
- **Impact**: Users control the code they review - this is intentional
- **Mitigation**: Users pay for their own API usage

### 3. Dependency Vulnerabilities

- **Risk**: Vulnerable dependencies could be exploited
- **Mitigation**:
  - Run `npm audit` regularly
  - Keep dependencies updated
  - Monitor GitHub security alerts

### 4. Rate Limiting

- **Risk**: Excessive API calls could incur unexpected costs
- **Impact**: Users control their usage
- **Mitigation**: OpenRouter handles rate limiting server-side

## Security Updates

Security updates will be released as patch versions and announced via:
- GitHub Security Advisories
- Release notes
- CHANGELOG.md

## Acknowledgments

We appreciate security researchers who responsibly disclose vulnerabilities. Contributors will be acknowledged in release notes (unless they prefer to remain anonymous).

## Contact

For security concerns: **YOUR_EMAIL@example.com**

For general questions: Open a GitHub issue
