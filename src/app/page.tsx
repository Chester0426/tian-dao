"use client";

import { useEffect } from "react";
import { LandingContent } from "@/components/landing-content";
import { defaultVariant } from "@/lib/variants";
import { trackVisitLanding } from "@/lib/events";

export default function HomePage() {
  useEffect(() => {
    trackVisitLanding({
      variant: defaultVariant.slug,
      referrer: typeof document !== "undefined" ? document.referrer : undefined,
      utm_source: new URLSearchParams(window.location.search).get("utm_source") ?? undefined,
      utm_medium: new URLSearchParams(window.location.search).get("utm_medium") ?? undefined,
      utm_campaign: new URLSearchParams(window.location.search).get("utm_campaign") ?? undefined,
      gclid: new URLSearchParams(window.location.search).get("gclid") ?? undefined,
      utm_content: new URLSearchParams(window.location.search).get("utm_content") ?? undefined,
    });
  }, []);

  return <LandingContent variant={defaultVariant} />;
}
