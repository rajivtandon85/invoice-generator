import { useRef } from 'react';

const MAX_ROWS = 20;

function formatAmount(amount) {
  const rupees = Math.floor(amount);
  const paise  = Math.round((amount - rupees) * 100);
  return { rupees, paise };
}

const HEADER_FIELDS = ['billNo', 'date', 'challanNo', 'dispatchThrough', 'poNo', 'ms', 'address1', 'address2'];
const HEADER_PLACEHOLDERS = {
  billNo: 'Bill No.', date: 'DD/MM/YYYY', challanNo: 'Challan No.',
  dispatchThrough: 'Dispatch Through', poNo: 'P.O. No',
  ms: 'M/s', address1: 'Address line 1', address2: 'Address line 2',
};
const COL_KEYS = ['sno', 'particulars', 'qty', 'rate', 'amountRs', 'amountP'];
const COL_ALIGN = { sno: 'center', particulars: 'left', qty: 'center', rate: 'right', amountRs: 'right', amountP: 'right' };
const COL_PLACEHOLDER = { sno: '', particulars: 'Particulars', qty: 'Qty', rate: 'Rate', amountRs: '0', amountP: '00' };
const COL_INPUT_MODE = { rate: 'decimal', particulars: undefined, sno: undefined };

function InvoicePage({
  pageIndex, calibration, layout, font, dragMode,
  onLayoutMove, onLayoutResize,
  billNo, date, challanNo, dispatchThrough, poNo, ms, address1, address2,
  lineItems, pageTotalRs, pageTotalP, pageAmountWords,
  fieldStyles = {},
  onFieldChange, onFieldFocus, onRemoveRow, onRowFocus, onUpdateLineItem,
  isContinued = false,
}) {
  const a4Ref = useRef(null);
  const onLayoutMoveRef   = useRef(onLayoutMove);   onLayoutMoveRef.current   = onLayoutMove;
  const onLayoutResizeRef = useRef(onLayoutResize); onLayoutResizeRef.current = onLayoutResize;

  const cal  = calibration;
  const li   = layout.lineItems;
  const cols = li.columns;

  const headerValues = { billNo, date, challanNo, dispatchThrough, poNo, ms, address1, address2 };

  const pos = (field) => ({
    position: 'absolute',
    left:  `${layout[field].left  + cal.left}mm`,
    top:   `${layout[field].top   + cal.top}mm`,
    width: `${layout[field].width}mm`,
  });

  const rowTop = (index) => li.firstRowTop + index * li.rowHeight + cal.top;

  const colAbsPos = (colKey, rowIndex, align) => ({
    position: 'absolute',
    left:      `${cols[colKey].left  + cal.left}mm`,
    top:       `${rowTop(rowIndex)}mm`,
    width:     `${cols[colKey].width}mm`,
    height:    `${li.rowHeight}mm`,
    textAlign: align || 'left',
  });

  // ── Right-edge (width) resize handle ──────────────────────────────────────
  const rHandle = (fieldKey, leftMm, topMm, heightMm) =>
    dragMode ? (
      <div
        data-resize-key={fieldKey}
        className="field-resize-handle"
        style={{ left: `${leftMm}mm`, top: `${topMm}mm`, height: `${heightMm}mm` }}
      />
    ) : null;

  // ── Bottom-edge (row height) resize handle ────────────────────────────────
  const rHandleBottom = (leftMm, topMm, widthMm) =>
    dragMode ? (
      <div
        data-resize-height-key="row_height"
        className="field-resize-handle-bottom"
        style={{ left: `${leftMm}mm`, top: `${topMm}mm`, width: `${widthMm}mm` }}
      />
    ) : null;

  // ── Unified mousedown handler ──────────────────────────────────────────────
  function handleA4MouseDown(e) {
    if (!dragMode) return;
    const a4El = a4Ref.current;
    if (!a4El) return;

    const rect     = a4El.getBoundingClientRect();
    const pxPerMmX = rect.width  / 210;
    const pxPerMmY = rect.height / 297;

    // ── Height resize (bottom handle) ──
    const resizeHEl = e.target.closest('[data-resize-height-key]');
    if (resizeHEl) {
      e.preventDefault();
      let prevY = e.clientY, accH = 0;
      const rowCells  = [...a4El.querySelectorAll('[data-row-cell]')];
      const handleEl  = resizeHEl;

      function onMove(ev) {
        const dH = (ev.clientY - prevY) / pxPerMmY;
        if (dH === 0) return;
        accH += dH; prevY = ev.clientY;
        rowCells.forEach(el => {
          const cur = parseFloat(el.style.height) || 0;
          el.style.height = `${Math.max(4, cur + dH)}mm`;
        });
        handleEl.style.top = `${parseFloat(handleEl.style.top) + dH}mm`;
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        const dH = Math.round(accH * 10) / 10;
        if (dH !== 0) onLayoutResizeRef.current('row_height', dH);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      return;
    }

    // ── Width resize (right handle) ──
    const resizeEl = e.target.closest('[data-resize-key]');
    if (resizeEl) {
      const fieldKey = resizeEl.getAttribute('data-resize-key');
      e.preventDefault();
      let prevX = e.clientX, accW = 0;

      const widthTargets = fieldKey.startsWith('col_')
        ? [...a4El.querySelectorAll(`[data-drag-key="${fieldKey}"]`)]
        : [a4El.querySelector(`[data-drag-key="${fieldKey}"]`)].filter(Boolean);
      const handleEls = [...a4El.querySelectorAll(`[data-resize-key="${fieldKey}"]`)];

      function onMove(ev) {
        const dW = (ev.clientX - prevX) / pxPerMmX;
        if (dW === 0) return;
        accW += dW; prevX = ev.clientX;
        widthTargets.forEach(el => { el.style.width = `${Math.max(5, parseFloat(el.style.width) + dW)}mm`; });
        handleEls.forEach(el    => { el.style.left  = `${parseFloat(el.style.left) + dW}mm`; });
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        const dW = Math.round(accW * 10) / 10;
        if (dW !== 0) onLayoutResizeRef.current(fieldKey, dW);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      return;
    }

    // ── Move/drag ──
    const target = e.target.closest('[data-drag-key]');
    if (!target) return;
    const fieldKey = target.getAttribute('data-drag-key');
    e.preventDefault();

    let prevX = e.clientX, prevY = e.clientY, accL = 0, accT = 0;

    const domTargets = fieldKey.startsWith('col_')
      ? [...a4El.querySelectorAll(`[data-drag-key="${fieldKey}"]`)]
      : [target];

    function onMove(ev) {
      const dL = (ev.clientX - prevX) / pxPerMmX;
      const dT = (ev.clientY - prevY) / pxPerMmY;
      if (dL === 0 && dT === 0) return;
      accL += dL; accT += dT; prevX = ev.clientX; prevY = ev.clientY;
      domTargets.forEach(el => {
        el.style.left = `${parseFloat(el.style.left) + dL}mm`;
        el.style.top  = `${parseFloat(el.style.top)  + dT}mm`;
      });
      // Move resize handles along with header fields
      if (!fieldKey.startsWith('col_')) {
        a4El.querySelectorAll(`[data-resize-key="${fieldKey}"]`).forEach(el => {
          el.style.left = `${parseFloat(el.style.left) + dL}mm`;
          el.style.top  = `${parseFloat(el.style.top)  + dT}mm`;
        });
      }
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const dL = Math.round(accL * 10) / 10;
      const dT = Math.round(accT * 10) / 10;
      if (dL !== 0 || dT !== 0) onLayoutMoveRef.current(fieldKey, dL, dT);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  const dragCls  = dragMode ? 'invoice-field drag-enabled' : 'invoice-field';
  const dragAttr = (key) => dragMode ? { 'data-drag-key': key } : {};

  // Per-field style override (inline CSS, takes precedence over CSS variables)
  const fStyle = (key) => {
    const fs = fieldStyles[key];
    if (!fs) return {};
    return {
      ...(fs.family  !== undefined && { fontFamily:  fs.family }),
      ...(fs.size    !== undefined && { fontSize:    `${fs.size}pt` }),
      ...(fs.bold    !== undefined && { fontWeight:  fs.bold   ? 'bold'   : 'normal' }),
      ...(fs.italic  !== undefined && { fontStyle:   fs.italic ? 'italic' : 'normal' }),
    };
  };

  const fontStyle = {
    '--field-font-family': font?.family ?? 'Arial',
    '--field-font-size':   `${font?.size ?? 11}pt`,
    '--field-font-weight': font?.bold   ? 'bold'   : 'normal',
    '--field-font-style':  font?.italic ? 'italic' : 'normal',
  };

  // Bottom of last line-item row — where the row-height resize handle sits
  const lastRowIdx  = Math.max(lineItems.length - 1, 0);
  const tableBottom = rowTop(lastRowIdx) + li.rowHeight;
  const tableLeft   = cols.sno.left + cal.left;
  const tableWidth  = (cols.amountP.left + cols.amountP.width) - cols.sno.left;

  return (
    <div className="invoice-page-wrapper">
      <div className="invoice-a4" ref={a4Ref} onMouseDown={handleA4MouseDown} style={fontStyle}>
        <div className="invoice-guide"><InvoiceGuideLayer /></div>

        {/* ── Header fields ── */}
        {HEADER_FIELDS.map((field) => (
          <input key={field} type="text" className={dragCls}
            style={{ ...pos(field), ...fStyle(field) }} {...dragAttr(field)}
            value={headerValues[field]} readOnly={dragMode}
            placeholder={HEADER_PLACEHOLDERS[field]}
            onChange={dragMode ? undefined : (e) => onFieldChange(pageIndex, field, e.target.value)}
            onFocus={dragMode ? undefined : () => onFieldFocus(pageIndex, field)} />
        ))}

        {/* Resize handles for header fields */}
        {HEADER_FIELDS.map((field) =>
          rHandle(field, layout[field].left + layout[field].width + cal.left - 1.5, layout[field].top + cal.top, 5)
        )}

        {/* ── Line item rows ── */}
        {lineItems.map((item, index) => (
          <div key={index}>
            {/* sno — auto-numbered but editable */}
            <input type="text" className={dragCls}
              style={{ ...colAbsPos('sno', index, 'center'), ...fStyle('col_sno') }}
              {...dragAttr('col_sno')}
              data-row-cell="1"
              value={item.sno ?? String(index + 1)}
              readOnly={dragMode}
              placeholder={String(index + 1)}
              onChange={dragMode ? undefined : (e) => onUpdateLineItem(pageIndex, index, 'sno', e.target.value)}
              onFocus={dragMode ? undefined : () => { onRowFocus(pageIndex, index); onFieldFocus(pageIndex, 'col_sno'); }}
            />

            {/* particulars — textarea for multi-line support */}
            <textarea
              className={dragCls}
              style={{ ...colAbsPos('particulars', index, 'left'), ...fStyle('col_particulars'), resize: 'none', overflow: 'hidden' }}
              {...dragAttr('col_particulars')}
              data-row-cell="1"
              value={item.particulars ?? ''}
              readOnly={dragMode}
              placeholder={dragMode ? '' : 'Particulars'}
              onChange={dragMode ? undefined : (e) => onUpdateLineItem(pageIndex, index, 'particulars', e.target.value)}
              onFocus={dragMode ? undefined : () => { onRowFocus(pageIndex, index); onFieldFocus(pageIndex, 'col_particulars'); }}
              onKeyDown={dragMode ? undefined : (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Backspace') {
                  e.preventDefault();
                  onRemoveRow(pageIndex, index);
                }
              }}
            />

            {/* qty, rate, amountRs, amountP */}
            {['qty', 'rate', 'amountRs', 'amountP'].map((col) => (
              <input key={col} type="text"
                inputMode={COL_INPUT_MODE[col] ?? 'numeric'}
                className={dragCls}
                style={{ ...colAbsPos(col, index, COL_ALIGN[col]), ...fStyle(`col_${col}`) }}
                {...dragAttr(`col_${col}`)}
                data-row-cell="1"
                value={item[col] ?? ''}
                readOnly={dragMode}
                placeholder={dragMode ? '' : COL_PLACEHOLDER[col]}
                onChange={dragMode ? undefined : (e) => onUpdateLineItem(pageIndex, index, col, e.target.value)}
                onFocus={dragMode ? undefined : () => { onRowFocus(pageIndex, index); onFieldFocus(pageIndex, `col_${col}`); }}
                onKeyDown={dragMode ? undefined : (e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Backspace') {
                    e.preventDefault();
                    onRemoveRow(pageIndex, index);
                  }
                }}
              />
            ))}
          </div>
        ))}

        {/* Row-height resize handle — sits below the last row */}
        {dragMode && lineItems.length > 0 &&
          rHandleBottom(tableLeft, tableBottom, tableWidth)
        }

        {/* Width resize handles for columns — span full table height */}
        {dragMode && COL_KEYS.map((colKey) =>
          rHandle(`col_${colKey}`,
            cols[colKey].left + cols[colKey].width + cal.left - 1.5,
            rowTop(0),
            li.rowHeight * lineItems.length)
        )}

        {/* ── Total row ── (editable inputs, auto-filled from line amounts) */}
        <input type="text" inputMode="numeric" className={dragCls}
          style={{ ...pos('totalRs'), ...fStyle('totalRs'), textAlign: 'right', fontWeight: fStyle('totalRs').fontWeight ?? 'bold' }}
          {...dragAttr('totalRs')}
          value={pageTotalRs ?? ''} readOnly={dragMode} placeholder=""
          onChange={dragMode ? undefined : (e) => onFieldChange(pageIndex, 'totalRs', e.target.value)}
          onFocus={dragMode ? undefined : () => onFieldFocus(pageIndex, 'totalRs')} />

        <input type="text" inputMode="numeric" className={dragCls}
          style={{ ...pos('totalP'), ...fStyle('totalP'), textAlign: 'right', fontWeight: fStyle('totalP').fontWeight ?? 'bold' }}
          {...dragAttr('totalP')}
          value={pageTotalP ?? ''} readOnly={dragMode} placeholder=""
          onChange={dragMode ? undefined : (e) => onFieldChange(pageIndex, 'totalP', e.target.value)}
          onFocus={dragMode ? undefined : () => onFieldFocus(pageIndex, 'totalP')} />

        {rHandle('totalRs', layout.totalRs.left + layout.totalRs.width + cal.left - 1.5, layout.totalRs.top + cal.top, 5)}
        {rHandle('totalP',  layout.totalP.left  + layout.totalP.width  + cal.left - 1.5, layout.totalP.top  + cal.top, 5)}

        {/* ── Amount in words ── */}
        <textarea className={dragCls}
          style={{ ...pos('amountWords'), ...fStyle('amountWords'), height: '12mm', resize: 'none', overflow: 'hidden' }}
          {...dragAttr('amountWords')}
          value={pageAmountWords ?? ''} readOnly={dragMode}
          placeholder="Amount in words"
          onChange={dragMode ? undefined : (e) => onFieldChange(pageIndex, 'amountWords', e.target.value)}
          onFocus={dragMode ? undefined : () => onFieldFocus(pageIndex, 'amountWords')} />
        {rHandle('amountWords', layout.amountWords.left + layout.amountWords.width + cal.left - 1.5, layout.amountWords.top + cal.top, 5)}

        {isContinued && (
          <div className="no-print" style={{ position: 'absolute', top: '5mm', left: '50%', transform: 'translateX(-50%)', fontSize: '10pt', color: '#6B7280' }}>
            (Continued)
          </div>
        )}
      </div>
    </div>
  );
}

function InvoiceGuideLayer() {
  return (
    <img src="/sterling_invoice.png" alt=""
      style={{ width: '100%', height: '100%', objectFit: 'fill', filter: 'grayscale(1)' }} />
  );
}

export default InvoicePage;
export { formatAmount, MAX_ROWS };
