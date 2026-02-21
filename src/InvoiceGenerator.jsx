import { useState, useCallback, useEffect } from 'react';
import InvoicePage, { MAX_ROWS } from './InvoicePage';
import { loadLayout, saveLayout, resetLayout } from './layoutConfig';
import './invoice.css';

const CALIBRATION_KEY = 'invoice-calibration';
const DRAFT_KEY       = 'invoice-draft';
const FONT_KEY        = 'invoice-font';

const emptyRow = (index = 0) => ({
  sno: String(index + 1), particulars: '', qty: '', rate: '', amountRs: '', amountP: '',
});

const emptyPage = () => ({
  billNo: '', date: '', challanNo: '', dispatchThrough: '', poNo: '',
  ms: '', address1: '', address2: '',
  lineItems: [emptyRow(0)],
  totalRs: '', totalP: '',
});

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
  const [pages, setPages]             = useState(() => loadDraft() || [emptyPage()]);
  const [activeRow, setActiveRow]     = useState(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);

  useEffect(() => { localStorage.setItem(CALIBRATION_KEY, JSON.stringify(calibration)); }, [calibration]);
  useEffect(() => { saveLayout(layout); }, [layout]);
  useEffect(() => { localStorage.setItem(FONT_KEY, JSON.stringify(font)); }, [font]);
  useEffect(() => { localStorage.setItem(DRAFT_KEY, JSON.stringify(pages)); }, [pages]);

  const onFieldChange = useCallback((pageIndex, field, value) => {
    setPages(prev => prev.map((p, i) => i === pageIndex ? { ...p, [field]: value } : p));
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
          updated.amountP  = paise  > 0 ? String(paise)  : '';
        }
        return updated;
      });
      const total       = newItems.reduce((acc, it) => acc + (parseFloat(it.amountRs) || 0) + (parseFloat(it.amountP) || 0) / 100, 0);
      const totalRupees = Math.floor(total);
      const totalPaise  = Math.round((total - totalRupees) * 100);
      return { ...p, lineItems: newItems, totalRs: total > 0 ? String(totalRupees) : '', totalP: totalPaise > 0 ? String(totalPaise) : '' };
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
      const pdfFont  = fontMap[font.family] || 'helvetica';
      const pdfStyle = font.bold && font.italic ? 'bolditalic' : font.bold ? 'bold' : font.italic ? 'italic' : 'normal';
      // Convert pt font size to mm for baseline offset (cap-height ≈ 72% of font size)
      const baselineOffset = font.size * 0.3528 * 0.72;

      const cal  = calibration;
      const li   = layout.lineItems;
      const cols = li.columns;

      pages.forEach((page, pageIdx) => {
        if (pageIdx > 0) pdf.addPage();

        // Layer 1 — pre-printed form
        pdf.addImage(bgDataUrl, 'PNG', 0, 0, 210, 297);

        // Layer 2 — typed text
        pdf.setFont(pdfFont, pdfStyle);
        pdf.setFontSize(font.size);
        pdf.setTextColor(0, 0, 0);

        const put = (value, x, y, align = 'left') => {
          if (!value && value !== 0) return;
          pdf.text(String(value), x, y, { align });
        };

        // Header fields
        const hf = (key, align = 'left') => {
          const f = layout[key]; if (!f) return;
          const x = align === 'right'  ? f.left + cal.left + f.width
                  : align === 'center' ? f.left + cal.left + f.width / 2
                  :                      f.left + cal.left;
          put(page[key], x, f.top + cal.top + baselineOffset, align);
        };
        hf('billNo'); hf('date'); hf('challanNo'); hf('dispatchThrough'); hf('poNo');
        hf('ms'); hf('address1'); hf('address2');

        // Line item rows
        page.lineItems.forEach((item, idx) => {
          const y = li.firstRowTop + idx * li.rowHeight + cal.top + baselineOffset;
          put(item.sno,         cols.sno.left         + cal.left + cols.sno.width / 2,         y, 'center');
          if (item.particulars) {
            pdf.text(item.particulars, cols.particulars.left + cal.left, y, { maxWidth: cols.particulars.width });
          }
          put(item.qty,         cols.qty.left         + cal.left + cols.qty.width / 2,         y, 'center');
          put(item.rate,        cols.rate.left         + cal.left + cols.rate.width,            y, 'right');
          put(item.amountRs,    cols.amountRs.left     + cal.left + cols.amountRs.width,        y, 'right');
          put(item.amountP,     cols.amountP.left      + cal.left + cols.amountP.width,         y, 'right');
        });

        // Totals — bold
        const boldStyle = font.italic ? 'bolditalic' : 'bold';
        pdf.setFont(pdfFont, boldStyle);
        const trs = layout.totalRs;
        const tp  = layout.totalP;
        put(page.totalRs, trs.left + cal.left + trs.width, trs.top + cal.top + baselineOffset, 'right');
        put(page.totalP,  tp.left  + cal.left + tp.width,  tp.top  + cal.top + baselineOffset, 'right');
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
    <div className="invoice-outer min-h-screen bg-gray-300 py-6 px-4">

      {/* Top bar */}
      <div className="no-print max-w-[210mm] mx-auto mb-4 flex flex-wrap items-center gap-3">
        <button onClick={() => window.print()}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow">
          🖨 Print
        </button>
        <button onClick={handleDownloadPDF} disabled={pdfDownloading}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-lg">
          {pdfDownloading ? '⏳ Generating…' : '📄 Download PDF'}
        </button>
        <button
          title="Ctrl+Backspace when in a row"
          onClick={() => {
            if (activeRow) onRemoveRow(activeRow.pageIndex, activeRow.rowIndex);
            else alert('Click into any field on the row you want to remove first.');
          }}
          className={`px-4 py-2 rounded-lg ${activeRow ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>
          ➖ Remove Row
        </button>
        <button onClick={() => { if (window.confirm('Clear all fields?')) setPages([emptyPage()]); }}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">
          🗑 Clear All
        </button>
        <button onClick={() => { setShowFont(s => !s); setShowCalibration(false); }}
          className={`px-4 py-2 rounded-lg ${showFont ? 'bg-blue-500 text-white' : 'bg-gray-500 hover:bg-gray-600 text-white'}`}>
          🅰 Font
        </button>
        <button onClick={() => { setShowCalibration(s => !s); setShowFont(false); }}
          className={`px-4 py-2 rounded-lg ${showCalibration ? 'bg-yellow-500 text-white' : 'bg-gray-500 hover:bg-gray-600 text-white'}`}>
          ⚙ Alignment
        </button>
        <button onClick={() => setDragMode(s => !s)}
          className={`px-4 py-2 rounded-lg font-medium ${dragMode ? 'bg-orange-500 text-white ring-2 ring-orange-300' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}>
          {dragMode ? '✋ Dragging ON — click to exit' : '↕ Adjust Fields'}
        </button>
      </div>

      {/* Font panel */}
      {showFont && (
        <div className="no-print max-w-[210mm] mx-auto mb-4 p-4 bg-white rounded-lg shadow border border-gray-200">
          <div className="flex flex-wrap gap-4 items-center">
            <label className="flex items-center gap-2">
              <span className="text-sm font-medium">Font</span>
              <select value={font.family} onChange={e => setFont(f => ({ ...f, family: e.target.value }))}
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
              <input type="number" min={6} max={24} step={1} value={font.size}
                onChange={e => setFont(f => ({ ...f, size: Number(e.target.value) }))}
                className="border rounded px-2 py-1 text-sm w-16" />
              <span className="text-xs text-gray-500">pt</span>
            </label>
            <button onClick={() => setFont(f => ({ ...f, bold: !f.bold }))}
              className={`px-3 py-1 rounded font-bold text-sm border ${font.bold ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}>B</button>
            <button onClick={() => setFont(f => ({ ...f, italic: !f.italic }))}
              className={`px-3 py-1 rounded italic text-sm border ${font.italic ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}>I</button>
          </div>
        </div>
      )}

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
              pageTotalRs={page.totalRs}   pageTotalP={page.totalP}
              onFieldChange={onFieldChange}
              onRemoveRow={onRemoveRow}
              onRowFocus={onRowFocus}
              onUpdateLineItem={onUpdateLineItem}
              isContinued={index > 0}
            />
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
