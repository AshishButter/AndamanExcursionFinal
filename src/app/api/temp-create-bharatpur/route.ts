import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@/payload.config';

export async function GET() {
  try {
    const payload = await getPayload({ config });
    
    // Check if it already exists
    const existing = await payload.find({
      collection: 'pages',
      where: {
        slug: { equals: 'bharatpur-beach' }
      }
    });
    
    if (existing.docs.length > 0) {
      return NextResponse.json({ success: true, message: 'Bharatpur Beach already exists', doc: existing.docs[0] });
    }
    
    // Create new
    const newPage = await payload.create({
      collection: 'pages',
      data: {
        title: "Bharatpur Beach",
        slug: "bharatpur-beach",
        basicInfo: {
            pageType: "destinations"
        },
        destinationInfo: {
            destinationType: "sub",
            indexSettings: {
                showAllDestinations: true,
            },
            parentMainCategory: "689bcedddaf7f773e5a1ace7", // Neil Island
            subcategorySlug: "bharatpur-beach",
            subcategoryType: "beach",
            navigationSettings: {
                showInNavigation: true,
                navigationOrder: 1
            }
        },
        pageContent: {
            content: [
                {
                    blockType: "secondaryBanner",
                    title: "The Coral Kingdom of Neil Island",
                    subtitle: "Bharatpur Beach",
                    description: "Bharatpur Beach is a stunning white sand beach located in Neil Island (Shaheed Dweep). Known for its shallow waters and vibrant coral reefs, it is the best place on the island for swimming and water sports. The crystal-clear waters make it an ideal spot for snorkeling and glass-bottom boat rides to explore the rich marine life.",
                    image: "68cc6b500d3c11b8dee4c442",
                },
                {
                    blockType: "serviceFeature",
                    title: "Activities and Adventure",
                    specialWord: "Adventure",
                    description: "Unlike other beaches in Neil Island, Bharatpur Beach is the hub of water activities. Visitors can indulge in snorkeling, scuba diving, and glass-bottom boat rides to witness the spectacular coral reefs and colorful fishes. The gentle waves and shallow waters also make it a safe and perfect spot for swimming and relaxing on the beach.",
                    image: "68d7df83b57f8e206a9aa605",
                    ctaText: "Enquire Now",
                    ctaHref: "/contact",
                },
                {
                    blockType: "visualCategoryGrid",
                    title: "Things to do",
                    specialWord: "do",
                    description: "Experience the vibrant marine life and thrilling water sports at Bharatpur Beach.",
                    categories: [
                        {
                            title: "Explore the underwater world without getting wet! Glass-bottom boat rides offer a clear view of the magnificent coral reefs and colorful fishes.",
                            subtitle: "Glass Bottom Boat Ride",
                            image: "68d7df93b57f8e206a9aa60f",
                            imageAlt: "Glass Bottom Boat Ride at Bharatpur Beach"
                        },
                        {
                            title: "Snorkeling here is an unforgettable experience. The shallow waters are rich with vibrant corals and diverse marine life, perfect for beginners and experts alike.",
                            subtitle: "Snorkeling",
                            image: "68d7dfacb57f8e206a9aa620",
                            imageAlt: "Snorkeling at Bharatpur Beach"
                        },
                        {
                            title: "The calm and shallow waters of Bharatpur Beach make it the best beach on Neil Island for a refreshing swim.",
                            subtitle: "Swimming",
                            image: "68d7df95b57f8e206a9aa613",
                            imageAlt: "Swimming at Bharatpur Beach"
                        },
                        {
                            title: "Relax on the pristine white sand, enjoy the picturesque views, and capture stunning photographs of the turquoise waters.",
                            subtitle: "Beach Relaxation",
                            image: "68d7df87b57f8e206a9aa609",
                            imageAlt: "Relaxing at Bharatpur Beach"
                        }
                    ],
                },
                {
                    blockType: "experience",
                    title: "How to Reach",
                    specialWord: "Reach",
                    cards: [
                        {
                            title: "Neil Island",
                            description: "Reach Neil Island first by availing of the ferry available from Port Blair or Havelock. The journey by ferry itself is a scenic experience.",
                            icon: "68dfa70f40c9f56ca1b044fe",
                        },
                        {
                            title: "Local Transport",
                            description: "On arrival at Neil Island, one can hire an auto-rickshaw, a taxi, or rent a bicycle or two-wheeler. Bharatpur Beach is conveniently located just about half a kilometer from the Neil Island jetty.",
                            icon: "68dfa70b40c9f56ca1b044ea",
                        },
                        {
                            title: "Arrival at the Beach",
                            description: "The beach is easily accessible from the main road, making it very convenient for visitors of all ages to reach and enjoy.",
                            icon: "68dfa70d40c9f56ca1b044f2",
                        }
                    ],
                }
            ]
        },
        publishingSettings: {
            status: "published"
        },
        meta: {
            title: "Bharatpur Beach | Destinations | Andaman | Andaman Excursion",
            description: "Bharatpur Beach is a beautiful white sand beach located in Neil Island, famous for its coral reefs and water sports.",
            image: "68d7df93b57f8e206a9aa60f"
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    
    return NextResponse.json({ success: true, doc: newPage });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
