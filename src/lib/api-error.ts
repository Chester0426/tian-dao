import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Returns a safe origin URL for redirect URLs (e.g., Stripe success/cancel).
 * Prefers NEXT_PUBLIC_APP_URL env var, falls back to validated request origin.
 * Only allows https:// or http://localhost origins.
 */
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

/**
 * Handles errors in API route handlers.
 * Returns appropriate HTTP status codes based on error type.
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Invalid request", details: error.issues.map((e) => e.message) },
      { status: 400 }
    );
  }

  if (error instanceof Error) {
    // Never leak internal error messages to the client
    console.error("[API Error]", error.message);
  }

  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}
