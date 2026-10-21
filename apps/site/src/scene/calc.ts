/**
 * FEAT-028 T5e: the savings calculator, pure. Every input is a slider on the page; the
 * defaults come from BRIEF.md (₹1,000 → ~₹700 for one AC service, societies of 100–400 flats,
 * occasional/seasonal use). The take rate is an ILLUSTRATIVE assumption, labelled as such.
 */
export interface CalcInput {
  /** Flats in the society. */
  flats: number;
  /** Share of flats that join at least one round in a year, 0..1. */
  joining: number;
  /** Jobs per joining flat per year. */
  jobsPerFlat: number;
  /** Average single-customer price per job, rupees. */
  singlePrice: number;
  /** Pooled discount, 0..1 (the BRIEF example: ₹1,000 → ₹700 = 0.30). */
  discount: number;
  /** Illustrative platform take rate on the pooled price, 0..1. */
  takeRate: number;
}

export interface CalcOutput {
  jobs: number;
  pooledPrice: number;
  savingPerJob: number;
  societySavings: number;
  perFlatSavings: number;
  gmv: number;
  platformRevenue: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export const DEFAULTS: CalcInput = { flats: 200, joining: 0.3, jobsPerFlat: 2, singlePrice: 1000, discount: 0.3, takeRate: 0.1 };

export const calc = (i: CalcInput): CalcOutput => {
  const flats = clamp(Math.round(i.flats), 1, 5000);
  const joining = clamp(i.joining, 0, 1);
  const jobsPerFlat = clamp(i.jobsPerFlat, 0, 24);
  const singlePrice = clamp(i.singlePrice, 0, 1_000_000);
  const discount = clamp(i.discount, 0, 0.9);
  const takeRate = clamp(i.takeRate, 0, 0.5);
  const jobs = Math.round(flats * joining * jobsPerFlat);
  const pooledPrice = Math.round(singlePrice * (1 - discount));
  const savingPerJob = singlePrice - pooledPrice;
  const gmv = jobs * pooledPrice;
  return {
    jobs,
    pooledPrice,
    savingPerJob,
    societySavings: jobs * savingPerJob,
    perFlatSavings: flats > 0 ? Math.round((jobs * savingPerJob) / flats) : 0,
    gmv,
    platformRevenue: Math.round(gmv * takeRate),
  };
};

/** Compact Indian money: ₹2,40,000 → "₹2.4 L", ₹1,20,00,000 → "₹1.2 Cr". */
export const compactRupees = (n: number): string => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(abs >= 1e8 ? 0 : 1)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(abs >= 1e6 ? 0 : 1)} L`;
  return `${sign}₹${abs.toLocaleString('en-IN')}`;
};
