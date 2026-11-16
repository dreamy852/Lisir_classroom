import React, { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { Download, Loader2, X } from 'lucide-react';
import { TransactionRecord } from '../types/transaction';

interface RevenuePreviewModalProps {
  isOpen: boolean;
  year: number;
  month: number;
  transactions: TransactionRecord[];
  classroomAddress: string;
  onClose: () => void;
}

function formatCurrency(amount: number): string {
  return `HK$${amount.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 1,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const RevenuePreviewModal: React.FC<RevenuePreviewModalProps> = ({
  isOpen,
  year,
  month,
  transactions,
  classroomAddress,
  onClose,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    setDownloadError('');
    setIsGenerating(false);
  }, [isOpen, year, month]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isGenerating) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isGenerating, onClose]);

  const paidRecords = useMemo(() => {
    return transactions
      .filter((record) => {
        if (record.paymentStatus !== '已付錢') return false;
        const d = new Date(record.createdAt);
        if (Number.isNaN(d.getTime())) return false;
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [transactions, year, month]);

  const totals = useMemo(() => {
    const tuitionTotal = paidRecords.reduce((sum, r) => sum + r.price, 0);
    const trialTotal = paidRecords.reduce((sum, r) => sum + (r.includesTrial ? r.trialFee : 0), 0);
    const grandTotal = Math.round((tuitionTotal + trialTotal) * 100) / 100;
    const totalLessons = paidRecords.reduce((sum, r) => sum + r.lessons, 0);
    return {
      tuitionTotal: Math.round(tuitionTotal * 100) / 100,
      trialTotal: Math.round(trialTotal * 100) / 100,
      grandTotal,
      totalLessons,
    };
  }, [paidRecords]);

  if (!isOpen) return null;

  const monthPadded = String(month).padStart(2, '0');
  const docNumber = `REV-${year}${monthPadded}`;
  const issuedDate = formatDate(new Date().toISOString());

  const handleDownloadPdf = async () => {
    if (!sheetRef.current || isGenerating) return;
    setIsGenerating(true);
    setDownloadError('');

    try {
      const canvas = await html2canvas(sheetRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const printableWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * printableWidth) / canvas.width;

      let finalWidth = printableWidth;
      let finalHeight = imgHeight;
      if (imgHeight > pageHeight - margin * 2) {
        finalHeight = pageHeight - margin * 2;
        finalWidth = (canvas.width * finalHeight) / canvas.height;
      }

      const xOffset = (pageWidth - finalWidth) / 2;
      pdf.addImage(imgData, 'PNG', xOffset, margin, finalWidth, finalHeight);
      pdf.save(`李Sir教室_收入結算單_${year}年${monthPadded}月.pdf`);
    } catch {
      setDownloadError('產生 PDF 時發生錯誤，請再試一次。');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="revenue-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isGenerating) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        {/* Modal Top Toolbar */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4 bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h2
              id="revenue-modal-title"
              className="text-base font-semibold text-slate-900 whitespace-nowrap"
            >
              收入結算單預覽（{year} 年 {month} 月）
            </h2>
            <span className="text-xs font-mono text-slate-500 truncate">{docNumber}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              {isGenerating ? '產生中...' : '下載 PDF'}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              aria-label="關閉預覽"
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {downloadError && (
          <div className="px-5 py-2.5 bg-red-50 border-b border-red-200 text-xs font-medium text-red-700">
            {downloadError}
          </div>
        )}

        {/* Preview Stage */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-8">
          <div
            ref={sheetRef}
            className="mx-auto w-full max-w-[660px] bg-white border border-slate-200 p-8 sm:p-10 text-slate-900 shadow-xs"
            style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
          >
            {/* Document Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 pb-6 border-b border-slate-200">
              <div className="space-y-1.5">
                <p className="text-2xl font-bold tracking-tight text-slate-900">李Sir教室</p>
                <p className="text-xs text-slate-600">{classroomAddress}</p>
              </div>

              <div className="sm:text-right space-y-1">
                <p className="text-xl font-bold tracking-tight text-blue-700">月度收入結算單</p>
                <p className="text-xs font-mono tracking-wider text-slate-400">
                  MONTHLY REVENUE STATEMENT
                </p>
                <div className="pt-1.5 space-y-0.5 text-xs text-slate-600 font-mono tabular-nums">
                  <p>結算月份：{year} 年 {monthPadded} 月</p>
                  <p>編號：{docNumber}</p>
                  <p>列印日期：{issuedDate}</p>
                </div>
              </div>
            </div>

            {/* Summary Strip */}
            <div className="py-5 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-slate-200 text-sm">
              <div className="space-y-1">
                <p className="text-xs text-slate-500">已收款筆數</p>
                <p className="font-mono font-semibold text-slate-900 tabular-nums">
                  {paidRecords.length} 筆
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">學費實收</p>
                <p className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatCurrency(totals.tuitionTotal)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">試堂費實收</p>
                <p className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatCurrency(totals.trialTotal)}
                </p>
              </div>
              <div className="space-y-1 sm:text-right">
                <p className="text-xs text-slate-500">本月總收入</p>
                <p className="font-mono font-bold text-blue-700 tabular-nums">
                  {formatCurrency(totals.grandTotal)}
                </p>
              </div>
            </div>

            {/* Paid Transactions Table */}
            <div className="py-6">
              {paidRecords.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-slate-200 rounded-lg">
                  <p className="text-sm font-medium text-slate-700">
                    {year} 年 {month} 月暫無「已付錢」之交易紀錄
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    此單僅統計該月份已收款項目。
                  </p>
                </div>
              ) : (
                <table className="w-full border-collapse text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-300 text-xs font-semibold text-slate-600">
                      <th scope="col" className="py-2.5 pr-3 whitespace-nowrap">
                        日期
                      </th>
                      <th scope="col" className="py-2.5 px-3 whitespace-nowrap">
                        學生姓名
                      </th>
                      <th scope="col" className="py-2.5 px-3 whitespace-nowrap">
                        科目 / 年級
                      </th>
                      <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">
                        堂數
                      </th>
                      <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">
                        學費
                      </th>
                      <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">
                        試堂費
                      </th>
                      <th scope="col" className="py-2.5 pl-3 text-right whitespace-nowrap">
                        實收小計
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {paidRecords.map((record) => {
                      const trial = record.includesTrial ? record.trialFee : 0;
                      const subtotal = Math.round((record.price + trial) * 100) / 100;
                      return (
                        <tr key={record.id}>
                          <td className="py-2.5 pr-3 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                            {formatDate(record.createdAt)}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900 whitespace-nowrap">
                            {record.studentName}{' '}
                            <span className="font-mono text-xs font-normal text-slate-500">
                              ({record.studentId})
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                            {record.subject} · {record.grade} · {record.format}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                            {record.lessons} 堂
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                            {formatCurrency(record.price)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                            {record.includesTrial ? formatCurrency(trial) : '—'}
                          </td>
                          <td className="py-2.5 pl-3 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                            {formatCurrency(subtotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Grand Total */}
              <div className="mt-4 pt-4 border-t-2 border-slate-900 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">
                  {year} 年 {month} 月實收總額（共 {totals.totalLessons} 堂）
                </span>
                <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                  {formatCurrency(totals.grandTotal)}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-end justify-between gap-6 text-xs text-slate-500">
              <div className="space-y-1.5 leading-relaxed">
                <p className="font-medium text-slate-700">備註</p>
                <p>
                  本收入結算單僅紀錄 {year} 年 {month} 月狀態為「已付錢」之實收款項，「未付錢」項目不計算在內。
                </p>
                <p>地址：{classroomAddress}</p>
              </div>

              <div className="sm:text-right shrink-0 pt-4 sm:pt-0">
                <div className="inline-block min-w-[140px] border-t border-slate-400 pt-2 text-center font-medium text-slate-700">
                  李Sir教室 核對
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
