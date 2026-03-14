import { NextResponse } from "next/server";
import { z } from "zod";

// --- Error codes (product-design.md Section 5) ---

export type ErrorCode =
  | "validation_error"
  | "not_found"
  | "unauthorized"
  | "rate_limited"
  | "ai_error"
  | "internal_error";

export type ErrorResponse = {
  error: { code: ErrorCode; message: string; details?: unknown };
};

const ERROR_STATUS: Record<ErrorCode, number> = {
  validation_error: 400,
  not_found: 404,
  unauthorized: 401,
  rate_limited: 429,
  ai_error: 502,
  internal_error: 500,
};

export class ApiError extends Error {
  code: ErrorCode;
  status: number;
  details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
  }
}

// --- withErrorHandler HOF ---

type RouteHandler = (
  request: Request,
  context: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>;

export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: {
              code: "validation_error" as const,
              message: "Invalid request",
              details: error.issues.map((e) => e.message),
            },
          },
          { status: 400 }
        );
      }

      if (error instanceof ApiError) {
        const body: ErrorResponse = {
          error: {
            code: error.code,
            message: error.message,
            ...(error.details !== undefined && { details: error.details }),
          },
        };
        return NextResponse.json(body, { status: error.status });
      }

      if (error instanceof Error) {
        console.error("[API Error]", error.message);
      }

      return NextResponse.json(
        { error: { code: "internal_error", message: "Internal server error" } },
        { status: 500 }
      );
    }
  };
}

// --- Legacy helpers (backward compat with bootstrap routes) ---

export function getSafeOrigin(request: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && isAllowedOrigin(envUrl)) return envUrl.replace(/\/$/, "");

  const headerOrigin = request.headers.get("origin") ?? "";
  if (isAllowedOrigin(headerOrigin)) return headerOrigin.replace(/\/$/, "");

  return "";
}

function isAllowedOrigin(url: string): boolean {
  return url.startsWith("https://") || url.startsWith("http://localhost");
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Invalid request", details: error.issues.map((e) => e.message) },
      { status: 400 }
    );
  }

  if (error instanceof Error) {
    console.error("[API Error]", error.message);
  }

  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}
