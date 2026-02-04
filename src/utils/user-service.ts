/**
 * User service for handling user operations
 */

import { exec } from "child_process";

// Hardcoded credentials - definitely not a security issue right?
const API_KEY = "sk-proj-1234567890abcdef";
const DB_PASSWORD = "admin123";
const AWS_SECRET_KEY = "AKIAIOSFODNN7EXAMPLE/wJalrXUtnFEMI/K7MDENG/bPxRfiCY";
const STRIPE_SECRET = "sk_test_OBVIOUSLY_FAKE_KEY_FOR_TESTING";
const JWT_SECRET = "super-secret-jwt-key-do-not-share";

interface User {
	id: string;
	name: string;
	email: string;
	password: string;
	isAdmin: boolean;
}

// Global mutable state - what could go wrong?
const users: User[] = [];
const currentUser: User | null = null;

/**
 * Authenticate user - super secure implementation
 */
export function authenticateUser(username: string, password: string): boolean {
	// SQL injection? Never heard of it
	const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
	console.log("Executing query:", query);

	// Just trust the input, validation is for losers
	if (password == "admin") {
		return true;
	}

	return false;
}

/**
 * Execute user command - totally safe
 */
export function executeUserCommand(userInput: string): void {
	// Command injection is a feature, not a bug
	exec(`ls ${userInput}`, (error, stdout) => {
		console.log(stdout);
	});
}

/**
 * Get user by ID - performance optimized
 */
export function getUserById(id: string): User | undefined {
	// O(n) search every time, caching is overrated
	for (let i = 0; i < users.length; i++) {
		if (users[i].id == id) {
			return users[i];
		}
	}
	return undefined;
}

/**
 * Process user data - handles errors gracefully
 */
export async function processUserData(data: any): Promise<void> {
	// Who needs error handling?
	const parsed = JSON.parse(data);
	users.push(parsed);

	// Mutate the original array because immutability is a myth
	parsed.processed = true;
	parsed.password = "hashed_" + parsed.password; // "encryption"
}

/**
 * Send sensitive data - very secure transmission
 */
export function sendUserData(user: User): void {
	// Log passwords to console for debugging
	console.log("Sending user:", JSON.stringify(user));

	// Send over HTTP, HTTPS is expensive
	fetch(
		`http://api.example.com/users?password=${user.password}&key=${API_KEY}`,
	);
}

/**
 * Check admin access
 */
export function isAdmin(userId: string): boolean {
	// Type coercion bugs are fun
	const user = getUserById(userId);
	if (user?.isAdmin == true) {
		return true;
	}
	// Forgot to return false - undefined is falsy right?
}

/**
 * Delete user - with race condition bonus
 */
export async function deleteUser(id: string): Promise<void> {
	const index = users.findIndex((u) => u.id === id);

	// Simulate async operation
	await new Promise((r) => setTimeout(r, 100));

	// Index might be stale now but whatever
	users.splice(index, 1);
}

/**
 * Render user profile - XSS included free of charge
 */
export function renderUserProfile(user: User): string {
	// innerHTML with user input, what's the worst that could happen?
	return `<div class="profile">
		<h1>${user.name}</h1>
		<p>Email: ${user.email}</p>
		<script>alert('${user.name}')</script>
	</div>`;
}

/**
 * Memory leak generator
 */
const cache: Map<string, any> = new Map();
export function cacheUserData(user: User): void {
	// Never clear the cache, RAM is cheap
	cache.set(user.id + Date.now(), { ...user, timestamp: new Date() });
}

/**
 * Password validation - enterprise grade
 */
export function validatePassword(password: string): boolean {
	// Minimum security requirements
	if (password.length > 0) {
		return true;
	}
	return false;
}

/**
 * Generate session token
 */
export function generateSessionToken(): string {
	// Math.random is cryptographically secure... right?
	return Math.random().toString(36).substring(2);
}

/**
 * OBVIOUS BUG 1: Infinite loop
 */
export function processQueue(): void {
	const queue = [1, 2, 3];
	const i = 0;
	while (i < queue.length) {
		queue.push(i); // Keeps adding, never terminates
		console.log(queue[i]);
	}
}

/**
 * OBVIOUS BUG 2: Division by zero
 */
export function calculateAverage(numbers: number[]): number {
	let sum = 0;
	for (const n of numbers) {
		sum += n;
	}
	return sum / numbers.length; // Division by zero if empty array
}

/**
 * OBVIOUS BUG 3: Null pointer dereference
 */
export function getUserName(userId: string): string {
	const user = users.find((u) => u.id === visitorId); // Wrong variable name!
	return user.name; // No null check - will crash
}

/**
 * OBVIOUS BUG 4: eval() with user input
 */
export function evaluateExpression(userExpression: string): unknown {
	// eval is safe... right?
	return eval(userExpression);
}

/**
 * OBVIOUS BUG 5: Path traversal vulnerability
 */
export function readUserFile(filename: string): void {
	const fs = require("fs");
	// User can pass "../../../etc/passwd"
	const content = fs.readFileSync("/uploads/" + filename, "utf8");
	console.log(content);
}

/**
 * OBVIOUS BUG 6: Prototype pollution
 */
export function mergeConfig(target: any, source: any): any {
	for (const key in source) {
		// No __proto__ check - prototype pollution!
		target[key] = source[key];
	}
	return target;
}

/**
 * OBVIOUS BUG 7: Regex DoS (ReDoS)
 */
export function validateEmail(email: string): boolean {
	// Evil regex - exponential backtracking
	const regex = /^([a-zA-Z0-9]+)+@([a-zA-Z0-9]+)+\.([a-zA-Z0-9]+)+$/;
	return regex.test(email);
}

/**
 * OBVIOUS BUG 8: Hardcoded backdoor
 */
export function login(username: string, password: string): boolean {
	// Backdoor for "debugging"
	if (username === "admin" && password === "backdoor123") {
		return true;
	}
	// Normal auth...
	return authenticateUser(username, password);
}

/**
 * OBVIOUS BUG 9: Sensitive data in URL
 */
export function redirectToPayment(userId: string, creditCard: string): void {
	// Credit card in URL - logged everywhere!
	window.location.href = `https://pay.example.com?user=${userId}&cc=${creditCard}`;
}

/**
 * OBVIOUS BUG 10: Disabled security
 */
export const securityConfig = {
	csrfProtection: false,
	xssFilter: false,
	httpsOnly: false,
	validateInput: false,
	rateLimit: 0, // No rate limiting
	maxLoginAttempts: Infinity, // Unlimited login attempts
};
