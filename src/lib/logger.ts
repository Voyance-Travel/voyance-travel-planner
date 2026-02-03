/**
 * Production-safe logger utility
 * Only logs in development mode to keep console clean in production
 */

const isDev = import.meta.env.DEV;

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args);
    }
  },
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info(...args);
    }
  },
  warn: (...args: unknown[]) => {
    // Warnings shown in all environments
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    // Errors always shown
    console.error(...args);
  },
};

export default logger;
