// src/common/utils/logger.ts

interface Logger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
}

class ProductionLogger implements Logger {
  private isDevelopment = import.meta.env.DEV;

  debug(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(`🐛 [DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(`ℹ️ [INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`⚠️ [WARN] ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`❌ [ERROR] ${message}`, ...args);
  }
}

// Export a singleton logger instance
export const logger = new ProductionLogger();

// Convenience functions with emojis for better visual debugging
export const debugLog = {
  navigation: (message: string, ...args: any[]) => logger.debug(`🧭 NAV: ${message}`, ...args),
  api: (message: string, ...args: any[]) => logger.debug(`🌐 API: ${message}`, ...args),
  search: (message: string, ...args: any[]) => logger.debug(`🔍 SEARCH: ${message}`, ...args),
  user: (message: string, ...args: any[]) => logger.debug(`👤 USER: ${message}`, ...args),
  activity: (message: string, ...args: any[]) => logger.debug(`📊 ACTIVITY: ${message}`, ...args),
};
