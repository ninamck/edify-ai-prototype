/**
 * Farmer J shops — the 19 London sites shown in the site switcher and on
 * Jana's cross-shop board.
 *
 * Farmer J has no central kitchen. Every shop scratch-cooks in its own
 * basement prep kitchen and serves from a theatre main line plus a second
 * make line for delivery, online and catering. So every shop here is a
 * self-producing site; there is no hub / spoke relationship anywhere in
 * this brand.
 *
 * Data provenance:
 *  - Marylebone, Paddington and Leadenhall Street are hand-tuned from the
 *    2025 calls (Marylebone is the shop in the sales export; Paddington
 *    does about £2k of breakfast; City shops open at 11 and close at
 *    weekends).
 *  - The remaining 16 are plausible London locations with modelled
 *    parameters so every screen works for every shop. Nobody hand-authors
 *    them. Names beyond the first five are demo stand-ins.
 *
 * This module has no imports so it can be read from the ActiveSite shell
 * layer and from the production fixtures without an import cycle.
 */

export type ShopId = string;

export type Shop = {
  id: ShopId;
  name: string;
  /** Short area label shown under the name. */
  area: string;
  opensAt: string; // HH:MM
  closesAt: string; // HH:MM
  /** Serves breakfast (egg pots, porridge, coconut chia, breakfast rolls). */
  breakfast: boolean;
  /** Share of a typical day's sales that is breakfast, when served. */
  breakfastShare: number;
  /** Open Saturday / Sunday. City shops are not. */
  weekend: boolean;
  /** Size relative to Marylebone (1.0 = the real sales day). */
  sizeFactor: number;
  /** Share of lunch sales going through Deliveroo + Click & Collect. */
  deliveryShare: number;
  /** Hand-tuned vs modelled — surfaced in the handover. */
  provenance: 'calls' | 'public' | 'demo-modelled';
};

export const FJ_SHOPS: Shop[] = [
  {
    id: 'fj-marylebone',
    name: 'Marylebone',
    area: 'Marylebone High Street',
    opensAt: '08:00',
    closesAt: '21:00',
    breakfast: true,
    breakfastShare: 0.08,
    weekend: true,
    sizeFactor: 1.0,
    deliveryShare: 0.25,
    provenance: 'calls',
  },
  {
    id: 'fj-paddington',
    name: 'Paddington',
    area: 'Paddington Central',
    opensAt: '07:30',
    closesAt: '21:00',
    breakfast: true,
    breakfastShare: 0.25,
    weekend: true,
    sizeFactor: 1.15,
    deliveryShare: 0.2,
    provenance: 'calls',
  },
  {
    id: 'fj-leadenhall',
    name: 'Leadenhall Street',
    area: 'The City',
    opensAt: '11:00',
    closesAt: '19:00',
    breakfast: false,
    breakfastShare: 0,
    weekend: false,
    sizeFactor: 1.3,
    deliveryShare: 0.3,
    provenance: 'public',
  },
  {
    id: 'fj-fenchurch',
    name: 'Fenchurch Street',
    area: 'The City',
    opensAt: '11:00',
    closesAt: '19:00',
    breakfast: false,
    breakfastShare: 0,
    weekend: false,
    sizeFactor: 1.1,
    deliveryShare: 0.28,
    provenance: 'public',
  },
  {
    id: 'fj-strand',
    name: 'Strand',
    area: 'Shell Mex House',
    opensAt: '07:30',
    closesAt: '21:00',
    breakfast: true,
    breakfastShare: 0.15,
    weekend: true,
    sizeFactor: 1.05,
    deliveryShare: 0.22,
    provenance: 'public',
  },
  { id: 'fj-kings-cross',   name: "King's Cross",     area: 'Pancras Square',  opensAt: '07:30', closesAt: '21:00', breakfast: true,  breakfastShare: 0.2,  weekend: true,  sizeFactor: 1.2,  deliveryShare: 0.22, provenance: 'demo-modelled' },
  { id: 'fj-canary-wharf',  name: 'Canary Wharf',     area: 'Jubilee Place',   opensAt: '07:30', closesAt: '20:00', breakfast: true,  breakfastShare: 0.18, weekend: false, sizeFactor: 1.35, deliveryShare: 0.3,  provenance: 'demo-modelled' },
  { id: 'fj-liverpool-st',  name: 'Liverpool Street', area: 'Broadgate',       opensAt: '11:00', closesAt: '19:00', breakfast: false, breakfastShare: 0,    weekend: false, sizeFactor: 1.15, deliveryShare: 0.32, provenance: 'demo-modelled' },
  { id: 'fj-victoria',      name: 'Victoria',         area: 'Cardinal Place',  opensAt: '07:30', closesAt: '21:00', breakfast: true,  breakfastShare: 0.17, weekend: true,  sizeFactor: 1.0,  deliveryShare: 0.24, provenance: 'demo-modelled' },
  { id: 'fj-st-pauls',      name: "St Paul's",        area: 'One New Change',  opensAt: '11:00', closesAt: '19:00', breakfast: false, breakfastShare: 0,    weekend: true,  sizeFactor: 0.95, deliveryShare: 0.26, provenance: 'demo-modelled' },
  { id: 'fj-moorgate',      name: 'Moorgate',         area: 'The City',        opensAt: '11:00', closesAt: '19:00', breakfast: false, breakfastShare: 0,    weekend: false, sizeFactor: 0.9,  deliveryShare: 0.3,  provenance: 'demo-modelled' },
  { id: 'fj-holborn',       name: 'Holborn',          area: 'High Holborn',    opensAt: '08:00', closesAt: '20:00', breakfast: true,  breakfastShare: 0.1,  weekend: false, sizeFactor: 0.95, deliveryShare: 0.27, provenance: 'demo-modelled' },
  { id: 'fj-bank',          name: 'Bank',             area: 'Cornhill',        opensAt: '11:00', closesAt: '19:00', breakfast: false, breakfastShare: 0,    weekend: false, sizeFactor: 1.05, deliveryShare: 0.3,  provenance: 'demo-modelled' },
  { id: 'fj-london-bridge', name: 'London Bridge',    area: 'More London',     opensAt: '07:30', closesAt: '20:00', breakfast: true,  breakfastShare: 0.15, weekend: true,  sizeFactor: 1.1,  deliveryShare: 0.25, provenance: 'demo-modelled' },
  { id: 'fj-oxford-circus', name: 'Oxford Circus',    area: 'Great Portland St', opensAt: '08:00', closesAt: '21:00', breakfast: true, breakfastShare: 0.1, weekend: true,  sizeFactor: 1.25, deliveryShare: 0.28, provenance: 'demo-modelled' },
  { id: 'fj-waterloo',      name: 'Waterloo',         area: 'Southbank',       opensAt: '07:30', closesAt: '21:00', breakfast: true,  breakfastShare: 0.18, weekend: true,  sizeFactor: 1.1,  deliveryShare: 0.2,  provenance: 'demo-modelled' },
  { id: 'fj-soho',          name: 'Soho',             area: 'Berwick Street',  opensAt: '11:00', closesAt: '21:00', breakfast: false, breakfastShare: 0,    weekend: true,  sizeFactor: 0.9,  deliveryShare: 0.35, provenance: 'demo-modelled' },
  { id: 'fj-kensington',    name: 'Kensington',       area: 'High Street Ken', opensAt: '08:00', closesAt: '21:00', breakfast: true,  breakfastShare: 0.12, weekend: true,  sizeFactor: 0.85, deliveryShare: 0.3,  provenance: 'demo-modelled' },
  { id: 'fj-shoreditch',    name: 'Shoreditch',       area: 'Old Street',      opensAt: '08:00', closesAt: '21:00', breakfast: true,  breakfastShare: 0.1,  weekend: true,  sizeFactor: 0.9,  deliveryShare: 0.38, provenance: 'demo-modelled' },
];

/** Meta persona for Jana: every shop at once. */
export const FJ_ALL_SHOPS_ID = 'fj-all-shops';

/** The shop the demo opens on. Its sales day is the real export. */
export const FJ_DEFAULT_SHOP_ID = 'fj-marylebone';

export function getShop(id: ShopId): Shop | undefined {
  return FJ_SHOPS.find(s => s.id === id);
}

export function isFarmerJShopId(id: string): boolean {
  return id === FJ_ALL_SHOPS_ID || FJ_SHOPS.some(s => s.id === id);
}

/** Caption shown under the shop name in the site switcher. */
export function shopCaption(shop: Shop): string {
  const hours = `${shop.opensAt.replace(/^0/, '')} to ${shop.closesAt}`;
  const days = shop.weekend ? '7 days' : 'Mon to Fri';
  const bf = shop.breakfast ? ' · Breakfast' : '';
  return `${shop.area} · ${hours} · ${days}${bf}`;
}
