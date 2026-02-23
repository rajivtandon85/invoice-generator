/**
 * Default field positions (mm) for the Sterling Enterprises invoice.
 * Each field: { left, top, width } in mm from page top-left.
 * Line items use: firstRowTop, rowHeight, plus per-column left/width.
 *
 * These defaults are best-effort from the scanned invoice.
 * The user can override every value via the Field Tuning panel,
 * and overrides are persisted to localStorage.
 */

const LAYOUT_KEY = 'invoice-layout';

// Calibration offsets that were active when these positions were verified:
// left offset: +1mm, top offset: +2.5mm — baked in so PDF needs no runtime adjustment.
export const DEFAULT_LAYOUT = {
  // Bill info — row 1
  billNo:          { left: 31.1,  top: 58.5,  width: 37   },
  date:            { left: 84.7,  top: 57.7,  width: 35   },

  // Bill info — row 2
  challanNo:       { left: 35.9,  top: 66.5,  width: 32.5 },
  dispatchThrough: { left: 106.2, top: 66.1,  width: 33.4 },
  poNo:            { left: 160.5, top: 66.1,  width: 34.8 },

  // Client
  ms:              { left: 28.7,  top: 75.9,  width: 165.2 },
  address1:        { left: 29.5,  top: 96.9,  width: 164.8 },
  address2:        { left: 29.3,  top: 86.2,  width: 164.9 },

  // Line items table geometry
  lineItems: {
    firstRowTop: 122.9,
    rowHeight: 8.5,
    columns: {
      sno:         { left: 7.8,   width: 9     },
      particulars: { left: 20.3,  width: 101.2 },
      qty:         { left: 129.5, width: 13.2  },
      rate:        { left: 144.9, width: 17    },
      amountRs:    { left: 169.2, width: 19.4  },
      amountP:     { left: 192.7, width: 6.2   },
    },
  },

  // Totals
  totalRs:     { left: 165.7, top: 251.6, width: 21.5 },
  totalP:      { left: 191.9, top: 251.0, width: 5.9  },

  // Amount in words
  amountWords: { left: 17,    top: 245.4, width: 109.4 },
};

export function loadLayout() {
  try {
    const stored = localStorage.getItem(LAYOUT_KEY);
    if (stored) {
      return deepMerge(structuredClone(DEFAULT_LAYOUT), JSON.parse(stored));
    }
  } catch (_) {}
  return structuredClone(DEFAULT_LAYOUT);
}

export function saveLayout(layout) {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
}

export function resetLayout() {
  localStorage.removeItem(LAYOUT_KEY);
  return structuredClone(DEFAULT_LAYOUT);
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object'
    ) {
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

/** All tunable field keys (flat list for the tuning panel) */
export const FIELD_DEFS = [
  { key: 'billNo',          label: 'Bill No.' },
  { key: 'date',            label: 'Date' },
  { key: 'challanNo',       label: 'Challan No.' },
  { key: 'dispatchThrough', label: 'Dispatch Through' },
  { key: 'poNo',            label: 'P.O. No' },
  { key: 'ms',              label: 'M/s' },
  { key: 'address1',        label: 'Address line 1' },
  { key: 'address2',        label: 'Address line 2' },
  { key: 'totalRs',         label: 'Total Rs' },
  { key: 'totalP',          label: 'Total Paise' },
  { key: 'amountWords',     label: 'Amount in Words' },
];

export const LINE_ITEM_DEFS = [
  { key: 'particulars', label: 'Particulars' },
  { key: 'qty',         label: 'Qty' },
  { key: 'rate',        label: 'Rate' },
  { key: 'amountRs',    label: 'Amount Rs' },
  { key: 'amountP',     label: 'Amount P' },
];
