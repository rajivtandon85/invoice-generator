import { useState, useCallback, useEffect } from 'react';
import InvoicePage, { MAX_ROWS } from './InvoicePage';
import { loadLayout, saveLayout, resetLayout, DEFAULT_LAYOUT } from './layoutConfig';
import './invoice.css';

const CALIBRATION_KEY = 'invoice-calibration';
const DRAFT_KEY       = 'invoice-draft';
const FONT_KEY        = 'invoice-font';

// ── Number to words (Indian system: lakhs & crores) ───────────────────────
const _ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
               'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
               'Seventeen', 'Eighteen', 'Nineteen'];
const _TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function _toWords(n) {
  if (n === 0) return '';
  if (n < 20)  return _ONES[n];
  if (n < 100) return _TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + _ONES[n % 10] : '');
  if (n < 1000)      return _ONES[Math.floor(n / 100)]   + ' Hundred'   + (n % 100   ? ' ' + _toWords(n % 100)   : '');
  if (n < 100000)    return _toWords(Math.floor(n / 1000))    + ' Thousand' + (n % 1000    ? ' ' + _toWords(n % 1000)    : '');
  if (n < 10000000)  return _toWords(Math.floor(n / 100000))  + ' Lakh'     + (n % 100000  ? ' ' + _toWords(n % 100000)  : '');
  return               _toWords(Math.floor(n / 10000000)) + ' Crore'    + (n % 10000000 ? ' ' + _toWords(n % 10000000) : '');
}

function amountToWords(rs, p) {
  const rsNum = parseInt(rs) || 0;
  const pNum  = parseInt(p)  || 0;
  if (rsNum === 0 && pNum === 0) return '';
  let out = 'Rupees ' + (_toWords(rsNum) || 'Zero');
  if (pNum > 0) out += ' and ' + _toWords(pNum) + ' Paise';
  return out + ' Only';
}

const emptyRow = (index = 0) => ({
  sno: String(index + 1), particulars: '', qty: '', rate: '', amountRs: '', amountP: '',
});

const emptyPage = () => ({
  billNo: '', date: '', challanNo: '', dispatchThrough: '', poNo: '',
  ms: '', address1: '', address2: '',
  lineItems: [emptyRow(0)],
  totalRs: '', totalP: '', amountWords: '',
  fieldStyles: {}, // per-field font overrides keyed by field name / col_xxx
});

const FIELD_LABELS = {
  billNo: 'Bill No.', date: 'Date', challanNo: 'Challan No.',
  dispatchThrough: 'Dispatch Through', poNo: 'P.O. No',
  ms: 'M/s', address1: 'Address 1', address2: 'Address 2',
  totalRs: 'Total Rs', totalP: 'Total Paise', amountWords: 'Amount in Words',
  col_sno: 'S.No column', col_particulars: 'Particulars column',
  col_qty: 'Qty column', col_rate: 'Rate column',
  col_amountRs: 'Amount Rs column', col_amountP: 'Amount P column',
};

function loadCalibration() {
  try { const s = localStorage.getItem(CALIBRATION_KEY); if (s) { const { top, left } = JSON.parse(s); return { top: top ?? 0, left: left ?? 0 }; } } catch (_) {}
  return { top: 0, left: 0 };
}
function loadFont() {
  try { const s = localStorage.getItem(FONT_KEY); return s ? JSON.parse(s) : { family: 'Arial', size: 11, bold: false, italic: false }; } catch (_) {}
  return { family: 'Arial', size: 11, bold: false, italic: false };
}
function loadDraft() {
  try { const s = localStorage.getItem(DRAFT_KEY); if (s) return JSON.parse(s); } catch (_) {}
  return null;
}

function InvoiceGenerator() {
  const [calibration, setCalibration] = useState(loadCalibration);
  const [layout, setLayout]           = useState(loadLayout);
  const [font, setFont]               = useState(loadFont);
  const [showCalibration, setShowCalibration] = useState(false);
  const [showFont, setShowFont]       = useState(false);
  const [dragMode, setDragMode]       = useState(false);
  const [pages, setPages]             = useState(() => {
    const draft = loadDraft() || [emptyPage()];
    return draft.map(p => ({
      ...p,
      amountWords:  p.amountWords  || amountToWords(p.totalRs, p.totalP),
      fieldStyles:  p.fieldStyles  || {},
    }));
  });
  const [activeRow, setActiveRow]       = useState(null);
  const [focusedField, setFocusedField] = useState(null); // { pageIndex, key }
  const [pdfDownloading, setPdfDownloading] = useState(false);

  useEffect(() => { localStorage.setItem(CALIBRATION_KEY, JSON.stringify(calibration)); }, [calibration]);
  useEffect(() => { saveLayout(layout); }, [layout]);
  useEffect(() => { localStorage.setItem(FONT_KEY, JSON.stringify(font)); }, [font]);
  useEffect(() => { localStorage.setItem(DRAFT_KEY, JSON.stringify(pages)); }, [pages]);

  // Responsive scale: shrink A4 (794px wide) to fit the viewport on mobile/tablet
  const [pageScale, setPageScale] = useState(() => Math.min(1, (window.innerWidth - 16) / 794));
  useEffect(() => {
    const update = () => setPageScale(Math.min(1, (window.innerWidth - 16) / 794));
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const onFieldChange = useCallback((pageIndex, field, value) => {
    setPages(prev => prev.map((p, i) => {
      if (i !== pageIndex) return p;
      const updated = { ...p, [field]: value };
      if (field === 'totalRs' || field === 'totalP') {
        const rs = field === 'totalRs' ? value : p.totalRs;
        const pa = field === 'totalP'  ? value : p.totalP;
        updated.amountWords = amountToWords(rs, pa);
      }
      return updated;
    }));
  }, []);

  const onAddRow = useCallback((pageIndex) => {
    setPages(prev => prev.map((p, i) => {
      if (i !== pageIndex || p.lineItems.length >= MAX_ROWS) return p;
      return { ...p, lineItems: [...p.lineItems, emptyRow(p.lineItems.length)] };
    }));
  }, []);

  const onRemoveRow = useCallback((pageIndex, rowIndex) => {
    setPages(prev => prev.map((p, i) => {
      if (i !== pageIndex) return p;
      const next = p.lineItems
        .filter((_, j) => j !== rowIndex)
        .map((item, newIdx) => ({ ...item, sno: String(newIdx + 1) }));
      return { ...p, lineItems: next.length ? next : [emptyRow(0)] };
    }));
    setActiveRow(null);
  }, []);

  const onRemovePage = useCallback((pageIndex) => {
    setPages(prev => prev.filter((_, i) => i !== pageIndex));
  }, []);

  const onRowFocus = useCallback((pageIndex, rowIndex) => {
    setActiveRow({ pageIndex, rowIndex });
  }, []);

  const onFieldFocus = useCallback((pageIndex, key) => {
    setFocusedField({ pageIndex, key });
  }, []);

  const onFieldStyleChange = useCallback((prop, value) => {
    if (focusedField) {
      setPages(prev => prev.map((p, i) => {
        if (i !== focusedField.pageIndex) return p;
        const fs = p.fieldStyles || {};
        return { ...p, fieldStyles: { ...fs, [focusedField.key]: { ...(fs[focusedField.key] || {}), [prop]: value } } };
      }));
    } else {
      setFont(f => ({ ...f, [prop]: value }));
    }
  }, [focusedField]);

  const onClearFieldStyle = useCallback(() => {
    if (!focusedField) return;
    setPages(prev => prev.map((p, i) => {
      if (i !== focusedField.pageIndex) return p;
      const fs = { ...p.fieldStyles };
      delete fs[focusedField.key];
      return { ...p, fieldStyles: fs };
    }));
  }, [focusedField]);

  const onUpdateLineItem = useCallback((pageIndex, rowIndex, field, value) => {
    setPages(prev => prev.map((p, i) => {
      if (i !== pageIndex) return p;
      const newItems = p.lineItems.map((item, j) => {
        if (j !== rowIndex) return item;
        const updated = { ...item, [field]: value };
        if (field === 'qty' || field === 'rate') {
          const qty    = parseFloat(field === 'qty'  ? value : item.qty)  || 0;
          const rate   = parseFloat(field === 'rate' ? value : item.rate) || 0;
          const amount = qty * rate;
          const rupees = Math.floor(amount);
          const paise  = Math.round((amount - rupees) * 100);
          updated.amountRs = amount > 0 ? String(rupees) : '';
          updated.amountP  = paise  > 0 ? String(paise) : amount > 0 ? '00' : '';
        }
        return updated;
      });
      const total       = newItems.reduce((acc, it) => acc + (parseFloat(it.amountRs) || 0) + (parseFloat(it.amountP) || 0) / 100, 0);
      const totalRupees = Math.floor(total);
      const totalPaise  = Math.round((total - totalRupees) * 100);
      return { ...p, lineItems: newItems,
        totalRs: total > 0 ? String(totalRupees) : '',
        totalP:  totalPaise > 0 ? String(totalPaise) : total > 0 ? '00' : '',
        amountWords: amountToWords(total > 0 ? totalRupees : 0, totalPaise > 0 ? totalPaise : 0),
      };
    }));
  }, []);

  const onLayoutMove = useCallback((fieldKey, dLeft, dTop) => {
    setLayout(prev => {
      const next = structuredClone(prev);
      if (fieldKey.startsWith('col_')) {
        const col = next.lineItems.columns[fieldKey.slice(4)];
        if (col) col.left = +(col.left + dLeft).toFixed(1);
        if (dTop !== 0) next.lineItems.firstRowTop = +(next.lineItems.firstRowTop + dTop).toFixed(1);
      } else {
        const field = next[fieldKey];
        if (field) { field.left = +(field.left + dLeft).toFixed(1); field.top = +(field.top + dTop).toFixed(1); }
      }
      return next;
    });
  }, []);

  const onLayoutResize = useCallback((fieldKey, dValue) => {
    setLayout(prev => {
      const next = structuredClone(prev);
      if (fieldKey === 'row_height') {
        next.lineItems.rowHeight = Math.max(5, +(next.lineItems.rowHeight + dValue).toFixed(1));
      } else if (fieldKey.startsWith('col_')) {
        const col = next.lineItems.columns[fieldKey.slice(4)];
        if (col) col.width = Math.max(4, +(col.width + dValue).toFixed(1));
      } else {
        const field = next[fieldKey];
        if (field) field.width = Math.max(4, +(field.width + dValue).toFixed(1));
      }
      return next;
    });
  }, []);

  async function handleDownloadPDF() {
    if (pdfDownloading) return;
    setPdfDownloading(true);

    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ format: 'a4', unit: 'mm' });

      // Load background image into a canvas data URL
      const bgDataUrl = await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          resolve(c.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = '/sterling_invoice.png';
      });

      // Map web font names to jsPDF built-in fonts
      const fontMap = { 'Arial': 'helvetica', 'Times New Roman': 'times', 'Courier New': 'courier', 'Georgia': 'times', 'Verdana': 'helvetica' };

      // Apply effective font for a given field key (global defaults + per-field override)
      const applyFont = (fieldStyles, key, forceBold = false) => {
        const fs  = fieldStyles?.[key] || {};
        const fam = fs.family  !== undefined ? fs.family  : font.family;
        const sz  = fs.size    !== undefined ? fs.size    : font.size;
        const bd  = forceBold  ? true : (fs.bold !== undefined ? fs.bold : font.bold);
        const it  = fs.italic  !== undefined ? fs.italic  : font.italic;
        pdf.setFont(fontMap[fam] || 'helvetica', bd && it ? 'bolditalic' : bd ? 'bold' : it ? 'italic' : 'normal');
        pdf.setFontSize(sz);
        return sz * 0.3528 * 0.72; // baseline offset in mm
      };

      const cal  = { left: 0, top: 0 };
      const li   = DEFAULT_LAYOUT.lineItems;
      const cols = li.columns;

      pages.forEach((page, pageIdx) => {
        if (pageIdx > 0) pdf.addPage();

        // Layer 1 — pre-printed form
        pdf.addImage(bgDataUrl, 'PNG', 0, 0, 210, 297);

        // Layer 2 — typed text
        pdf.setTextColor(0, 0, 0);
        const fs = page.fieldStyles || {};

        const put = (value, x, y, align = 'left', maxWidth) => {
          if (!value && value !== 0) return;
          const opts = { align };
          if (maxWidth) opts.maxWidth = maxWidth;
          pdf.text(String(value), x, y, opts);
        };

        // Header fields — each gets its own font
        const hf = (key, align = 'left') => {
          const f = DEFAULT_LAYOUT[key]; if (!f || !page[key]) return;
          const bo = applyFont(fs, key);
          const x = align === 'right'  ? f.left + cal.left + f.width
                  : align === 'center' ? f.left + cal.left + f.width / 2
                  :                      f.left + cal.left;
          put(page[key], x, f.top + cal.top + bo, align);
        };
        hf('billNo'); hf('date'); hf('challanNo'); hf('dispatchThrough'); hf('poNo');
        hf('ms'); hf('address1'); hf('address2');

        // Line item rows — each column uses its own font
        page.lineItems.forEach((item, idx) => {
          const colKeys = ['sno', 'particulars', 'qty', 'rate', 'amountRs', 'amountP'];
          colKeys.forEach(col => {
            if (!item[col]) return;
            const bo  = applyFont(fs, `col_${col}`);
            const c   = cols[col];
            const y   = li.firstRowTop + idx * li.rowHeight + cal.top + bo;
            const al  = col === 'particulars' ? 'left' : (col === 'sno' || col === 'qty') ? 'center' : 'right';
            const x   = al === 'right'  ? c.left + cal.left + c.width
                      : al === 'center' ? c.left + cal.left + c.width / 2
                      :                   c.left + cal.left;
            put(item[col], x, y, al, col === 'particulars' ? c.width : undefined);
          });
        });

        // Totals — bold by default
        const trs = DEFAULT_LAYOUT.totalRs;
        const tp  = DEFAULT_LAYOUT.totalP;
        let bo = applyFont(fs, 'totalRs', true);
        put(page.totalRs, trs.left + cal.left + trs.width, trs.top + cal.top + bo, 'right');
        bo = applyFont(fs, 'totalP', true);
        put(page.totalP, tp.left + cal.left + tp.width, tp.top + cal.top + bo, 'right');

        // Amount in words
        if (page.amountWords && DEFAULT_LAYOUT.amountWords) {
          const aw = DEFAULT_LAYOUT.amountWords;
          bo = applyFont(fs, 'amountWords');
          put(page.amountWords, aw.left + cal.left, aw.top + cal.top + bo, 'left', aw.width);
        }
      });

      const name = pages[0]?.billNo ? `invoice-${pages[0].billNo}.pdf` : 'sterling-invoice.pdf';
      pdf.save(name);
    } catch (err) {
      console.error(err);
      alert('PDF generation failed — see browser console for details.');
    } finally {
      setPdfDownloading(false);
    }
  }

  return (
    <div className="invoice-outer min-h-screen bg-gray-300 py-4 px-2 sm:py-6 sm:px-4">

      {/* Top bar */}
      <div className="no-print max-w-[210mm] mx-auto mb-4 flex flex-wrap items-center gap-2">
        <button onClick={() => window.print()}
          className="px-3 py-2 sm:px-6 sm:py-3 bg-green-600 hover:bg-green-700 text-white text-sm sm:text-base font-semibold rounded-lg shadow">
          🖨 Print
        </button>
        <button onClick={handleDownloadPDF} disabled={pdfDownloading}
          className="px-3 py-2 sm:px-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm sm:text-base rounded-lg">
          {pdfDownloading ? '⏳ Generating…' : '📄 PDF'}
        </button>
        <button
          title="Ctrl+Backspace when in a row"
          onClick={() => {
            if (activeRow) onRemoveRow(activeRow.pageIndex, activeRow.rowIndex);
            else alert('Tap into any field on the row you want to remove first.');
          }}
          className={`px-3 py-2 sm:px-4 text-sm sm:text-base rounded-lg ${activeRow ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>
          ➖ Remove Row
        </button>
        <button onClick={() => { if (window.confirm('Clear all fields?')) setPages([emptyPage()]); }}
          className="px-3 py-2 sm:px-4 text-sm sm:text-base bg-red-600 hover:bg-red-700 text-white rounded-lg">
          🗑 Clear
        </button>
        <button onClick={() => { setShowFont(s => !s); setShowCalibration(false); }}
          className={`px-3 py-2 sm:px-4 text-sm sm:text-base rounded-lg ${showFont ? 'bg-blue-500 text-white' : 'bg-gray-500 hover:bg-gray-600 text-white'}`}>
          🅰 Font
        </button>
        <button onClick={() => { setShowCalibration(s => !s); setShowFont(false); }}
          className={`px-3 py-2 sm:px-4 text-sm sm:text-base rounded-lg ${showCalibration ? 'bg-yellow-500 text-white' : 'bg-gray-500 hover:bg-gray-600 text-white'}`}>
          ⚙ Align
        </button>
        <button onClick={() => setDragMode(s => !s)}
          className={`px-3 py-2 sm:px-4 text-sm sm:text-base rounded-lg font-medium ${dragMode ? 'bg-orange-500 text-white ring-2 ring-orange-300' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}>
          {dragMode ? '✋ Done' : '↕ Adjust'}
        </button>
      </div>

      {/* Font panel — context-aware: applies to focused field, or globally if none */}
      {showFont && (() => {
        const fp = focusedField;
        const fieldOverride = fp ? (pages[fp.pageIndex]?.fieldStyles?.[fp.key] || {}) : null;
        // Effective values shown in controls = field override merged over global defaults
        const eff = fp ? { ...font, ...fieldOverride } : font;
        const onChange = (prop, value) => onFieldStyleChange(prop, value);
        const hasOverride = fp && Object.keys(fieldOverride || {}).length > 0;
        return (
          <div className="no-print max-w-[210mm] mx-auto mb-4 p-4 bg-white rounded-lg shadow border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              {fp ? (
                <>
                  <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                    {FIELD_LABELS[fp.key] || fp.key}
                  </span>
                  {hasOverride && (
                    <button onClick={onClearFieldStyle}
                      className="text-xs text-red-500 underline">reset to default</button>
                  )}
                </>
              ) : (
                <span className="text-xs text-gray-500">Global defaults — click any field first to style just that field</span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 items-center">
              <label className="flex items-center gap-2">
                <span className="text-sm font-medium">Font</span>
                <select value={eff.family} onChange={e => onChange('family', e.target.value)}
                  className="border rounded px-2 py-1 text-sm">
                  <option value="Arial">Arial</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Verdana">Verdana</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-sm font-medium">Size</span>
                <input type="number" min={6} max={24} step={1} value={eff.size}
                  onChange={e => onChange('size', Number(e.target.value))}
                  className="border rounded px-2 py-1 text-sm w-16" />
                <span className="text-xs text-gray-500">pt</span>
              </label>
              <button onClick={() => onChange('bold', !eff.bold)}
                className={`px-3 py-1 rounded font-bold text-sm border ${eff.bold ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}>B</button>
              <button onClick={() => onChange('italic', !eff.italic)}
                className={`px-3 py-1 rounded italic text-sm border ${eff.italic ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}>I</button>
            </div>
          </div>
        );
      })()}

      {/* Drag mode banner */}
      {dragMode && (
        <div className="no-print max-w-[210mm] mx-auto mb-4 p-3 bg-orange-50 border border-orange-300 rounded-lg flex items-center justify-between">
          <span className="text-sm text-orange-800">
            <strong>Drag mode:</strong> Drag fields to move · <span className="text-blue-600 font-medium">Blue right-handle</span> = resize width · <span className="text-blue-600 font-medium">Blue bottom-handle</span> = resize row height
          </span>
          <button onClick={() => { if (window.confirm('Reset all field positions to defaults?')) setLayout(resetLayout()); }}
            className="px-3 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded text-sm">
            Reset positions
          </button>
        </div>
      )}

      {/* Alignment panel */}
      {showCalibration && (
        <div className="no-print max-w-[210mm] mx-auto mb-4 p-4 bg-white rounded-lg shadow border border-gray-200">
          <p className="text-sm text-gray-600 mb-3">Shifts ALL fields together — use after test-printing to calibrate printer offset.</p>
          <div className="flex flex-wrap gap-6 items-center">
            <label className="flex items-center gap-2">
              <span className="text-sm font-medium w-28">Top offset (mm)</span>
              <input type="range" min={-20} max={20} step={0.5} value={calibration.top}
                onChange={e => setCalibration(c => ({ ...c, top: Number(e.target.value) }))} className="w-32" />
              <span className="text-sm w-10">{calibration.top}</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-sm font-medium w-28">Left offset (mm)</span>
              <input type="range" min={-10} max={10} step={0.5} value={calibration.left}
                onChange={e => setCalibration(c => ({ ...c, left: Number(e.target.value) }))} className="w-32" />
              <span className="text-sm w-10">{calibration.left}</span>
            </label>
            <button onClick={() => setCalibration({ top: 0, left: 0 })}
              className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm">Reset</button>
          </div>
        </div>
      )}

      {/* Invoice pages */}
      <div className="invoice-pages-wrap flex flex-col items-center gap-6">
        {pages.map((page, index) => (
          <div key={index} className="invoice-page-item flex flex-col items-center gap-2">
            {/* Per-page controls */}
            <div className="no-print flex items-center gap-2">
              <button onClick={() => onAddRow(index)}
                className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded">
                ➕ Add Row
              </button>
              {pages.length > 1 && (
                <button
                  onClick={() => { if (window.confirm(`Remove page ${index + 1}?`)) onRemovePage(index); }}
                  className="px-3 py-1 bg-red-400 hover:bg-red-500 text-white text-sm rounded">
                  ✕ Remove Page
                </button>
              )}
              {index > 0 && <span className="text-sm text-gray-500">Page {index + 1}</span>}
            </div>

            {/* Scale wrapper — shrinks A4 to fit viewport on mobile/tablet */}
            <div style={{
              width:  `${794 * pageScale}px`,
              height: `${1122 * pageScale}px`,
              overflow: 'hidden',
            }}>
              <div style={{ transform: `scale(${pageScale})`, transformOrigin: 'top left' }}>
                <InvoicePage
                  pageIndex={index}
                  calibration={calibration}
                  layout={layout}
                  font={font}
                  dragMode={dragMode}
                  onLayoutMove={onLayoutMove}
                  onLayoutResize={onLayoutResize}
                  billNo={page.billNo}   date={page.date}
                  challanNo={page.challanNo}   dispatchThrough={page.dispatchThrough}   poNo={page.poNo}
                  ms={page.ms}   address1={page.address1}   address2={page.address2}
                  lineItems={page.lineItems}
                  pageTotalRs={page.totalRs}   pageTotalP={page.totalP}   pageAmountWords={page.amountWords}
                  fieldStyles={page.fieldStyles || {}}
                  onFieldChange={onFieldChange}
                  onFieldFocus={onFieldFocus}
                  onRemoveRow={onRemoveRow}
                  onRowFocus={onRowFocus}
                  onUpdateLineItem={onUpdateLineItem}
                  isContinued={index > 0}
                />
              </div>
            </div>
          </div>
        ))}
        <div className="no-print">
          <button onClick={() => setPages(prev => [...prev, emptyPage()])}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
            ➕ Add Page
          </button>
        </div>
      </div>
    </div>
  );
}

export default InvoiceGenerator;
