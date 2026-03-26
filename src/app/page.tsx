import { DEFAULT_VARIANT, VARIANT_MAP } from "@/lib/variants";
import LandingContent from "@/components/landing-content";

export default function Home() {
  const variant = VARIANT_MAP[DEFAULT_VARIANT];
  return <LandingContent variant={variant} />;
}
