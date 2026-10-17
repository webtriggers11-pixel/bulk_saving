/**
 * FEAT-001 seed — the only way societies + the first super-admin exist in v1
 * (no self-serve society signup). Idempotent: safe to run repeatedly.
 *
 * Run:  pnpm --filter backend seed
 * (compiles this file with the project's tsc to prisma/dist, then runs the JS —
 *  so it works on any supported Node version, not only Node 22+ native TS).
 * Needs Postgres up (`docker compose up -d`) and DATABASE_URL set (apps/backend/.env).
 */
import { PrismaClient } from '@prisma/client';
import type { ServiceCategory } from '@bulk/shared';

const prisma = new PrismaClient();

const SOCIETIES = [
  { name: 'Green Meadows', city: 'Pune', inviteCode: 'GREEN001' },
  { name: 'Blue Waters', city: 'Mumbai', inviteCode: 'BLUE0002' },
];

const SUPER_ADMIN_PHONE = '+919999900001';

/**
 * FEAT-002 master services (ADR-0009). `indicativePrice` (integer rupees) is the
 * per-society display price seeded onto each offering; it is NOT the round price.
 */
const SERVICES = [
  {
    name: 'AC Servicing',
    slug: 'ac-servicing',
    description: 'Split & window AC cleaning, gas check and general servicing.',
    category: 'Appliances',
    indicativePrice: 499,
    unitLabel: 'AC unit',
    unitLabelPlural: 'AC units',
    unitDescription: 'One split or window AC: cleaning, gas check and servicing.',
  },
  {
    name: 'Pest Control',
    slug: 'pest-control',
    description: 'General cockroach, ant and mosquito treatment for your flat.',
    category: 'Home Care',
    indicativePrice: 899,
    unitLabel: 'flat',
    unitLabelPlural: 'flats',
    unitDescription: 'One flat, all rooms, single general treatment.',
  },
  {
    name: 'Deep Cleaning',
    slug: 'deep-cleaning',
    description: 'Full-home deep clean — kitchen, bathrooms, floors and windows.',
    category: 'Home Care',
    indicativePrice: 2499,
    unitLabel: 'flat',
    unitLabelPlural: 'flats',
    unitDescription: 'One flat: kitchen, bathrooms, floors and inside windows.',
  },
  {
    name: 'Bathroom Wash',
    slug: 'bathroom-wash',
    description: 'Intensive descaling and sanitisation of bathrooms.',
    category: 'Home Care',
    indicativePrice: 599,
    unitLabel: 'bathroom',
    unitLabelPlural: 'bathrooms',
    unitDescription: 'One bathroom: descaling, sanitisation, fittings wiped down.',
  },
  {
    name: 'Painting',
    slug: 'painting',
    // The service that made FEAT-010 necessary: "2 units of Painting" is meaningless,
    // and the resident is billed finalPrice x units.
    description: 'Interior wall painting with premium emulsion.',
    category: 'Renovation',
    indicativePrice: 3500,
    unitLabel: 'room',
    unitLabelPlural: 'rooms',
    unitDescription: 'One room up to 12x12 ft: walls only, two coats, putty where needed.',
  },
  // FEAT-014: the wider catalog, one entry per category in SERVICE_CATEGORIES (ADR-0025).
  ...([
    ['RO Water Purifier Service', 'ro-service', 'Filter check, cleaning and TDS test for your water purifier.', 'Appliances', 399, 'purifier', 'purifiers', 'One RO purifier: filter check, cleaning, TDS test. Filters billed separately.'],
    ['Washing Machine Service', 'washing-machine-service', 'Drum descaling, filter cleaning and a general check-up.', 'Appliances', 449, 'machine', 'machines', 'One washing machine: drum clean, inlet filter, general check.'],
    ['Kitchen Chimney Cleaning', 'chimney-cleaning', 'Degreasing of filters, hood and duct.', 'Appliances', 699, 'chimney', 'chimneys', 'One kitchen chimney: filters degreased, hood and duct wiped.'],
    ['Geyser Service', 'geyser-service', 'Descaling and safety check for storage geysers.', 'Appliances', 349, 'geyser', 'geysers', 'One storage geyser: descaling, anode check, thermostat test.'],
    ['Sofa Shampooing', 'sofa-shampoo', 'Deep shampoo and extraction for fabric sofas.', 'Home Care', 249, 'seat', 'seats', 'One seat of a fabric sofa: vacuum, shampoo, extraction.'],
    ['Termite Treatment', 'termite-treatment', 'Drill-fill-seal anti-termite treatment with warranty.', 'Home Care', 2999, 'flat', 'flats', 'One flat: drill-fill-seal along walls and woodwork, 1-year warranty.'],
    ['Bed Bug Treatment', 'bed-bug-treatment', 'Two-visit treatment for beds, sofas and cupboards.', 'Home Care', 1499, 'flat', 'flats', 'One flat, two visits two weeks apart.'],
    ['Mattress Cleaning', 'mattress-cleaning', 'Vacuum, shampoo and sanitise, both sides.', 'Home Care', 499, 'mattress', 'mattresses', 'One mattress, both sides: vacuum, shampoo, sanitise.'],
    ['Water Tank Cleaning', 'water-tank-cleaning', 'Drain, scrub and disinfect overhead and loft tanks.', 'Utilities', 799, 'tank', 'tanks', 'One overhead or loft tank up to 1000 L: drain, scrub, disinfect.'],
    ['Inverter Battery Check', 'inverter-battery-check', 'Terminal cleaning, water top-up and a load test.', 'Utilities', 299, 'battery', 'batteries', 'One inverter battery: terminal clean, water top-up, load test.'],
    ['Mosquito Mesh Fitting', 'mosquito-mesh', 'Aluminium-frame fibreglass mesh for windows.', 'Utilities', 650, 'window', 'windows', 'One window up to 4x4 ft: aluminium frame with fibreglass mesh.'],
    ['Car Wash (Doorstep)', 'car-wash', 'Foam wash at your parking spot.', 'Vehicle', 399, 'car', 'cars', 'One car at your parking spot: foam wash, wipe-down, tyre shine.'],
    ['Car Interior Detailing', 'car-interior-detailing', 'Vacuum, upholstery shampoo and trim cleaning.', 'Vehicle', 1499, 'car', 'cars', 'One car: vacuum, upholstery shampoo, dashboard and door trims.'],
    ['Bike Service', 'bike-service', 'Oil change, brake and chain adjustment, and a wash.', 'Vehicle', 599, 'bike', 'bikes', 'One two-wheeler: oil change, brake and chain adjust, wash. Parts extra.'],
    ['Pre-monsoon Waterproofing', 'waterproofing', 'Seal balconies, terrace patches and wet walls before the rains.', 'Renovation', 2499, 'area', 'areas', 'One balcony, terrace patch or bathroom wall up to 60 sq ft.'],
    // Bulk Staples — the grocery pilot (BRIEF "Scope changes", 2026-10-17).
    ['Basmati Rice (25 kg)', 'basmati-rice-25kg', 'Aged basmati in a sealed bag, delivered to the society gate.', 'Bulk Staples', 2750, 'bag', 'bags', 'One sealed 25 kg bag of aged basmati, delivered to the society gate.'],
    ['Sunflower Oil (15 L)', 'sunflower-oil-15l', 'Refined sunflower oil in a sealed tin.', 'Bulk Staples', 2100, 'tin', 'tins', 'One sealed 15 L tin of refined sunflower oil.'],
    ['Whole Wheat Atta (10 kg)', 'whole-wheat-atta-10kg', 'Chakki-fresh whole wheat flour.', 'Bulk Staples', 480, 'bag', 'bags', 'One sealed 10 kg bag of chakki-fresh atta.'],
    // Typed so a category typo fails the seed's compile: the seed writes through Prisma,
    // so the API's closed-list check never sees these rows (FEAT-014 V2 P2).
  ] as const satisfies ReadonlyArray<readonly [string, string, string, ServiceCategory, number, string, string, string]>).map(([name, slug, description, category, indicativePrice, unitLabel, unitLabelPlural, unitDescription]) => ({
    name,
    slug,
    description,
    category,
    indicativePrice,
    unitLabel,
    unitLabelPlural,
    unitDescription,
  })),
];

async function main(): Promise<void> {
  for (const s of SOCIETIES) {
    await prisma.society.upsert({
      where: { inviteCode: s.inviteCode },
      create: s,
      update: { name: s.name, city: s.city },
    });
  }

  const green = await prisma.society.findUniqueOrThrow({ where: { inviteCode: 'GREEN001' } });
  await prisma.resident.upsert({
    where: { societyId_phone: { societyId: green.id, phone: SUPER_ADMIN_PHONE } },
    create: {
      societyId: green.id,
      phone: SUPER_ADMIN_PHONE,
      name: 'Platform Admin',
      role: 'SUPER_ADMIN',
      verifiedAt: new Date(),
    },
    update: { role: 'SUPER_ADMIN', verifiedAt: new Date() },
  });

  // Master services (idempotent upsert by unique slug).
  for (const svc of SERVICES) {
    await prisma.service.upsert({
      where: { slug: svc.slug },
      create: {
        name: svc.name,
        slug: svc.slug,
        description: svc.description,
        category: svc.category,
        active: true,
        // FEAT-010: what one unit of this service IS.
        unitLabel: svc.unitLabel,
        unitLabelPlural: svc.unitLabelPlural,
        unitDescription: svc.unitDescription,
      },
      update: {
        name: svc.name,
        description: svc.description,
        category: svc.category,
        active: true,
        unitLabel: svc.unitLabel,
        unitLabelPlural: svc.unitLabelPlural,
        unitDescription: svc.unitDescription,
      },
    });
  }

  // Enable every master service for BOTH seeded societies, zero-friction (ADR-0009).
  const societies = await prisma.society.findMany({
    where: { inviteCode: { in: SOCIETIES.map((s) => s.inviteCode) } },
  });
  let offeringCount = 0;
  for (const society of societies) {
    for (const svc of SERVICES) {
      const service = await prisma.service.findUniqueOrThrow({ where: { slug: svc.slug } });
      await prisma.serviceOffering.upsert({
        where: { societyId_serviceId: { societyId: society.id, serviceId: service.id } },
        create: {
          societyId: society.id,
          serviceId: service.id,
          enabled: true,
          indicativePrice: svc.indicativePrice,
        },
        update: { enabled: true, indicativePrice: svc.indicativePrice },
      });
      offeringCount += 1;
    }
  }

  // FEAT-003 (ADR-0010): open ONE demo group-buy round — AC Servicing in
  // GREEN001, tiers 5→₹900 / 10→₹700, deadline ~7 days out. Idempotent: skip if
  // an OPEN round for the pair already exists (also enforced by a partial unique
  // index), so re-running the seed never creates a duplicate open round.
  const acService = await prisma.service.findUniqueOrThrow({ where: { slug: 'ac-servicing' } });
  const existingOpenRound = await prisma.round.findFirst({
    where: { societyId: green.id, serviceId: acService.id, status: 'OPEN' },
  });
  if (!existingOpenRound) {
    const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.round.create({
      data: {
        societyId: green.id,
        serviceId: acService.id,
        deadline,
        tiers: {
          create: [
            { threshold: 5, price: 900 },
            { threshold: 10, price: 700 },
          ],
        },
      },
    });
  }

  console.log('Seed complete:');
  for (const s of SOCIETIES) {
    console.log(`  Society: ${s.inviteCode} — ${s.name} (${s.city})`);
  }
  console.log(`  Super-admin resident: ${SUPER_ADMIN_PHONE} in Green Meadows (GREEN001)`);
  console.log(`  Master services: ${SERVICES.length} (${SERVICES.map((s) => s.slug).join(', ')})`);
  for (const svc of SERVICES) {
    console.log(`    ${svc.name}: 1 ${svc.unitLabel} / 2 ${svc.unitLabelPlural}`);
  }
  console.log(`  Service offerings created/updated: ${offeringCount} (enabled for both societies)`);
  console.log('  Demo round: AC Servicing in GREEN001 (OPEN, tiers 5->900 / 10->700, ~7d deadline)');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
