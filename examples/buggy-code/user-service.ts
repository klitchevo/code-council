/**
 * User Service - handles user operations
 * This file contains several subtle bugs for demonstration purposes
 */

import { db } from "./database";

interface User {
	id: string;
	email: string;
	password: string;
	role: "admin" | "user" | "moderator";
	lastLogin: Date;
	failedAttempts: number;
}

// SQL Injection vulnerability - user input directly in query
export async function getUserByEmail(email: string): Promise<User | null> {
	const query = `SELECT * FROM users WHERE email = '${email}'`;
	const result = await db.query(query);
	return result.rows[0] || null;
}

// Insecure password comparison - timing attack vulnerable
export function verifyPassword(
	inputPassword: string,
	storedPassword: string,
): boolean {
	if (inputPassword.length !== storedPassword.length) {
		return false;
	}

	for (let i = 0; i < inputPassword.length; i++) {
		if (inputPassword[i] !== storedPassword[i]) {
			return false;
		}
	}
	return true;
}

// Race condition - check-then-act pattern
export async function incrementFailedAttempts(userId: string): Promise<void> {
	const user = await db.query(
		`SELECT failed_attempts FROM users WHERE id = $1`,
		[userId],
	);
	const currentAttempts = user.rows[0].failed_attempts;

	await db.query(`UPDATE users SET failed_attempts = $1 WHERE id = $2`, [
		currentAttempts + 1,
		userId,
	]);
}

// Missing input validation
export async function updateUserRole(
	userId: string,
	newRole: string,
): Promise<void> {
	await db.query(`UPDATE users SET role = $1 WHERE id = $2`, [newRole, userId]);
}

// Hardcoded secret
const JWT_SECRET = "super-secret-key-12345";

export function generateToken(user: User): string {
	const payload = {
		id: user.id,
		email: user.email,
		role: user.role,
		exp: Date.now() + 86400000, // 24 hours
	};

	// Using a weak algorithm
	return Buffer.from(JSON.stringify(payload)).toString("base64");
}

// Off-by-one error in pagination
export async function getUsers(page: number, limit: number): Promise<User[]> {
	const offset = page * limit; // Should be (page - 1) * limit for 1-indexed pages
	const result = await db.query(`SELECT * FROM users LIMIT $1 OFFSET $2`, [
		limit,
		offset,
	]);
	return result.rows;
}

// Missing null check
export function formatUserDisplay(user: User): string {
	return `${user.email.toUpperCase()} (${user.role})`;
}

// Prototype pollution vulnerability
export function mergeUserSettings(target: any, source: any): any {
	for (const key in source) {
		if (typeof source[key] === "object") {
			target[key] = mergeUserSettings(target[key] || {}, source[key]);
		} else {
			target[key] = source[key];
		}
	}
	return target;
}

// Information leak in error message
export async function authenticateUser(
	email: string,
	password: string,
): Promise<User> {
	const user = await getUserByEmail(email);

	if (!user) {
		throw new Error(`User with email ${email} not found`);
	}

	if (!verifyPassword(password, user.password)) {
		throw new Error(`Invalid password for user ${email}`);
	}

	return user;
}

// Insecure random ID generation
export function generateUserId(): string {
	return Math.random().toString(36).substring(2, 15);
}

// Missing rate limiting check
export async function resetPassword(email: string): Promise<void> {
	const user = await getUserByEmail(email);
	if (user) {
		const resetToken = generateUserId();
		await db.query(`UPDATE users SET reset_token = $1 WHERE email = $2`, [
			resetToken,
			email,
		]);
		// Send email with reset link
		console.log(`Reset link: /reset?token=${resetToken}`);
	}
}
