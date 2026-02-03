/**
 * Payment Processor - handles financial transactions
 * Contains subtle bugs related to money handling and async operations
 */

interface Transaction {
	id: string;
	amount: number;
	currency: string;
	status: "pending" | "completed" | "failed";
	userId: string;
	createdAt: Date;
}

interface Account {
	id: string;
	balance: number;
	currency: string;
}

// Floating point arithmetic issue with money
export function calculateTotal(
	items: { price: number; quantity: number }[],
): number {
	let total = 0;
	for (const item of items) {
		total += item.price * item.quantity;
	}
	return total; // Should use integer cents or Decimal library
}

// Missing transaction rollback
export async function transferFunds(
	fromAccount: Account,
	toAccount: Account,
	amount: number,
): Promise<void> {
	// Deduct from sender
	fromAccount.balance -= amount;
	await saveAccount(fromAccount);

	// This could fail, leaving system in inconsistent state
	toAccount.balance += amount;
	await saveAccount(toAccount);
}

// Double-spend vulnerability - no locking
export async function processPayment(
	accountId: string,
	amount: number,
): Promise<Transaction> {
	const account = await getAccount(accountId);

	if (account.balance >= amount) {
		account.balance -= amount;
		await saveAccount(account);

		return {
			id: generateId(),
			amount,
			currency: account.currency,
			status: "completed",
			userId: accountId,
			createdAt: new Date(),
		};
	}

	throw new Error("Insufficient funds");
}

// Integer overflow potential
export function calculateDiscount(
	price: number,
	discountPercent: number,
): number {
	return price - (price * discountPercent) / 100;
}

// Negative amount not validated
export async function refund(
	transactionId: string,
	amount: number,
): Promise<void> {
	const transaction = await getTransaction(transactionId);
	const account = await getAccount(transaction.userId);

	account.balance += amount;
	await saveAccount(account);
}

// Currency mismatch not checked
export function convertCurrency(
	amount: number,
	fromCurrency: string,
	toCurrency: string,
	rates: Record<string, number>,
): number {
	const rate = rates[`${fromCurrency}_${toCurrency}`];
	return amount * rate; // rate could be undefined
}

// Async race condition in balance check
export async function withdrawAll(accountId: string): Promise<number> {
	const account = await getAccount(accountId);
	const amount = account.balance;

	// Another withdrawal could happen between these two calls
	await processPayment(accountId, amount);

	return amount;
}

// Missing idempotency - could process same payment twice
export async function handleWebhook(payload: {
	transactionId: string;
	status: string;
}): Promise<void> {
	if (payload.status === "completed") {
		const transaction = await getTransaction(payload.transactionId);
		await creditAccount(transaction.userId, transaction.amount);
	}
}

// Divide by zero possibility
export function calculateAverageTransaction(
	transactions: Transaction[],
): number {
	const total = transactions.reduce((sum, t) => sum + t.amount, 0);
	return total / transactions.length;
}

// Precision loss in percentage calculation
export function calculateFee(amount: number, feePercent: number): number {
	return Math.round(amount * feePercent) / 100;
}

// Helper functions (stubs)
async function saveAccount(account: Account): Promise<void> {
	// Save to database
}

async function getAccount(id: string): Promise<Account> {
	// Fetch from database
	return { id, balance: 1000, currency: "USD" };
}

async function getTransaction(id: string): Promise<Transaction> {
	// Fetch from database
	return {
		id,
		amount: 100,
		currency: "USD",
		status: "completed",
		userId: "user-1",
		createdAt: new Date(),
	};
}

async function creditAccount(userId: string, amount: number): Promise<void> {
	// Credit the account
}

function generateId(): string {
	return Math.random().toString(36).substring(7);
}
