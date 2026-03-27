import { notFound } from "next/navigation";
import { isValidVariant, VARIANT_MAP, VARIANTS } from "@/lib/variants";
import LandingContent from "@/components/landing-content";

export function generateStaticParams() {
  return VARIANTS.map((slug) => ({ variant: slug }));
}

export default async function VariantPage({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const { variant } = await params;
  if (!isValidVariant(variant)) notFound();

  return <LandingContent variant={VARIANT_MAP[variant]} />;
}
