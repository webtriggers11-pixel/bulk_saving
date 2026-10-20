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

/** Things the product does NOT do yet. The site says so rather than hiding it. */
export const notYet: { item: string; state: string; say: string }[] = [
  { item: 'WhatsApp round updates', state: 'Planned next', say: 'SMS today, WhatsApp next.' },
  { item: 'Paying inside the app', state: 'Not in v1', say: 'You pay the vendor directly; we track it.' },
  { item: 'A vendor app', state: 'Not in v1', say: 'The operator coordinates with vendors offline.' },
  { item: 'In-app chat', state: 'Not in v1', say: 'Support runs over phone and WhatsApp.' },
  { item: 'Grocery baskets and fresh produce', state: 'Pilot is staples only', say: 'Single products in fixed packs, one delivery to the gate.' },
  { item: 'Recurring plans and warranties', state: 'A v2 idea', say: 'Own the relationship, not just the first job.' },
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

/** The catalog as seeded (FEAT-002 + FEAT-014): 23 services across six categories. */
export const catalog: { name: string; category: string }[] = [
  { name: 'AC servicing', category: 'Appliances' },
  { name: 'RO water purifier service', category: 'Appliances' },
  { name: 'Washing machine service', category: 'Appliances' },
  { name: 'Kitchen chimney cleaning', category: 'Appliances' },
  { name: 'Geyser service', category: 'Appliances' },
  { name: 'Pest control', category: 'Home Care' },
  { name: 'Deep cleaning', category: 'Home Care' },
  { name: 'Bathroom wash', category: 'Home Care' },
  { name: 'Sofa shampooing', category: 'Home Care' },
  { name: 'Termite treatment', category: 'Home Care' },
  { name: 'Bed bug treatment', category: 'Home Care' },
  { name: 'Mattress cleaning', category: 'Home Care' },
  { name: 'Painting', category: 'Renovation' },
  { name: 'Pre-monsoon waterproofing', category: 'Renovation' },
  { name: 'Water tank cleaning', category: 'Utilities' },
  { name: 'Inverter battery check', category: 'Utilities' },
  { name: 'Mosquito mesh fitting', category: 'Utilities' },
  { name: 'Doorstep car wash', category: 'Vehicle' },
  { name: 'Car interior detailing', category: 'Vehicle' },
  { name: 'Bike service', category: 'Vehicle' },
  { name: 'Basmati rice, 25 kg', category: 'Bulk Staples' },
  { name: 'Sunflower oil, 15 L', category: 'Bulk Staples' },
  { name: 'Whole wheat atta, 10 kg', category: 'Bulk Staples' },
];
