# Code Review Example

This example shows how to use the `review_code` tool for general code review.

## Input Code

```typescript
function calculateDiscount(price: number, userType: string) {
  let discount = 0;
  if (userType == "premium") {
    discount = price * 0.2;
  } else if (userType == "regular") {
    discount = price * 0.1;
  }
  return price - discount;
}
```

## Usage in Claude

```
Use review_code to check this TypeScript function:

function calculateDiscount(price: number, userType: string) {
  let discount = 0;
  if (userType == "premium") {
    discount = price * 0.2;
  } else if (userType == "regular") {
    discount = price * 0.1;
  }
  return price - discount;
}
```

## Example Output

The tool runs the code through multiple AI models in parallel. Here's a sample of what you might receive:

### Model: anthropic/claude-3.5-sonnet

**Issues Found:**

1. **Type Safety Issue**: Using `==` instead of `===` for string comparison
   - Risk: Loose equality can cause unexpected type coercion
   - Fix: Use `===` for strict equality

2. **Missing Input Validation**: No validation for negative prices or invalid user types
   - Risk: Function could return incorrect results for invalid inputs
   - Fix: Add input validation at the start

3. **Magic Numbers**: Discount percentages are hardcoded
   - Impact: Reduces maintainability
   - Fix: Extract to constants or configuration

**Suggested Refactor:**

```typescript
const DISCOUNT_RATES = {
  premium: 0.2,
  regular: 0.1,
} as const;

type UserType = keyof typeof DISCOUNT_RATES;

function calculateDiscount(price: number, userType: UserType): number {
  if (price < 0) {
    throw new Error('Price cannot be negative');
  }

  const discountRate = DISCOUNT_RATES[userType] ?? 0;
  const discount = price * discountRate;
  return price - discount;
}
```

### Model: openai/gpt-4-turbo

**Code Quality Assessment:**

**Strengths:**
- Clear function purpose
- Simple, readable logic

**Areas for Improvement:**

1. **Type Safety**: userType should be a union type, not a string
2. **Edge Cases**: What happens with negative prices? Zero prices?
3. **Extensibility**: Adding new user types requires code changes

**Recommendation:**
Consider using an enum or const assertion for user types, and add validation for price parameter.

### Model: google/gemini-pro

**Review Summary:**

**Critical Issues:**
- ⚠️ Using `==` instead of `===` - potential type coercion bugs

**Suggestions:**
- Define UserType as a TypeScript type for better type safety
- Consider returning an object with both original and discounted price
- Add JSDoc comments for better documentation

**Overall Assessment:** Good starting point, but needs type safety improvements and input validation.

---

## Summary

All three models identified similar issues:
- Type safety concerns with string comparison and parameter types
- Missing input validation
- Hardcoded discount values

The code works but would benefit from stronger typing and validation.
