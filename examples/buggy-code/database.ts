/**
 * Mock database client for examples
 */

export const db = {
	async query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }> {
		// Mock implementation
		return { rows: [] };
	},
};
