import { LandingContent } from "@/components/landing-content";
import { getDefaultVariant } from "@/lib/variants";

export default function HomePage() {
  const variant = getDefaultVariant();
  return <LandingContent variant={variant} />;
}
