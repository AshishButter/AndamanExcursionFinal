import React from "react";
import type { LargeCardSectionProps } from "./LargeCardSection.types";
import { Section } from "@/components/layout";
import { LargeCard } from "@/components/molecules/Cards";

export const LargeCardSection = ({ content }: LargeCardSectionProps) => {
  if (!content) return null;
  const { subtitle, title, image, imageAlt, ctaText, ctaHref } = content;

  let overrideImage = image;
  if (title && title.includes("Andaman is Calling")) {
    overrideImage = {
      ...((image as any) || {}),
      url: "/images/activities/beach-that-extends-into-sea-looking-out-see-island-blue-sky-there-are-many-boats-floating-emerald-green-sea-andaman-sea.jpg",
      sizes: undefined,
    } as any;
  }

  return (
    <Section id="large-card-section" aria-label="Large Card Section">
      <LargeCard
        subtitle={subtitle}
        title={title}
        image={overrideImage}
        imageAlt={imageAlt}
        ctaText={ctaText}
        ctaHref={ctaHref}
      />
    </Section>
  );
};
