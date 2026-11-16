import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import { AttendanceRecord } from '../types/attendance';
import { CalendarEvent } from '../types/calendar';
import { TransactionRecord } from '../types/transaction';
import { ComprehensiveReportModal } from './ComprehensiveReportModal';

export interface ClassroomExportPayload {
  version: number;
  exportedAt: string;
  classroomName: string;
  classroomAddress: string;
  data: {
    transactions: TransactionRecord[];
    attendanceRecords: AttendanceRecord[];
    calendarEvents: CalendarEvent[];
    hiddenStudentIds: string[];
  };
}

interface DataManagementModuleProps {
  transactions: TransactionRecord[];
  attendanceRecords: AttendanceRecord[];
  calendarEvents: CalendarEvent[];
  hiddenStudentIds: string[];
  classroomAddress: string;
  onImportAllData: (payload: {
    transactions: unknown[];
    attendanceRecords: unknown[];
    calendarEvents: unknown[];
    hiddenStudentIds: unknown[];
  }) => {
    txCount: number;
    attCount: number;
    eventCount: number;
  };
}

export const DataManagementModule: React.FC<DataManagementModuleProps> = ({
  transactions,
  attendanceRecords,
  calendarEvents,
  hiddenStudentIds,
  classroomAddress,
  onImportAllData,
}) => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<{
    fileName: string;
    transactions: unknown[];
    attendanceRecords: unknown[];
    calendarEvents: unknown[];
    hiddenStudentIds: unknown[];
  } | null>(null);
  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const availableYears = useMemo(() => {
    const yearSet = new Set<number>([
      now.getFullYear() - 1,
      now.getFullYear(),
      now.getFullYear() + 1,
    ]);
    transactions.forEach((t) => {
      const d = new Date(t.createdAt);
      if (!Number.isNaN(d.getTime())) yearSet.add(d.getFullYear());
    });
    attendanceRecords.forEach((r) => {
      const y = Number(r.date.slice(0, 4));
      if (!Number.isNaN(y) && y > 2000) yearSet.add(y);
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [transactions, attendanceRecords]);

  const selectedMonthPreviewCounts = useMemo(() => {
    const txCount = transactions.filter((tx) => {
      const d = new Date(tx.createdAt);
      return !Number.isNaN(d.getTime()) && d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
    }).length;
    const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-`;
    const attCount = attendanceRecords.filter((rec) => rec.date.startsWith(monthPrefix)).length;
    return { txCount, attCount };
  }, [transactions, attendanceRecords, selectedYear, selectedMonth]);

  const handleExportJson = () => {
    const payload: ClassroomExportPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      classroomName: '李Sir教室',
      classroomAddress,
      data: {
        transactions,
        attendanceRecords,
        calendarEvents,
        hiddenStudentIds,
      },
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const today = new Date();
    const dateStamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(
      2,
      '0'
    )}${String(today.getDate()).padStart(2, '0')}`;

    const link = document.createElement('a');
    link.href = url;
    link.download = `李Sir教室_所有資料備份_${dateStamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportStatus(null);
    setPendingImport(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') {
        setImportStatus({ type: 'error', message: 'JSON 格式不正確，請選擇有效的備份檔案。' });
        return;
      }

      const source =
        parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;

      const rawTx = Array.isArray(source.transactions) ? source.transactions : null;
      const rawAtt = Array.isArray(source.attendanceRecords) ? source.attendanceRecords : null;
      const rawEvents = Array.isArray(source.calendarEvents) ? source.calendarEvents : [];
      const rawHidden = Array.isArray(source.hiddenStudentIds) ? source.hiddenStudentIds : [];

      if (!rawTx && !rawAtt) {
        setImportStatus({
          type: 'error',
          message: '檔案中找不到交易紀錄或出席紀錄資料，請確認是否為李Sir教室導出的 JSON 檔。',
        });
        return;
      }

      setPendingImport({
        fileName: file.name,
        transactions: rawTx ?? [],
        attendanceRecords: rawAtt ?? [],
        calendarEvents: rawEvents,
        hiddenStudentIds: rawHidden,
      });
    } catch {
      setImportStatus({ type: 'error', message: '無法讀取或解析 JSON 檔案，請確認檔案格式。' });
    }
  };

  const handleConfirmImport = () => {
    if (!pendingImport) return;
    const result = onImportAllData({
      transactions: pendingImport.transactions,
      attendanceRecords: pendingImport.attendanceRecords,
      calendarEvents: pendingImport.calendarEvents,
      hiddenStudentIds: pendingImport.hiddenStudentIds,
    });
    setPendingImport(null);
    setImportStatus({
      type: 'success',
      message: `已成功導入所有資料（交易紀錄 ${result.txCount} 筆、出席紀錄 ${result.attCount} 筆、日曆事件 ${result.eventCount} 項）。`,
    });
  };

  return (
    <section aria-labelledby="data-heading" className="space-y-6">
      {/* Page Title & Unboxed Summary */}
      <div className="space-y-1.5">
        <h1
          id="data-heading"
          className="text-2xl font-bold tracking-tight text-slate-900 text-balance"
        >
          資料處理
        </h1>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-slate-600 tabular-nums">
          <span>
            交易紀錄 <strong className="font-semibold text-slate-900">{transactions.length}</strong> 筆
          </span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span>
            學生出席紀錄 <strong className="font-semibold text-slate-900">{attendanceRecords.length}</strong> 筆
          </span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span>
            日曆事件 <strong className="font-semibold text-slate-900">{calendarEvents.length}</strong> 項
          </span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span>
            隱藏名單 <strong className="font-semibold text-slate-900">{hiddenStudentIds.length}</strong> 人
          </span>
        </div>
      </div>

      {/* Two-Column Action Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: JSON Backup & Restore */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">系統資料備份與還原（JSON）</h2>
            <p className="text-sm text-slate-500">
              將交易紀錄、學生出席紀錄、日曆事件及隱藏名單完整匯出為 JSON 備份，或從備份檔案還原資料。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              導出JSON (所有資料)
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="h-4 w-4 text-slate-600" aria-hidden="true" />
              導入JSON (所有資料)
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              aria-label="選擇導入的 JSON 檔案"
              className="sr-only"
            />
          </div>

          {/* Pending Import Confirmation */}
          {pendingImport && (
            <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-900">
                  確定導入檔案「{pendingImport.fileName}」？
                </p>
                <p className="text-xs text-amber-800 tabular-nums">
                  將覆蓋現有資料並載入：交易紀錄 {pendingImport.transactions.length} 筆、出席紀錄{' '}
                  {pendingImport.attendanceRecords.length} 筆、日曆事件{' '}
                  {pendingImport.calendarEvents.length} 項。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="h-9 px-3.5 text-xs font-medium text-white bg-amber-700 hover:bg-amber-800 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                >
                  確認導入並覆蓋
                </button>
                <button
                  type="button"
                  onClick={() => setPendingImport(null)}
                  className="h-9 px-3.5 text-xs font-medium text-amber-900 bg-white border border-amber-300 hover:bg-amber-100/50 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* Import Feedback */}
          {importStatus && (
            <div
              role="status"
              className={`p-3.5 rounded-lg border flex items-start gap-2.5 text-sm ${
                importStatus.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {importStatus.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" aria-hidden="true" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
              )}
              <span>{importStatus.message}</span>
            </div>
          )}
        </div>

        {/* Card 2: Monthly Comprehensive Report */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">月度整全報表</h2>
            <p className="text-sm text-slate-500">
              選擇年份及月份，整合產生該月份的交易紀錄及所有學生出席紀錄，支援預覽、列印及下載 PDF。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <select
              aria-label="選擇報表年份"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="h-10 px-3 text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 cursor-pointer tabular-nums"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y} 年
                </option>
              ))}
            </select>

            <select
              aria-label="選擇報表月份"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="h-10 px-3 text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 cursor-pointer tabular-nums"
            >
              {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
                <option key={m} value={m}>
                  {m} 月
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              出整全報表
            </button>
          </div>

          <p className="text-xs text-slate-500 tabular-nums pt-1 border-t border-slate-100">
            {selectedYear} 年 {selectedMonth} 月包含：交易紀錄{' '}
            <strong className="font-semibold text-slate-700">
              {selectedMonthPreviewCounts.txCount}
            </strong>{' '}
            筆 · 學生出席紀錄{' '}
            <strong className="font-semibold text-slate-700">
              {selectedMonthPreviewCounts.attCount}
            </strong>{' '}
            筆
          </p>
        </div>
      </div>

      {/* Comprehensive Monthly Report Modal */}
      <ComprehensiveReportModal
        isOpen={isReportModalOpen}
        year={selectedYear}
        month={selectedMonth}
        transactions={transactions}
        attendanceRecords={attendanceRecords}
        classroomAddress={classroomAddress}
        onClose={() => setIsReportModalOpen(false)}
      />
    </section>
  );
};
