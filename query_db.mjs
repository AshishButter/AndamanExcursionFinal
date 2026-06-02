import { getPayload } from "payload";
import configPromise from "./src/payload.config.ts";

async function run() {
  try {
    const payload = await getPayload({ config: configPromise });
    console.log("Checking packages for 'Deep'...");
    
    const packages = await payload.find({
      collection: "packages",
      where: {
        "slug": { equals: "andaman-luxe-escape" }
      }
    });
    
    if (packages.docs.length > 0) {
      console.log("Package found. Let's see Day 2 title/description:");
      const pkg = packages.docs[0];
      const day2 = pkg.itinerary?.[1];
      console.log("Day 2:", day2?.title, day2?.description);
    } else {
      console.log("Package not found");
    }
    
    console.log("\nChecking ferry page...");
    const pages = await payload.find({
      collection: "pages",
      where: {
        "slug": { equals: "ferry" }
      }
    });
    
    if (pages.docs.length > 0) {
      const page = pages.docs[0];
      console.log("Ferry page found. layout length:", page.layout?.length);
      const howItWorks = page.layout?.find(block => block.blockType === "HowItWorks");
      if (howItWorks) {
        console.log("HowItWorks block steps:", JSON.stringify(howItWorks.steps, null, 2));
      }
    } else {
      console.log("Ferry page not found");
    }
    
  } catch (error) {
    console.error("Error:", error);
  }
  process.exit(0);
}

run();
