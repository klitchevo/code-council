# Backend Review Example

This example shows backend security and architecture review.

## Input Code

```javascript
const express = require('express');
const app = express();

app.post('/api/users/:id/delete', (req, res) => {
  const userId = req.params.id;
  const query = `DELETE FROM users WHERE id = ${userId}`;

  db.execute(query, (err, result) => {
    if (err) {
      res.status(500).send('Error');
    } else {
      res.send('User deleted');
    }
  });
});
```

## Usage in Claude

### Security-Focused Review

```
Use review_backend with review_type=security to analyze this API endpoint:

[paste code]
```

## Example Output (Security Review)

### Model: anthropic/claude-3.5-sonnet

**🚨 CRITICAL SECURITY VULNERABILITIES 🚨**

1. **SQL Injection (CRITICAL - CWE-89)**
   - Line: `` `DELETE FROM users WHERE id = ${userId}` ``
   - Severity: **10/10 CVSS**
   - Impact: Attacker can execute arbitrary SQL commands
   - Example attack: `/api/users/1 OR 1=1--/delete` would delete ALL users
   - Fix: Use parameterized queries immediately

2. **Missing Authentication**
   - No authentication check before deletion
   - Anyone can delete any user
   - Fix: Add authentication middleware

3. **Missing Authorization**
   - No check if requesting user can delete this specific user
   - Fix: Verify user permissions

4. **Using POST instead of DELETE**
   - Violates REST conventions
   - Can cause CSRF issues
   - Fix: Use DELETE method

5. **Insufficient Error Handling**
   - Exposing error details could leak information
   - Fix: Return generic error messages to client

6. **No Input Validation**
   - userId not validated
   - Could be non-numeric, causing database errors
   - Fix: Validate input format

7. **No Rate Limiting**
   - Endpoint vulnerable to DoS
   - Fix: Add rate limiting middleware

**OWASP Top 10 Violations:**
- ✗ A01:2021 - Broken Access Control
- ✗ A03:2021 - Injection (SQL Injection)
- ✗ A04:2021 - Insecure Design
- ✗ A05:2021 - Security Misconfiguration

**Security Score: 0/100** - DO NOT DEPLOY

**Secure Implementation:**

```javascript
const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, param } = require('express-validator');

const app = express();

// Rate limiting
const deleteLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // limit each IP to 5 delete requests per windowMs
});

app.delete('/api/users/:id',
  authenticate,           // Verify user is logged in
  deleteLimit,           // Rate limiting
  param('id').isInt(),   // Validate ID is integer
  async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const requestingUserId = req.user.id;

      // Authorization check
      if (requestingUserId !== userId && !req.user.isAdmin) {
        return res.status(403).json({
          error: 'Forbidden: You can only delete your own account'
        });
      }

      // Parameterized query prevents SQL injection
      const query = 'DELETE FROM users WHERE id = ?';
      const result = await db.execute(query, [userId]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Audit log
      await auditLog.log({
        action: 'USER_DELETED',
        userId: userId,
        performedBy: requestingUserId,
        timestamp: new Date()
      });

      res.status(204).send(); // 204 No Content for successful deletion
    } catch (err) {
      logger.error('Error deleting user:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);
```

### Model: openai/gpt-4-turbo

**Security Assessment**

**Vulnerability Summary:**

| Severity | Issue | Line | OWASP Category |
|----------|-------|------|----------------|
| CRITICAL | SQL Injection | 5 | A03:2021 |
| CRITICAL | Missing Authentication | All | A01:2021 |
| HIGH | Missing Authorization | All | A01:2021 |
| MEDIUM | Improper Error Handling | 8-12 | A04:2021 |
| LOW | Wrong HTTP Method | 3 | Best Practice |

**Attack Scenarios:**

1. **SQL Injection Example:**
   ```
   POST /api/users/1; DROP TABLE users;--/delete
   Result: Entire users table deleted
   ```

2. **Unauthorized Deletion:**
   ```
   Any unauthenticated user can delete any account
   POST /api/users/123/delete
   ```

**Immediate Actions Required:**
1. Take endpoint offline immediately
2. Implement parameterized queries
3. Add authentication middleware
4. Add authorization checks
5. Change to DELETE method
6. Add comprehensive logging

**Risk Level: CRITICAL** - Production deployment would result in data breach

### Model: google/gemini-pro

**Security Review - Backend API**

**Critical Vulnerabilities:**

1. **SQL Injection (CVE-2023-XXXX type)**
   - String interpolation in SQL query
   - Attack vector: Path parameter manipulation
   - Mitigation: Prepared statements required

2. **No AuthN/AuthZ**
   - Public endpoint for destructive action
   - Violates principle of least privilege
   - Add JWT or session validation

3. **Information Disclosure**
   - Generic error messages expose database errors
   - Stack traces could leak in development mode

**Additional Issues:**
- No CORS configuration shown
- No request logging
- No transaction handling (what if delete fails midway?)
- No soft delete option (permanent data loss)

**Recommendation:** Complete rewrite required before production use.

---

## Example Output (Architecture Review)

### Model: anthropic/claude-3.5-sonnet

**Architecture Assessment:**

**Current Issues:**

1. **No Separation of Concerns**
   - Database logic mixed with HTTP handling
   - Fix: Use service/repository pattern

2. **No Error Handling Strategy**
   - Errors handled inconsistently
   - Fix: Centralized error handling middleware

3. **Direct Database Access**
   - Controller directly accesses database
   - Fix: Introduce data access layer

4. **No Transaction Management**
   - Deletion could fail partially
   - Fix: Use database transactions

**Recommended Architecture:**

```
┌─────────────┐
│   Router    │  HTTP layer
└──────┬──────┘
       │
┌──────▼──────┐
│ Controller  │  Request validation, response formatting
└──────┬──────┘
       │
┌──────▼──────┐
│  Service    │  Business logic
└──────┬──────┘
       │
┌──────▼──────┐
│ Repository  │  Data access
└─────────────┘
```

**Better Implementation:**

```javascript
// routes/users.js
router.delete('/api/users/:id',
  authenticate,
  asyncHandler(userController.deleteUser)
);

// controllers/userController.js
class UserController {
  async deleteUser(req, res) {
    const userId = parseInt(req.params.id);
    const requestingUser = req.user;

    await userService.deleteUser(userId, requestingUser);
    res.status(204).send();
  }
}

// services/userService.js
class UserService {
  async deleteUser(userId, requestingUser) {
    // Authorization
    if (!this.canDelete(userId, requestingUser)) {
      throw new ForbiddenError('Cannot delete this user');
    }

    // Business logic
    await this.userRepository.delete(userId);
    await this.auditService.logDeletion(userId, requestingUser.id);
  }

  canDelete(userId, requestingUser) {
    return requestingUser.id === userId || requestingUser.isAdmin;
  }
}

// repositories/userRepository.js
class UserRepository {
  async delete(userId) {
    const query = 'DELETE FROM users WHERE id = ?';
    const result = await db.execute(query, [userId]);

    if (result.affectedRows === 0) {
      throw new NotFoundError('User not found');
    }

    return result;
  }
}
```

**Benefits:**
- Testable: Each layer can be unit tested
- Maintainable: Clear separation of responsibilities
- Reusable: Service logic can be used by multiple controllers
- Secure: Security checks centralized in service layer

---

## Summary

Backend reviews focus on:

- **Security**: SQL injection, authentication, authorization, input validation
- **Architecture**: Separation of concerns, layered architecture, maintainability
- **Performance**: Query optimization, caching, connection pooling
- **Full**: Comprehensive analysis of all aspects

The original code had critical security vulnerabilities that would result in immediate data breaches if deployed to production.
