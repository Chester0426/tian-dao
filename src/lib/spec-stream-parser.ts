import type { SpecStreamEvent } from "@/lib/spec-reducer";

const PREFIX = ">>>EVENT:";

export function parseSpecStreamLine(line: string): SpecStreamEvent | null {
  if (!line.startsWith(PREFIX)) {
    return null;
  }

  const jsonStr = line.slice(PREFIX.length).trim();

  if (!jsonStr) {
    return null;
  }

  try {
    return JSON.parse(jsonStr) as SpecStreamEvent;
  } catch {
    return null;
  }
}
