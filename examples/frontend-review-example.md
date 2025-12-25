# Frontend Review Example

This example demonstrates using `review_frontend` with different review types.

## Input Code

```tsx
import React from 'react';

function UserProfile({ user }) {
  return (
    <div className="profile">
      <img src={user.avatar} />
      <h1>{user.name}</h1>
      <button onClick={() => deleteUser(user.id)}>Delete</button>
    </div>
  );
}
```

## Usage in Claude

### Full Review

```
Use review_frontend to check this React component:

[paste component code]
```

### Accessibility-Focused Review

```
Use review_frontend with review_type=accessibility to check this React component:

[paste component code]
```

## Example Output (Accessibility Review)

### Model: anthropic/claude-3.5-sonnet

**Accessibility Issues:**

1. **Critical: Missing alt text on image**
   - `<img src={user.avatar} />` has no alt attribute
   - Impact: Screen readers cannot describe the image
   - Fix: `<img src={user.avatar} alt={`${user.name}'s profile picture`} />`

2. **Critical: Button needs confirmation for destructive action**
   - Deleting a user is irreversible but has no confirmation
   - Impact: Users could accidentally delete their account
   - Fix: Add confirmation dialog or two-step deletion

3. **Missing ARIA labels**
   - Container div has no semantic meaning
   - Fix: Consider using `<article>` or add `role="region"` with `aria-label`

4. **No keyboard navigation indicators**
   - Button should show focus state for keyboard users
   - Fix: Ensure focus styles are visible

**WCAG Compliance:**
- ❌ WCAG 2.1 Level A: Fails (missing alt text)
- ❌ WCAG 2.1 Level AA: Fails (multiple issues)

**Recommended Fix:**

```tsx
import React, { useState } from 'react';

function UserProfile({ user, onDelete }) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = () => {
    if (showConfirm) {
      onDelete(user.id);
    } else {
      setShowConfirm(true);
    }
  };

  return (
    <article
      className="profile"
      aria-label={`${user.name}'s profile`}
    >
      <img
        src={user.avatar}
        alt={`${user.name}'s profile picture`}
      />
      <h1>{user.name}</h1>
      <button
        onClick={handleDelete}
        aria-label={showConfirm ? "Confirm deletion" : "Delete account"}
        className={showConfirm ? "btn-danger" : "btn-default"}
      >
        {showConfirm ? "Click again to confirm" : "Delete"}
      </button>
    </article>
  );
}
```

### Model: openai/gpt-4-turbo

**Accessibility Audit:**

**Missing Elements:**
- Alt text on profile image (WCAG 1.1.1)
- Semantic HTML structure
- ARIA labels for context

**User Experience Issues:**
- No loading state for image
- Destructive action without confirmation
- No error handling for missing user data

**Score: 3/10** - Needs significant accessibility improvements

### Model: google/gemini-pro

**Accessibility Review:**

**Critical:**
1. Image missing alt attribute - fails WCAG A
2. No confirmation for destructive action

**Warnings:**
1. Using non-semantic div wrapper
2. No focus management
3. TypeScript props not typed (accessibility via type safety)

**Recommendations:**
- Add alt text
- Use semantic HTML (`<article>`, `<figure>`)
- Add confirmation modal
- Type the props interface

---

## Example Output (Performance Review)

### Model: anthropic/claude-3.5-sonnet

**Performance Issues:**

1. **Inline Function Creation**
   - `onClick={() => deleteUser(user.id)}` creates new function on every render
   - Impact: Unnecessary re-renders if wrapped in memo
   - Fix: Use useCallback or bind in parent

2. **Missing Image Optimization**
   - No lazy loading
   - No responsive image sizes
   - No loading placeholder
   - Fix: Use Next.js Image component or add loading="lazy"

3. **No Error Boundary**
   - If user data is missing, entire component crashes
   - Fix: Add error boundary or null checks

**Bundle Impact:** Low - component is small

**Rendering Performance:**
- Initial render: Fast
- Re-render frequency: Depends on parent
- Recommendation: Wrap in React.memo if user data changes infrequently

**Optimized Version:**

```tsx
import React, { useCallback } from 'react';

interface User {
  id: string;
  name: string;
  avatar: string;
}

interface Props {
  user: User;
  onDeleteUser: (id: string) => void;
}

const UserProfile = React.memo(({ user, onDeleteUser }: Props) => {
  const handleDelete = useCallback(() => {
    onDeleteUser(user.id);
  }, [user.id, onDeleteUser]);

  return (
    <div className="profile">
      <img
        src={user.avatar}
        alt={`${user.name}'s avatar`}
        loading="lazy"
      />
      <h1>{user.name}</h1>
      <button onClick={handleDelete}>Delete</button>
    </div>
  );
});

UserProfile.displayName = 'UserProfile';

export default UserProfile;
```

---

## Summary

Different review types provide focused feedback:

- **Accessibility**: WCAG compliance, screen readers, keyboard navigation
- **Performance**: Rendering optimization, bundle size, lazy loading
- **UX**: User experience, error handling, feedback
- **Full**: All of the above combined

Choose the review type based on what you're most concerned about, or use `full` for comprehensive analysis.
