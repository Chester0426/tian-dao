"use client";

import { LandingContent } from "@/components/landing-content";
import type { Variant } from "@/lib/variants";

export function VariantLanding({ variant }: { variant: Variant }) {
  return <LandingContent variant={variant} />;
}
