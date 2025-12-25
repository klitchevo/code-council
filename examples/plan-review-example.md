# Plan Review Example

This example demonstrates using `review_plan` to catch issues BEFORE coding.

## Input Plan

```
Implementation Plan: User Authentication System

1. Create users table with username, password, email
2. Add registration endpoint that accepts username/password/email
3. Hash passwords with MD5
4. Store user in database
5. Create login endpoint
6. Return JWT token on successful login
7. Add middleware to check JWT on protected routes
8. Deploy to production

Timeline: 2 days
```

## Usage in Claude

```
Use review_plan to analyze this implementation plan:

[paste plan]
```

## Example Output

### Model: anthropic/claude-3.5-sonnet

**Plan Review: User Authentication System**

**🚨 CRITICAL ISSUES FOUND 🚨**

**Security Vulnerabilities:**

1. **MD5 for Password Hashing (CRITICAL)**
   - Line: "Hash passwords with MD5"
   - Issue: MD5 is cryptographically broken and NOT suitable for passwords
   - Risk: Passwords can be cracked in seconds using rainbow tables
   - Fix: Use bcrypt, argon2, or scrypt with proper salt
   - Impact: **Complete security failure** - this alone makes the system unsafe

2. **No Rate Limiting**
   - Missing from plan
   - Risk: Brute force attacks on login endpoint
   - Fix: Add rate limiting to authentication endpoints

3. **No Input Validation**
   - Plan doesn't mention validation
   - Risk: SQL injection, XSS, invalid data
   - Fix: Add comprehensive input validation

4. **No HTTPS Mentioned**
   - Risk: Credentials sent in plaintext
   - Fix: Enforce HTTPS in production

**Missing Critical Components:**

1. **Email Verification**
   - No plan for verifying email addresses
   - Risk: Fake accounts, spam
   - Add: Email verification workflow

2. **Password Reset Flow**
   - Not included in plan
   - Users will get locked out
   - Add: Forgot password functionality

3. **Session Management**
   - JWT mentioned but no refresh token strategy
   - No logout mechanism
   - No token expiration strategy
   - Add: Refresh token rotation, logout endpoint

4. **Account Security**
   - No password strength requirements
   - No account lockout after failed attempts
   - No 2FA support
   - Add: Password policy, account lockout, optional 2FA

**Database Issues:**

1. **No Indexes**
   - Plan doesn't mention indexing
   - Impact: Slow lookups on username/email
   - Add: Unique indexes on username and email

2. **No Unique Constraints**
   - Could allow duplicate usernames/emails
   - Add: Database constraints

3. **No Migration Strategy**
   - How will schema be versioned?
   - Add: Migration tool (e.g., Knex, TypeORM migrations)

**Testing Gaps:**

1. **No Testing Mentioned**
   - No unit tests
   - No integration tests
   - No security testing
   - Add: Comprehensive test suite

**Deployment Issues:**

1. **No Environment Configuration**
   - Where are secrets stored?
   - How are environment variables managed?
   - Add: Secrets management strategy

2. **No Monitoring**
   - How will you detect attacks?
   - How will you monitor performance?
   - Add: Logging and monitoring

3. **No Rollback Plan**
   - What if deployment fails?
   - Add: Rollback strategy

**Timeline Issues:**

- **2 days is UNREALISTIC** for a secure authentication system
- With all necessary components: 1-2 weeks minimum
- Consider using an established solution like Auth0, Clerk, or Supabase Auth

**Risk Assessment:**

| Category | Risk Level | Reason |
|----------|------------|---------|
| Security | CRITICAL | MD5 hashing, missing security controls |
| Completeness | HIGH | Many essential features missing |
| Timeline | HIGH | Significantly underestimated |
| Maintainability | MEDIUM | No testing or monitoring plan |

**Recommendation: DO NOT PROCEED** with current plan

**Revised Plan:**

```
Implementation Plan: User Authentication System (Revised)

Phase 1: Database Setup (Day 1)
- Create users table with proper indexes
- Fields: id, username, email, password_hash, email_verified, created_at, updated_at
- Add unique constraints on username and email
- Set up database migrations

Phase 2: Registration (Days 2-3)
- Input validation (email format, password strength)
- Hash passwords with bcrypt (cost factor 12)
- Email verification workflow
- Rate limiting on registration endpoint
- Unit and integration tests

Phase 3: Login (Days 4-5)
- Login endpoint with rate limiting
- Account lockout after 5 failed attempts
- JWT access token (15 min expiry) + refresh token (7 days)
- Secure HTTP-only cookies for tokens
- Tests for authentication flow

Phase 4: Session Management (Day 6)
- Logout endpoint (blacklist refresh token)
- Refresh token rotation
- Token validation middleware
- Session cleanup job

Phase 5: Password Reset (Days 7-8)
- Forgot password endpoint
- Password reset token generation (1 hour expiry)
- Reset password endpoint
- Email notification

Phase 6: Security Hardening (Days 9-10)
- HTTPS enforcement
- CORS configuration
- Security headers (helmet.js)
- SQL injection prevention audit
- XSS prevention audit
- CSRF protection

Phase 7: Monitoring & Deployment (Days 11-12)
- Logging (authentication events, errors)
- Monitoring dashboard
- Alerts for suspicious activity
- Staging deployment
- Security review
- Production deployment with rollback plan

Timeline: 12 days (2.5 weeks)

Consider Instead: Auth0, Clerk, or Supabase Auth for production use
```

### Model: openai/gpt-4-turbo

**Plan Feasibility Analysis**

**Major Concerns:**

1. **Security: CRITICAL FLAW**
   - MD5 is NOT a password hashing algorithm
   - This is a fundamental security mistake
   - Status: **SHOW STOPPER**

2. **Completeness: 40%**
   - Missing: Email verification, password reset, refresh tokens, testing
   - Current plan covers only basic happy path

3. **Timeline: UNREALISTIC**
   - 2 days for auth system is impossible
   - Realistic timeline: 2-3 weeks including testing
   - You're underestimating by 500%

**What's Missing:**

- [ ] Input validation and sanitization
- [ ] Rate limiting and brute force protection
- [ ] Email verification
- [ ] Password reset flow
- [ ] Refresh token strategy
- [ ] Logout functionality
- [ ] Session management
- [ ] Security testing
- [ ] Integration tests
- [ ] Documentation
- [ ] Error handling

**Recommendation:**

Either:
1. Extend timeline to 3 weeks and add missing components
2. Use an existing auth service (Clerk, Auth0, Supabase)

**Verdict:** ❌ Plan needs major revision before implementation

### Model: google/gemini-pro

**Plan Review - Risk Analysis**

**Critical Risks:**

1. **Technical Debt Risk: HIGH**
   - MD5 hashing will need immediate replacement
   - This creates technical debt before launch
   - Will require password reset for all users when fixed

2. **Security Risk: CRITICAL**
   - System vulnerable to multiple attack vectors
   - Likelihood of breach: HIGH
   - Impact: Data loss, reputation damage, legal liability

3. **Timeline Risk: HIGH**
   - Plan missing 60% of required features
   - 2 day estimate ignores testing and security
   - Actual effort: 10-15 days

4. **Maintenance Risk: MEDIUM**
   - No monitoring means issues won't be detected
   - No logging means debugging will be difficult

**Alternatives to Consider:**

1. **Supabase Auth** (Recommended)
   - Free tier available
   - Production-ready in 1 day
   - All security features included

2. **Clerk**
   - Excellent DX
   - Built-in UI components
   - Setup time: 2-3 hours

3. **Auth0**
   - Enterprise-grade
   - Extensive documentation
   - Free tier: 7,000 users

**Decision Framework:**

Build custom auth if:
- ✓ You have specific compliance requirements
- ✓ You need complete control over data
- ✓ You have security expertise on team
- ✓ You have 2-3 weeks to build it properly

Use auth service if:
- ✓ You want to launch quickly
- ✓ You don't have auth expertise
- ✓ You want proven security
- ✓ You want to focus on core features

**Verdict:** Use an auth service unless you have compelling reasons not to.

---

## Summary

Plan reviews help you:

1. **Catch security issues** before writing vulnerable code
2. **Identify missing components** that would cause problems later
3. **Get realistic timelines** instead of optimistic estimates
4. **Consider alternatives** like third-party services
5. **Avoid technical debt** by planning properly upfront

Different review types:
- **Feasibility**: Is the plan achievable?
- **Completeness**: What's missing?
- **Risks**: What could go wrong?
- **Timeline**: Is the estimate realistic?
- **Full**: All of the above

**Best Practice:** Always review implementation plans BEFORE coding, especially for security-critical features like authentication.
