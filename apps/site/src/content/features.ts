/**
 * FEAT-028 (ADR-0039 §3): the site's copy of FEATURES.md. Every shipped feature, in the
 * visitor's words. `content.test.ts` reads loop/REGISTRY.md and fails if a done FEAT is
 * missing here, an ID here is unknown, or a "coming soon" item is actually done.
 */

export type SectionId =
  | 'how'
  | 'book'
  | 'notify'
  | 'trust'
  | 'phone'
  | 'look'
  | 'operators';

export type FeatureStatus = 'done' | 'coming-soon';

export interface Feature {
  id: `FEAT-${string}`;
  /** The visitor-facing name. */
  title: string;
  /** What it is and how a resident or operator uses it. One or two sentences. */
  what: string;
  /** Why it exists — the reason, in plain words. One sentence. */
  why: string;
  section: SectionId;
  status: FeatureStatus;
}

export interface Section {
  id: SectionId;
  /** The heading. */
  title: string;
  /** The question a visitor has at this point. Shown as the lede. */
  lede: string;
}

export const sections: Section[] = [
  {
    id: 'how',
    title: 'How a group buy works',
    lede: 'A round is a shared deadline and a price that falls as neighbours join.',
  },
  {
    id: 'book',
    title: 'Browse, ask, book',
    lede: 'Every service in your society, one tap from a pledge. No open round yet? Ask.',
  },
  {
    id: 'notify',
    title: 'Never miss a round',
    lede: 'You hear about every step by SMS and, on an installed phone, by push.',
  },
  {
    id: 'trust',
    title: 'Trust and accountability',
    lede: 'A person negotiates every deal. A rating follows every job.',
  },
  {
    id: 'phone',
    title: 'Built for a phone in a society',
    lede: 'No passwords, no app store, no re-login. Works when the signal drops.',
  },
  {
    id: 'look',
    title: 'A look you want to open',
    lede: 'Flat, quiet and precise, in your colour, day and night.',
  },
  {
    id: 'operators',
    title: 'For the people who run it',
    lede: 'One dashboard turns pooled demand into a real job and tracks who has paid.',
  },
];

export const features: Feature[] = [
  // ---- how a group buy works -----------------------------------------------------------
  {
    id: 'FEAT-003',
    title: 'Group-buy rounds',
    what: 'A round is a time-boxed group buy for one service in your society. You join with the number of units you need, and everyone pays the best price the pooled units have reached.',
    why: 'Thresholds count units, not people, so one flat with three ACs moves the group as much as three flats.',
    section: 'how',
    status: 'done',
  },
  {
    id: 'FEAT-018',
    title: 'A price ladder you can see',
    what: 'Each round shows every tier, where the count is now, and how many more units unlock the next price. A live countdown runs inside the last day, and one tap shares the round with neighbours.',
    why: 'The more neighbours join, the cheaper it gets for everyone. That has to be seen, not read in a footnote.',
    section: 'how',
    status: 'done',
  },
  {
    id: 'FEAT-004',
    title: 'Deadlines that mean it',
    what: 'Rounds close themselves at the deadline. If the minimum tier was reached, the round goes to the operator for a vendor; if not, everyone is told it expired.',
    why: 'A deadline only creates urgency when the system keeps it without anyone watching the clock.',
    section: 'how',
    status: 'done',
  },
  {
    id: 'FEAT-010',
    title: 'Units in the service’s own words',
    what: 'You pledge 2 rooms for deep cleaning, 3 ACs for servicing, or one 25 kg pack of rice. Every count on screen uses the service’s own noun.',
    why: '“2 units” is abstract and causes mistakes; “2 rooms” is a pledge you can trust.',
    section: 'how',
    status: 'done',
  },

  // ---- browse, ask, book ------------------------------------------------------------------
  {
    id: 'FEAT-002',
    title: 'A catalog for your society',
    what: 'Services shows what is offered to your society, with an indicative price and what the job covers.',
    why: 'One society’s deal never leaks into another’s.',
    section: 'book',
    status: 'done',
  },
  {
    id: 'FEAT-021',
    title: 'From a service to booking in one tap',
    what: 'A service with an open round shows it on its card: today’s price, units joined, when it closes. Tapping the card opens that round with the pledge sheet already up.',
    why: 'Sessions last about thirty seconds. Every extra screen between intent and pledge loses a neighbour.',
    section: 'book',
    status: 'done',
  },
  {
    id: 'FEAT-022',
    title: 'Ask for this service',
    what: 'No round open? Tap Ask for this and see how many neighbours already asked. When the operator opens a round, everyone who asked hears first.',
    why: 'Asking turns invisible intent into a number the operator can act on, and rewards the askers with first notice.',
    section: 'book',
    status: 'done',
  },
  {
    id: 'FEAT-014',
    title: 'Twenty-three services across six categories',
    what: 'Appliances, home care, renovation, utilities, vehicle care and bulk staples. The operator switches each one on per society and sets its price.',
    why: 'A catalog the operator cannot shape is not a product.',
    section: 'book',
    status: 'done',
  },

  // ---- never miss a round -----------------------------------------------------------------
  {
    id: 'FEAT-006',
    title: 'An SMS for every step',
    what: 'Pledge confirmed, closing soon, closed with the final price, vendor assigned, job delivered, round cancelled. Nothing to set up.',
    why: 'Each message is written in the same database transaction as the event, so you never get one for something that did not happen, and never get it twice.',
    section: 'notify',
    status: 'done',
  },
  {
    id: 'FEAT-020',
    title: 'Push notifications in your colour',
    what: 'On an installed phone, a push arrives written for the event and tinted in the accent you chose. Tapping it opens the right round.',
    why: 'Bursts of hundreds of devices are sent by parallel workers that retry safely, never double-send and prune dead devices on their own.',
    section: 'notify',
    status: 'done',
  },

  // ---- trust and accountability ------------------------------------------------------------
  {
    id: 'FEAT-005',
    title: 'A person negotiates every deal',
    what: 'When a round closes met, the operator picks the vendor, records the negotiated price, marks the job delivered and tracks who has paid. Payment stays between you and the vendor.',
    why: 'Pooled demand is only worth something once someone turns it into a real job.',
    section: 'trust',
    status: 'done',
  },
  {
    id: 'FEAT-007',
    title: 'Rate every delivered job',
    what: 'After delivery, every participant rates the job from 1 to 5 with an optional note. You can correct a mis-tap.',
    why: 'The moment we recommend a vendor, a bad job is on us. Ratings attach to the round, so a vendor’s score is the honest sum of the jobs they did.',
    section: 'trust',
    status: 'done',
  },
  {
    id: 'FEAT-009',
    title: 'Ratings the operator can see',
    what: 'You rate from My Requests; the operator sees each vendor’s average and each round’s score.',
    why: 'The number has to be in front of the person who chooses the next vendor.',
    section: 'trust',
    status: 'done',
  },
  {
    id: 'FEAT-024',
    title: 'A confirm before anything you cannot undo',
    what: 'Leaving a round, removing a rating, withdrawing an ask or logging out all ask once first, and say so honestly if you are offline.',
    why: 'A mis-tap must never cost a neighbour their place in a round.',
    section: 'trust',
    status: 'done',
  },

  // ---- built for a phone ------------------------------------------------------------------
  {
    id: 'FEAT-001',
    title: 'Your society code and your phone',
    what: 'Enter the invite code your society gave you and your number. A one-time code arrives by SMS and you are in. Everything you see is scoped to your society.',
    why: 'In a society the phone is the identity. Codes live in memory with a time limit and are never logged or shown.',
    section: 'phone',
    status: 'done',
  },
  {
    id: 'FEAT-027',
    title: 'Sign in with WhatsApp',
    what: 'Tap Continue with WhatsApp, send the message it opens, tap the number you see on screen, and you are back in the app, signed in. On a laptop, scan a QR code with your phone. The SMS code stays as the fallback.',
    why: 'WhatsApp already verified your number, and a message you start costs nothing. Three taps, nothing to type.',
    section: 'phone',
    status: 'done',
  },
  {
    id: 'FEAT-013',
    title: 'Sign in once per phone',
    what: 'After the first code, this phone stays signed in. You can end a session from Profile.',
    why: 'You use this before summer and once a quarter. Being asked for a code every time kills a thirty-second visit.',
    section: 'phone',
    status: 'done',
  },
  {
    id: 'FEAT-008',
    title: 'Add it to your home screen',
    what: 'Installs from the browser with no app store. A thumb-reachable bar for Home, Services, My Requests and Profile. When the signal drops it says so and shows what is stale.',
    why: 'A lost signal mid-round must never look like your round disappeared.',
    section: 'phone',
    status: 'done',
  },
  {
    id: 'FEAT-023',
    title: 'Home opens on what you can save today',
    what: 'The first screen shows how many rounds are open and the three closing soonest, each one tap from its pledge sheet.',
    why: 'The first screen should answer the only question you came with.',
    section: 'phone',
    status: 'done',
  },
  {
    id: 'FEAT-016',
    title: 'Feels like an app, not a page',
    what: 'Bottom sheets for pledging and rating, large titles that tuck into a blurred bar as you scroll, safe-area aware, and a night mode that reveals itself in a circle from the switch.',
    why: 'A page that feels like a website gets ignored; one that feels native gets installed.',
    section: 'phone',
    status: 'done',
  },
  {
    id: 'FEAT-012',
    title: 'A separate door for the operator',
    what: 'The operator signs in on their own page with a phone number alone, with its own rate limits.',
    why: 'Operators have no society invite code, and their door should not share a resident’s.',
    section: 'phone',
    status: 'done',
  },

  // ---- a look you want to open -----------------------------------------------------------
  {
    id: 'FEAT-017',
    title: 'Flat paper, hairlines, Geist',
    what: 'Surfaces are paper with a one-pixel line. Corners are tight. The primary button is ink by day and near-white by night.',
    why: 'Calm and precise reads as trustworthy. Nothing glows that does not need to.',
    section: 'look',
    status: 'done',
  },
  {
    id: 'FEAT-019',
    title: 'Seven colour pairs, one look',
    what: 'Pick mono, ocean, aurora, bloom, sunset, forest or lagoon. The geometry never changes; only the accent does. Small sparks mark a saving unlocked, and all of it stops if your phone asks for less motion.',
    why: 'Choice without losing coherence.',
    section: 'look',
    status: 'done',
  },
  {
    id: 'FEAT-011',
    title: 'One set of tokens under everything',
    what: 'Colour, radius and type are variables, and every text-on-surface pair is tested for contrast in light and dark.',
    why: 'This site and the app share the same token sheet, pinned by a test, so what you see here is what you get.',
    section: 'look',
    status: 'done',
  },
  {
    id: 'FEAT-015',
    title: 'Search and filters that stick',
    what: 'Search any list by name, filter by category or status. The filter lives in the address, so a refresh or a shared link keeps it.',
    why: 'A catalog of twenty-three services and lists across societies need real search.',
    section: 'look',
    status: 'done',
  },

  // ---- for operators ----------------------------------------------------------------------
  {
    id: 'FEAT-025',
    title: 'Lists that stay fast',
    what: 'Every list loads a page at a time with an explicit Show more, across societies and rounds.',
    why: 'Nothing is silently cut off as the number of societies grows.',
    section: 'operators',
    status: 'done',
  },
];

/**
 * Done work that is deliberately NOT on the site: internal tooling a visitor gains nothing
 * from (FEATURES.md: "do not mention"). The content test exempts exactly these.
 */
export const internalFeatures: ReadonlySet<string> = new Set(['FEAT-026']);

export const featuresIn = (section: SectionId): Feature[] =>
  features.filter((f) => f.section === section);

/** What comes next, in order. Shipped work stays in the sections above; this is the road ahead. */
export const roadmap: { when: 'Now' | 'Next' | 'Later'; title: string; what: string }[] = [
  { when: 'Now', title: 'First societies live', what: 'Phone sign-in, the catalog, group-buy rounds, SMS and push, ratings, the operator dashboard, and a bulk-staples pilot are built and verified.' },
  { when: 'Next', title: 'WhatsApp round updates', what: 'Round alerts over WhatsApp where societies already live. Sign-in with WhatsApp is done; the channel follows behind the same notification interface.' },
  { when: 'Next', title: 'More services, more societies', what: 'The catalog is data, not code: the operator adds a service and switches it on per society. The platform is multi-tenant from day one.' },
  { when: 'Later', title: 'Recurring plans and warranty', what: 'Own the relationship, not just the first job: a quarterly pest-control or pre-summer AC plan, with the vendor accountable through us.' },
  { when: 'Later', title: 'Vendor tools and new cities', what: 'A vendor-side view and regional operators once the pilot proves fill rates and ratings in one city.' },
];

/** Who gains what. One short panel per audience. */
export const audiences: { key: string; label: string; title: string; points: string[] }[] = [
  { key: 'residents', label: 'Residents', title: 'Cheaper, trusted, zero organising', points: ['Pay the pooled price, not the single-customer price: about ₹300 less on a ₹1,000 AC service.', 'One tap to join; the deadline and the vendor are handled.', 'A rating on every job keeps vendors honest.'] },
  { key: 'societies', label: 'Societies', title: 'A service the committee can offer', points: ['An invite code brings every flat in; every price is the society’s own.', 'Pooled demand gets one vendor visit instead of forty, and one delivery to the gate for staples.', 'Nothing to run: the operator opens rounds and books the work.'] },
  { key: 'vendors', label: 'Vendors', title: 'Ten jobs at one address', points: ['No per-job acquisition cost, no scattered travel: a filled round is a day’s work in one building.', 'A negotiated price for guaranteed volume.', 'Ratings build a track record that wins the next round.'] },
  { key: 'operator', label: 'The platform', title: 'Demand first, supply by negotiation', points: ['Residents signal demand before anyone buys; the operator negotiates with that number in hand.', 'A commission on each pooled job; no inventory, no payment risk in the pilot.', 'Defensibility is execution: vendor relationships, ratings, and recurring plans.'] },
];

/** The demo round in the hero. Prices are per unit; the tiers are the app's own shape. */
export const demoRound = {
  service: 'AC servicing',
  unit: 'AC',
  unitPlural: 'ACs',
  closesIn: '3 days',
  tiers: [
    { units: 1, price: 1000 },
    { units: 5, price: 800 },
    { units: 10, price: 700 },
  ],
  /** Neighbours already in when the page loads. */
  startUnits: 3,
};

/**
 * The catalog as seeded (FEAT-002 + FEAT-014): 23 services across six categories, with the
 * seed's indicative prices and unit nouns (FEAT-010). `round` marks a demo open round
 * (units pledged, the target, its ladder, hours to the deadline); `asked` a demo count of
 * neighbours who tapped "Ask for this" (FEAT-022). Both are illustrative states, not live data.
 */
export type Category = 'Appliances' | 'Home Care' | 'Renovation' | 'Utilities' | 'Vehicle' | 'Bulk Staples';
export const CATEGORIES: Category[] = ['Appliances', 'Home Care', 'Renovation', 'Utilities', 'Vehicle', 'Bulk Staples'];

export interface CatalogItem {
  name: string;
  /** The seed's slug (apps/backend/prisma/seed.ts); catalog.seed.test.ts pins price and nouns by it. */
  slug: string;
  category: Category;
  /** Indicative price per unit, rupees. */
  price: number;
  unit: string;
  units: string;
  round?: { pledged: number; target: number; tiers: { units: number; price: number }[]; hoursLeft: number };
  asked?: number;
}

export const catalog: CatalogItem[] = [
  { name: 'AC servicing', slug: 'ac-servicing', category: 'Appliances', price: 499, unit: 'AC unit', units: 'AC units', round: { pledged: 6, target: 10, tiers: [{ units: 1, price: 499 }, { units: 5, price: 449 }, { units: 10, price: 399 }], hoursLeft: 52 } },
  { name: 'RO water purifier service', slug: 'ro-service', category: 'Appliances', price: 399, unit: 'purifier', units: 'purifiers' },
  { name: 'Washing machine service', slug: 'washing-machine-service', category: 'Appliances', price: 449, unit: 'machine', units: 'machines', asked: 2 },
  { name: 'Kitchen chimney cleaning', slug: 'chimney-cleaning', category: 'Appliances', price: 699, unit: 'chimney', units: 'chimneys' },
  { name: 'Geyser service', slug: 'geyser-service', category: 'Appliances', price: 349, unit: 'geyser', units: 'geysers', asked: 5 },
  { name: 'Pest control', slug: 'pest-control', category: 'Home Care', price: 899, unit: 'flat', units: 'flats', asked: 4 },
  { name: 'Deep cleaning', slug: 'deep-cleaning', category: 'Home Care', price: 2499, unit: 'flat', units: 'flats', round: { pledged: 7, target: 12, tiers: [{ units: 1, price: 2499 }, { units: 6, price: 2199 }, { units: 12, price: 1999 }], hoursLeft: 100 } },
  { name: 'Bathroom wash', slug: 'bathroom-wash', category: 'Home Care', price: 599, unit: 'bathroom', units: 'bathrooms' },
  { name: 'Sofa shampooing', slug: 'sofa-shampoo', category: 'Home Care', price: 249, unit: 'seat', units: 'seats', asked: 2 },
  { name: 'Termite treatment', slug: 'termite-treatment', category: 'Home Care', price: 2999, unit: 'flat', units: 'flats', asked: 6 },
  { name: 'Bed bug treatment', slug: 'bed-bug-treatment', category: 'Home Care', price: 1499, unit: 'flat', units: 'flats' },
  { name: 'Mattress cleaning', slug: 'mattress-cleaning', category: 'Home Care', price: 499, unit: 'mattress', units: 'mattresses' },
  { name: 'Painting', slug: 'painting', category: 'Renovation', price: 3500, unit: 'room', units: 'rooms' },
  { name: 'Pre-monsoon waterproofing', slug: 'waterproofing', category: 'Renovation', price: 2499, unit: 'area', units: 'areas', asked: 3 },
  { name: 'Water tank cleaning', slug: 'water-tank-cleaning', category: 'Utilities', price: 799, unit: 'tank', units: 'tanks', round: { pledged: 3, target: 8, tiers: [{ units: 1, price: 799 }, { units: 4, price: 699 }, { units: 8, price: 599 }], hoursLeft: 30 } },
  { name: 'Inverter battery check', slug: 'inverter-battery-check', category: 'Utilities', price: 299, unit: 'battery', units: 'batteries' },
  { name: 'Mosquito mesh fitting', slug: 'mosquito-mesh', category: 'Utilities', price: 650, unit: 'window', units: 'windows', asked: 1 },
  { name: 'Doorstep car wash', slug: 'car-wash', category: 'Vehicle', price: 399, unit: 'car', units: 'cars', round: { pledged: 5, target: 12, tiers: [{ units: 1, price: 399 }, { units: 6, price: 349 }, { units: 12, price: 299 }], hoursLeft: 20 } },
  { name: 'Car interior detailing', slug: 'car-interior-detailing', category: 'Vehicle', price: 1499, unit: 'car', units: 'cars' },
  { name: 'Bike service', slug: 'bike-service', category: 'Vehicle', price: 599, unit: 'bike', units: 'bikes', asked: 3 },
  { name: 'Basmati rice, 25 kg', slug: 'basmati-rice-25kg', category: 'Bulk Staples', price: 2750, unit: 'bag', units: 'bags', round: { pledged: 14, target: 20, tiers: [{ units: 1, price: 2750 }, { units: 10, price: 2600 }, { units: 20, price: 2450 }], hoursLeft: 140 } },
  { name: 'Sunflower oil, 15 L', slug: 'sunflower-oil-15l', category: 'Bulk Staples', price: 2100, unit: 'tin', units: 'tins' },
  { name: 'Whole wheat atta, 10 kg', slug: 'whole-wheat-atta-10kg', category: 'Bulk Staples', price: 480, unit: 'bag', units: 'bags', asked: 4 },
];
