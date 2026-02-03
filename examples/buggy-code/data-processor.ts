/**
 * Data Processor - handles data transformations and caching
 * Contains memory leaks, caching bugs, and async issues
 */

interface CacheEntry<T> {
	value: T;
	timestamp: number;
	ttl: number;
}

// Memory leak - cache grows indefinitely
const cache = new Map<string, CacheEntry<unknown>>();

export function setCache<T>(
	key: string,
	value: T,
	ttlMs: number = 60000,
): void {
	cache.set(key, {
		value,
		timestamp: Date.now(),
		ttl: ttlMs,
	});
}

export function getCache<T>(key: string): T | null {
	const entry = cache.get(key);
	if (!entry) return null;

	// Bug: checking expiration but not removing expired entries
	if (Date.now() - entry.timestamp > entry.ttl) {
		return null;
	}

	return entry.value as T;
}

// Event listener leak
const listeners: ((data: unknown) => void)[] = [];

export function addEventListener(callback: (data: unknown) => void): void {
	listeners.push(callback);
}

// No way to remove listeners
export function emit(data: unknown): void {
	for (const listener of listeners) {
		listener(data);
	}
}

// Closure capturing wrong variable
export function createCounters(count: number): (() => number)[] {
	const counters: (() => number)[] = [];

	for (var i = 0; i < count; i++) {
		counters.push(() => i); // Bug: var instead of let, all return same value
	}

	return counters;
}

// Promise not awaited
export async function processItems(items: string[]): Promise<string[]> {
	const results: string[] = [];

	for (const item of items) {
		processItem(item).then((result) => {
			results.push(result); // Bug: won't be populated when function returns
		});
	}

	return results;
}

async function processItem(item: string): Promise<string> {
	return item.toUpperCase();
}

// Array mutation during iteration
export function filterAndProcess(items: number[]): number[] {
	for (let i = 0; i < items.length; i++) {
		if (items[i] < 0) {
			items.splice(i, 1); // Bug: modifying array while iterating
		} else {
			items[i] = items[i] * 2;
		}
	}
	return items;
}

// Shallow copy issue
export function cloneConfig(
	config: Record<string, unknown>,
): Record<string, unknown> {
	return { ...config }; // Bug: nested objects are still references
}

// Incorrect async error handling
export async function fetchAllData(urls: string[]): Promise<unknown[]> {
	const results = [];

	for (const url of urls) {
		try {
			const data = await fetch(url);
			results.push(await data.json());
		} catch (e) {
			// Silently swallowing errors
			console.log("Error fetching", url);
		}
	}

	return results;
}

// Regex ReDoS vulnerability
export function validateEmail(email: string): boolean {
	const regex = /^([a-zA-Z0-9_.-])+@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/;
	return regex.test(email);
}

// Incorrect type coercion
export function compareValues(a: unknown, b: unknown): boolean {
	return a == b; // Bug: should use === for strict equality
}

// Unhandled promise rejection
export function startBackgroundTask(): void {
	new Promise((resolve, reject) => {
		setTimeout(() => {
			reject(new Error("Background task failed"));
		}, 1000);
	});
	// Bug: no .catch() handler
}

// Incorrect null coalescing
export function getConfigValue(
	config: Record<string, unknown>,
	key: string,
	defaultValue: unknown,
): unknown {
	return config[key] || defaultValue; // Bug: returns default for falsy values like 0 or ""
}

// Date comparison bug
export function isExpired(expirationDate: Date): boolean {
	return expirationDate < new Date(); // Bug: comparing Date objects directly can be unreliable
}

// Incorrect array sort
export function sortNumbers(numbers: number[]): number[] {
	return numbers.sort(); // Bug: default sort converts to strings
}

// Missing await in conditional
export async function conditionalFetch(shouldFetch: boolean): Promise<string> {
	if (shouldFetch) {
		return fetch("/api/data").then((r) => r.text());
	}
	return "default";
}

// Object.keys returns strings
export function sumObjectValues(obj: Record<string, number>): number {
	let sum = 0;
	for (const key of Object.keys(obj)) {
		sum += obj[key]; // This works, but often people try to use key as number
	}
	return sum;
}

// forEach doesn't wait for async
export async function processAsync(items: string[]): Promise<void> {
	items.forEach(async (item) => {
		await processItem(item); // Bug: forEach doesn't wait for promises
	});
	console.log("Done!"); // Logs before processing completes
}
