import { PostgrestError } from "@supabase/supabase-js";

export type ErrorSeverity = "info" | "warn" | "error" | "critical";

export type ErrorOperation =
  | "AUTH_CHECK"
  | "AUTH_LOGIN"
  | "AUTH_SIGNUP"
  | "AUTH_LOGOUT"
  | "AUTH_SESSION"
  | "FETCH_DATA"
  | "CREATE_DATA"
  | "UPDATE_DATA"
  | "DELETE_DATA"
  | "UPLOAD_FILE"
  | "VALIDATE_FORM"
  | "QUERY_ERROR"
  | "MUTATION_ERROR";

export interface ErrorContext {
  component: string;
  operation: ErrorOperation;
  userId?: string;
  route?: string;
  metadata?: Record<string, any>;
}

interface ErrorDetails {
  timestamp: string;
  message: string;
  stack?: string;
  supabaseCode?: string;
  supabaseDetails?: string;
  context: ErrorContext;
  severity: ErrorSeverity;
}

/**
 * Parse Supabase error to extract error code and details
 */
function parseSupabaseError(error: any): { code?: string; details?: string } {
  if (error && typeof error === "object") {
    const postgrestError = error as PostgrestError;
    return {
      code: postgrestError.code,
      details: postgrestError.details || postgrestError.hint,
    };
  }
  return {};
}

/**
 * Sanitize sensitive data from error context
 */
function sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
  if (!metadata) return undefined;

  const sanitized = { ...metadata };
  const sensitiveKeys = ["password", "token", "secret", "apiKey", "api_key"];

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = "[REDACTED]";
    }
  }

  return sanitized;
}

/**
 * Main error logging function
 */
export function logError(
  error: Error | unknown,
  context: ErrorContext,
  severity: ErrorSeverity = "error"
): void {
  const { code, details } = parseSupabaseError(error);

  const errorDetails: ErrorDetails = {
    timestamp: new Date().toISOString(),
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    supabaseCode: code,
    supabaseDetails: details,
    context: {
      ...context,
      metadata: sanitizeMetadata(context.metadata),
      route: context.route || window.location.pathname,
    },
    severity,
  };

  // Log to console in development
  if (import.meta.env.DEV) {
    console.error("[APP ERROR]", errorDetails);
  } else {
    // In production, log structured error (ready for external monitoring)
    console.error("[APP ERROR]", {
      timestamp: errorDetails.timestamp,
      component: errorDetails.context.component,
      operation: errorDetails.context.operation,
      message: errorDetails.message,
      severity: errorDetails.severity,
      supabaseCode: errorDetails.supabaseCode,
    });
  }

  // Future: Send to monitoring service
  // if (import.meta.env.PROD) {
  //   sendToMonitoringService(errorDetails);
  // }
}

/**
 * Helper to get user ID from current session
 */
export async function getCurrentUserId(supabase: any): Promise<string | undefined> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id;
  } catch {
    return undefined;
  }
}

/**
 * Map Supabase error codes to user-friendly messages
 */
export function getSupabaseErrorMessage(error: any): string {
  const { code } = parseSupabaseError(error);

  const errorMessages: Record<string, string> = {
    "23505": "This record already exists",
    "23503": "Related record not found",
    "42501": "Permission denied",
    PGRST116: "No rows found",
    "08006": "Connection failed",
  };

  return errorMessages[code || ""] || error?.message || "An unexpected error occurred";
}
