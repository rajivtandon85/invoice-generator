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

export const DEFAULT_LAYOUT = {
  // Bill info — row 1
  billNo:          { left: 28, top: 70, width: 42 },
  date:            { left: 93, top: 70, width: 35 },

  // Bill info — row 2
  challanNo:       { left: 28, top: 79, width: 42 },
  dispatchThrough: { left: 93, top: 79, width: 40 },
  poNo:            { left: 155, top: 79, width: 38 },

  // Client
  ms:              { left: 20, top: 87, width: 175 },
  address1:        { left: 22, top: 94, width: 173 },
  address2:        { left: 20, top: 102, width: 175 },

  // Line items table geometry
  lineItems: {
    firstRowTop: 120,
    rowHeight: 8.5,
    columns: {
      sno:         { left: 5,   width: 9  },
      particulars: { left: 16,  width: 93 },
      qty:         { left: 124, width: 16 },
      rate:        { left: 141, width: 27 },
      amountRs:    { left: 169, width: 14 },
      amountP:     { left: 185, width: 9  },
    },
  },

  // Totals
  totalRs:   { left: 169, top: 254, width: 14 },
  totalP:    { left: 185, top: 254, width: 9 },
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
];

export const LINE_ITEM_DEFS = [
  { key: 'particulars', label: 'Particulars' },
  { key: 'qty',         label: 'Qty' },
  { key: 'rate',        label: 'Rate' },
  { key: 'amountRs',    label: 'Amount Rs' },
  { key: 'amountP',     label: 'Amount P' },
];
