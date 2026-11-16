import React, { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { Download, Loader2, Printer, X } from 'lucide-react';
import { AttendanceRecord } from '../types/attendance';
import { TransactionRecord } from '../types/transaction';

interface ComprehensiveReportModalProps {
  isOpen: boolean;
  year: number;
  month: number;
  transactions: TransactionRecord[];
  attendanceRecords: AttendanceRecord[];
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

export const ComprehensiveReportModal: React.FC<ComprehensiveReportModalProps> = ({
  isOpen,
  year,
  month,
  transactions,
  attendanceRecords,
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

  const monthTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        const d = new Date(tx.createdAt);
        if (Number.isNaN(d.getTime())) return false;
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [transactions, year, month]);

  const monthAttendance = useMemo(() => {
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;
    return attendanceRecords
      .filter((rec) => rec.date.startsWith(monthPrefix))
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.startTime.localeCompare(b.startTime);
      });
  }, [attendanceRecords, year, month]);

  const summary = useMemo(() => {
    const paidTxs = monthTransactions.filter((tx) => tx.paymentStatus === '已付錢');
    const unpaidTxs = monthTransactions.filter((tx) => tx.paymentStatus === '未付錢');
    const paidTotal = paidTxs.reduce(
      (sum, tx) => sum + tx.price + (tx.includesTrial ? tx.trialFee : 0),
      0
    );
    const attendedCount = monthAttendance.filter((rec) => rec.attended).length;
    const unattendedCount = monthAttendance.length - attendedCount;
    return {
      txCount: monthTransactions.length,
      paidTotal: Math.round(paidTotal * 100) / 100,
      unpaidCount: unpaidTxs.length,
      attendanceCount: monthAttendance.length,
      attendedCount,
      unattendedCount,
    };
  }, [monthTransactions, monthAttendance]);

  if (!isOpen) return null;

  const monthPadded = String(month).padStart(2, '0');
  const reportNumber = `RPT-${year}${monthPadded}`;
  const issuedDate = formatDate(new Date().toISOString());

  const handlePrint = () => {
    window.print();
  };

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
      const printableHeight = pageHeight - margin * 2;
      const totalImgHeight = (canvas.height * printableWidth) / canvas.width;

      let heightLeft = totalImgHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, printableWidth, totalImgHeight);
      heightLeft -= printableHeight;

      while (heightLeft > 1) {
        position = margin - (totalImgHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, printableWidth, totalImgHeight);
        heightLeft -= printableHeight;
      }

      pdf.save(`李Sir教室_整全報表_${year}年${monthPadded}月.pdf`);
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
      aria-labelledby="comprehensive-report-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isGenerating) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        {/* Top Bar */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4 bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h2
              id="comprehensive-report-title"
              className="text-base font-semibold text-slate-900 whitespace-nowrap"
            >
              整全報表預覽（{year} 年 {month} 月）
            </h2>
            <span className="text-xs font-mono text-slate-500 truncate">{reportNumber}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="h-4 w-4 text-slate-600" aria-hidden="true" />
              列印
            </button>

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
            className="printable-sheet mx-auto w-full max-w-[740px] bg-white border border-slate-200 p-8 sm:p-10 text-slate-900 shadow-xs space-y-6"
            style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
          >
            {/* Report Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6 border-b border-slate-200">
              <div className="space-y-1.5">
                <p className="text-2xl font-bold tracking-tight text-slate-900">李Sir教室</p>
                <p className="text-xs text-slate-600">{classroomAddress}</p>
              </div>

              <div className="sm:text-right space-y-1">
                <p className="text-xl font-bold tracking-tight text-blue-700">月度整全報表</p>
                <p className="text-xs font-mono tracking-wider text-slate-400">
                  MONTHLY COMPREHENSIVE REPORT
                </p>
                <div className="pt-1 text-xs text-slate-600 font-mono tabular-nums space-y-0.5">
                  <p>報表月份：{year} 年 {monthPadded} 月</p>
                  <p>編號：{reportNumber}</p>
                  <p>列印日期：{issuedDate}</p>
                </div>
              </div>
            </div>

            {/* Monthly Summary */}
            <div className="pb-5 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-slate-200 text-sm">
              <div className="space-y-1">
                <p className="text-xs text-slate-500">該月交易紀錄</p>
                <p className="font-mono font-semibold text-slate-900 tabular-nums">
                  {summary.txCount} 筆
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">該月已收款總額</p>
                <p className="font-mono font-semibold text-emerald-700 tabular-nums">
                  {formatCurrency(summary.paidTotal)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">該月出席紀錄</p>
                <p className="font-mono font-semibold text-slate-900 tabular-nums">
                  {summary.attendanceCount} 筆
                </p>
              </div>
              <div className="space-y-1 sm:text-right">
                <p className="text-xs text-slate-500">已出席 / 未出席</p>
                <p className="font-mono font-semibold text-slate-900 tabular-nums">
                  {summary.attendedCount} / {summary.unattendedCount} 堂
                </p>
              </div>
            </div>

            {/* Part 1: Monthly Transactions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  一、{year} 年 {month} 月交易紀錄（{monthTransactions.length} 筆）
                </h3>
                {summary.unpaidCount > 0 && (
                  <span className="text-xs text-amber-700 font-medium">
                    尚有 {summary.unpaidCount} 筆未付錢
                  </span>
                )}
              </div>

              {monthTransactions.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-slate-200 rounded-lg text-xs text-slate-500">
                  {year} 年 {month} 月暫無交易紀錄
                </div>
              ) : (
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-300 text-slate-600 font-semibold">
                      <th scope="col" className="py-2 pr-2 whitespace-nowrap">
                        日期
                      </th>
                      <th scope="col" className="py-2 px-2 whitespace-nowrap">
                        學生 (ID)
                      </th>
                      <th scope="col" className="py-2 px-2 whitespace-nowrap">
                        形式 / 科目 / 年級
                      </th>
                      <th scope="col" className="py-2 px-2 text-right whitespace-nowrap">
                        堂數
                      </th>
                      <th scope="col" className="py-2 px-2 text-right whitespace-nowrap">
                        價錢
                      </th>
                      <th scope="col" className="py-2 px-2 text-right whitespace-nowrap">
                        試堂費
                      </th>
                      <th scope="col" className="py-2 pl-2 text-right whitespace-nowrap">
                        付款狀態
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {monthTransactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="py-2 pr-2 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                          {formatDate(tx.createdAt)}
                        </td>
                        <td className="py-2 px-2 font-medium text-slate-900 whitespace-nowrap">
                          {tx.studentName}{' '}
                          <span className="font-mono font-normal text-slate-500">
                            ({tx.studentId})
                          </span>
                        </td>
                        <td className="py-2 px-2 text-slate-700 whitespace-nowrap">
                          {tx.format} · {tx.subject} · {tx.grade}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                          {tx.lessons} 堂
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-medium text-slate-900 tabular-nums whitespace-nowrap">
                          {formatCurrency(tx.price)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                          {tx.includesTrial ? formatCurrency(tx.trialFee) : '—'}
                        </td>
                        <td className="py-2 pl-2 text-right whitespace-nowrap">
                          <span
                            className={
                              tx.paymentStatus === '已付錢'
                                ? 'font-medium text-emerald-700'
                                : 'font-medium text-amber-700'
                            }
                          >
                            {tx.paymentStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Part 2: Monthly Attendance */}
            <div className="pt-2 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">
                二、{year} 年 {month} 月所有學生出席紀錄（{monthAttendance.length} 筆）
              </h3>

              {monthAttendance.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-slate-200 rounded-lg text-xs text-slate-500">
                  {year} 年 {month} 月暫無學生出席紀錄
                </div>
              ) : (
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-300 text-slate-600 font-semibold">
                      <th scope="col" className="py-2 pr-2 whitespace-nowrap">
                        出席編號
                      </th>
                      <th scope="col" className="py-2 px-2 whitespace-nowrap">
                        日期
                      </th>
                      <th scope="col" className="py-2 px-2 whitespace-nowrap">
                        時間
                      </th>
                      <th scope="col" className="py-2 px-2 whitespace-nowrap">
                        學生 (ID)
                      </th>
                      <th scope="col" className="py-2 pl-2 text-right whitespace-nowrap">
                        出席狀況
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {monthAttendance.map((rec) => (
                      <tr key={rec.id}>
                        <td className="py-2 pr-2 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                          {rec.atnId}
                        </td>
                        <td className="py-2 px-2 font-mono text-slate-900 tabular-nums whitespace-nowrap">
                          {rec.date}
                        </td>
                        <td className="py-2 px-2 font-mono text-slate-700 tabular-nums whitespace-nowrap">
                          {rec.startTime}–{rec.endTime}
                        </td>
                        <td className="py-2 px-2 font-medium text-slate-900 whitespace-nowrap">
                          {rec.studentName}{' '}
                          <span className="font-mono font-normal text-slate-500">
                            ({rec.studentId})
                          </span>
                        </td>
                        <td className="py-2 pl-2 text-right whitespace-nowrap">
                          <span
                            className={
                              rec.attended
                                ? 'font-semibold text-emerald-700'
                                : 'font-medium text-slate-500'
                            }
                          >
                            {rec.attended ? '是（已出席）' : '否（未出席）'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="pt-5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>李Sir教室 · {classroomAddress}</span>
              <span>
                {year} 年 {monthPadded} 月整全報表
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
