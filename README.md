# Sterling Enterprises Invoice Generator

A React + Vite web app for typing invoice data that prints **only the data fields**, precisely positioned to align with a pre-printed Sterling Enterprises Tax Invoice A4 sheet.

---

## How to Run

```bash
npm install
npm run dev
```

Open http://localhost:5173

---

## What It Does

- Shows the real scanned Sterling Enterprises invoice as a faded background guide (opacity 0.18, grayscale)
- Editable fields (light blue) sit over the blank spaces on the form
- On print: only data text is output, no borders/background — the physical pre-printed paper provides those
- Positions stored in localStorage so field layout persists across sessions

---

## Buttons

| Button | What it does |
|---|---|
| 🖨 Print | Prints only the data fields |
| ➕ Add Row | Adds a new line item row |
| 🗑 Clear All | Clears all fields (with confirm) |
| 💾 Save | Saves draft to localStorage |
| 📂 Load | Loads saved draft |
| ⚙ Alignment | Global top/left offset slider — shifts ALL fields together for printer calibration |
| ↕ Adjust Fields | Drag mode — drag individual fields to reposition |

---

## Drag Mode (Field Positioning)

Click **↕ Adjust Fields** to enter drag mode. Fields turn orange-dashed.

- **Header fields** (Bill No, Date, M/s, Address etc): drag freely in X and Y
- **Line item columns** (Particulars, Qty, Rate, Amount): drag horizontally moves that column's left position; drag vertically is supposed to move the entire table up/down by changing `firstRowTop`
- Click button again to exit drag mode
- "Reset positions" restores all defaults

### ⚠️ Known Bug — Vertical Drag on Line Item Columns Does Not Work

Dragging line item column fields (Particulars, Qty, Rate, Amount Rs, Amount P) **horizontally works** correctly. **Vertical drag does not move the table** despite multiple implementation attempts.

**What has been tried:**
1. Custom `useDrag` hook with `useCallback` — horizontal worked, vertical didn't
2. Ref-based `onMoveRef` pattern to avoid stale closures — still failed vertically
3. Removing the wrapper `<div>` around each row so fields are directly on the A4 — no change
4. Event delegation: single `onMouseDown` on the `.invoice-a4` container with `data-drag-key` attributes on fields — still fails

**The logic that should work** (in `InvoiceGenerator.jsx`, `onLayoutMove`):
```js
if (fieldKey.startsWith('col_')) {
  const colKey = fieldKey.slice(4);
  const col = next.lineItems.columns[colKey];
  if (col) col.left = +(col.left + dLeft).toFixed(1);      // ← works
  if (dTop !== 0) {
    next.lineItems.firstRowTop = +(next.lineItems.firstRowTop + dTop).toFixed(1); // ← doesn't update visually
  }
  return next;
}
```

**Where `firstRowTop` is consumed** (in `InvoicePage.jsx`):
```js
const li = layout.lineItems;
const rowTop = (index) => li.firstRowTop + index * li.rowHeight + cal.top;
const colAbsPos = (colKey, rowIndex, align) => ({
  position: 'absolute',
  top: `${rowTop(rowIndex)}mm`,   // ← this should change when firstRowTop changes
  left: `${cols[colKey].left + cal.left}mm`,
  width: `${cols[colKey].width}mm`,
  ...
});
```

**Suspected cause:** When `setLayout` fires and React re-renders, something prevents the new `top` value from applying to line item fields. Header fields (which have their own `top` in the layout object) update fine. Only `firstRowTop` (shared table geometry) fails to propagate visually. The `dTopMm` delta is computed correctly (verified by the horizontal path working with the same delta logic).

---

## File Structure

```
src/
  App.jsx               — entry, renders InvoiceGenerator
  InvoiceGenerator.jsx  — top-level state: pages, layout, calibration, drag mode
  InvoicePage.jsx       — renders one A4 page; drag event delegation via onMouseDown on .invoice-a4
  layoutConfig.js       — DEFAULT_LAYOUT (all field positions in mm), load/save/reset to localStorage
  invoice.css           — print styles, .invoice-field, .drag-enabled, @page A4
  index.css             — Tailwind import
public/
  sterling_invoice.png  — scanned Sterling Enterprises invoice used as background guide
```

---

## Layout Config (`layoutConfig.js`)

All positions are in mm from the top-left of the A4 page.

```js
DEFAULT_LAYOUT = {
  billNo:          { left: 28, top: 47, width: 42 },
  date:            { left: 93, top: 47, width: 35 },
  challanNo:       { left: 28, top: 54, width: 42 },
  dispatchThrough: { left: 93, top: 54, width: 40 },
  poNo:            { left: 155, top: 54, width: 38 },
  ms:              { left: 20, top: 63, width: 175 },
  address1:        { left: 22, top: 70, width: 173 },
  address2:        { left: 20, top: 77, width: 175 },
  lineItems: {
    firstRowTop: 92,   // ← top of the first data row in mm
    rowHeight: 8.5,    // ← height of each row in mm
    columns: {
      particulars: { left: 20, width: 93 },
      qty:         { left: 116, width: 18 },
      rate:        { left: 136, width: 22 },
      amountRs:    { left: 160, width: 22 },
      amountP:     { left: 183, width: 12 },
    },
  },
  totalRs: { left: 160, top: 272, width: 22 },
  totalP:  { left: 183, top: 272, width: 12 },
}
```

---

## Print Behaviour

- `@media print`: hides all UI chrome (`.no-print`), guide image, field borders/backgrounds
- `@page { size: A4 portrait; margin: 0; }`
- All fields use `position: absolute` with mm units
- Global calibration offset (from ⚙ Alignment slider) adds to every field's left/top at render time

---

## Tech Stack

- React 19 + Vite 7
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- No external drag libraries
- `window.print()` for printing
- `localStorage` for draft data and field layout
