import { FerryVesselLayoutProps } from "@/types/SeatSelection.types";
import { UpdatedSealinkLuxuryLayout } from "../layouts/UpdatedSealinkLuxuryLayout";
import { UpdatedSealinkRoyalLayout } from "../layouts/UpdatedSealinkRoyalLayout";
import { GreenOceanEconomyLayout } from "../layouts/GreenOceanEconomyLayout";
import { GreenOceanPremiumLayout } from "../layouts/GreenOceanPremiumLayout";
import { GreenOceanRoyalLayout } from "../layouts/GreenOceanRoyalLayout";
import { MakruzzSeatLayout } from "../layouts/MakruzzSeatLayout";

export function FerryVesselLayout({
  operator,
  vesselClass,
  ...props
}: FerryVesselLayoutProps) {
  // Normalize operator and class name (e.g. nautika -> sealink, Royal -> royal)
  const normalizedOperator = (operator || "").toLowerCase();
  const normalizedClass = (vesselClass || "").toLowerCase();
  const isSealinkOrNautika =
    normalizedOperator === "nautika" || normalizedOperator === "sealink";
  const opKey = isSealinkOrNautika ? "sealink" : normalizedOperator;
  const layoutKey = `${opKey}-${normalizedClass}`;
  console.log("FerryVesselLayout layoutKey:", layoutKey);

  // Handle all Makruzz variants (makruzz, makruzz_gold, makruzz_pearl)
  if (normalizedOperator.startsWith("makruzz")) {
    return (
      <MakruzzSeatLayout
        vesselClass={vesselClass}
        operator={normalizedOperator}
        {...props}
      />
    );
  }

  // Robust handling for Nautika / Sealink layouts
  if (isSealinkOrNautika) {
    if (
      normalizedClass.includes("royal") ||
      normalizedClass.includes("business") ||
      normalizedClass === "economy"
    ) {
      return <UpdatedSealinkRoyalLayout {...props} />;
    }
    // luxury, premium, deluxe, etc.
    return <UpdatedSealinkLuxuryLayout {...props} />;
  }

  switch (layoutKey) {
    case "greenocean-economy":
      return <GreenOceanEconomyLayout {...props} />;
    case "greenocean-premium":
      return <GreenOceanPremiumLayout {...props} />;
    case "greenocean-royal":
      return <GreenOceanRoyalLayout {...props} />;
    default:
      return <div>Default Ferry Layout</div>;
  }
}

