import { cookies } from "next/headers";

const SLOT_COOKIE = "x-slot";

/** Read the selected save slot from cookies (server-side). Returns null if not set. */
export async function getSelectedSlot(): Promise<number | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SLOT_COOKIE)?.value;
  if (!value) return null;
  const slot = parseInt(value, 10);
  if (isNaN(slot) || slot < 1 || slot > 3) return null;
  return slot;
}

/** Set the selected save slot cookie (client-side via API route). */
export function getSlotCookieName(): string {
  return SLOT_COOKIE;
}
