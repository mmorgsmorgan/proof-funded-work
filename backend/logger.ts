/**
 * Lightweight structured logger for API routes.
 * Outputs JSON lines to stdout for easy parsing by log aggregators.
 * No external dependencies required.
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  msg: string;
  timestamp: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, msg: string, data?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    msg,
    timestamp: new Date().toISOString(),
    service: "q'it",
    ...data,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (msg: string, data?: Record<string, unknown>) => emit('info', msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => emit('warn', msg, data),
  error: (msg: string, data?: Record<string, unknown>) => emit('error', msg, data),
};

/** Log an API request with timing. Returns a function to call when the request is complete. */
export function logRequest(method: string, path: string, extra?: Record<string, unknown>) {
  const start = Date.now();
  logger.info('request_start', { method, path, ...extra });

  return function logResponse(status: number, responseExtra?: Record<string, unknown>) {
    const duration = Date.now() - start;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    logger[level]('request_end', { method, path, status, durationMs: duration, ...responseExtra });
  };
}
