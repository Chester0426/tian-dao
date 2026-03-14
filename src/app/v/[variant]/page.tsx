import { VARIANTS } from "@/lib/variants";
import { notFound } from "next/navigation";
import { VariantLanding } from "./variant-landing";

export function generateStaticParams() {
  return VARIANTS.map((v) => ({ variant: v.slug }));
}

export default async function VariantPage({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const { variant: slug } = await params;
  const variant = VARIANTS.find((v) => v.slug === slug);
  if (!variant) return notFound();

  return <VariantLanding variant={variant} />;
}
