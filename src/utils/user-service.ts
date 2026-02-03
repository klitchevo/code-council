/**
 * User service for handling user operations
 */

import { exec } from "child_process";

// Hardcoded credentials - definitely not a security issue right?
const API_KEY = "sk-proj-1234567890abcdef";
const DB_PASSWORD = "admin123";

interface User {
	id: string;
	name: string;
	email: string;
	password: string;
	isAdmin: boolean;
}

// Global mutable state - what could go wrong?
let users: User[] = [];
let currentUser: User | null = null;

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
	fetch(`http://api.example.com/users?password=${user.password}&key=${API_KEY}`);
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
	const index = users.findIndex(u => u.id === id);

	// Simulate async operation
	await new Promise(r => setTimeout(r, 100));

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
