import { NextRequest } from "next/server";

/** Read the selected save slot from the request cookie. Returns 1 as fallback. */
export function getSlotFromRequest(req: NextRequest): number {
  const value = req.cookies.get("x-slot")?.value;
  if (!value) return 1;
  const slot = parseInt(value, 10);
  if (isNaN(slot) || slot < 1 || slot > 3) return 1;
  return slot;
}
