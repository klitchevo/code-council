/**
 * Structured logging utility for better observability.
 * Logs to stderr in JSON format for easy parsing.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
	[key: string]: unknown;
}

class Logger {
	private isDevelopment = process.env.NODE_ENV === "development";
	private debugEnabled = process.env.DEBUG === "true";

	private log(level: LogLevel, message: string, context?: LogContext): void {
		const logEntry = {
			timestamp: new Date().toISOString(),
			level,
			message,
			...context,
		};

		// In development, use pretty printing
		if (this.isDevelopment) {
			const emoji = {
				debug: "🔍",
				info: "ℹ️",
				warn: "⚠️",
				error: "❌",
			}[level];

			console.error(
				`${emoji} [${level.toUpperCase()}] ${message}`,
				context ? JSON.stringify(context, null, 2) : "",
			);
		} else {
			// In production, use JSON for structured logging
			console.error(JSON.stringify(logEntry));
		}
	}

	debug(message: string, context?: LogContext): void {
		if (this.debugEnabled) {
			this.log("debug", message, context);
		}
	}

	info(message: string, context?: LogContext): void {
		this.log("info", message, context);
	}

	warn(message: string, context?: LogContext): void {
		this.log("warn", message, context);
	}

	error(message: string, error?: Error | unknown, context?: LogContext): void {
		const errorContext: LogContext = {
			...context,
		};

		if (error instanceof Error) {
			errorContext.error = {
				name: error.name,
				message: error.message,
				stack: error.stack,
			};
		} else if (error) {
			errorContext.error = error;
		}

		this.log("error", message, errorContext);
	}
}

/**
 * Global logger instance
 */
export const logger = new Logger();
