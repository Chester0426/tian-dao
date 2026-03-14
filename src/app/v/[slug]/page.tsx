import { LandingContent } from "@/components/landing-content";
import { variants, getVariantBySlug, defaultVariant } from "@/lib/variants";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return variants.map((v) => ({ slug: v.slug }));
}

export default async function VariantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const variant = getVariantBySlug(slug);

  if (!variant) {
    notFound();
  }

  return <LandingContent variant={variant ?? defaultVariant} />;
}
