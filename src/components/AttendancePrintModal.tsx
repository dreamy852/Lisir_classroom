import React, { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { Download, Loader2, Printer, X } from 'lucide-react';
import { AttendanceRecord } from '../types/attendance';
import { StudentLessonSummary } from '../types/student';

interface AttendancePrintModalProps {
  isOpen: boolean;
  students: StudentLessonSummary[];
  initialStudentId: string;
  attendanceRecords: AttendanceRecord[];
  classroomAddress: string;
  onClose: () => void;
}

export const AttendancePrintModal: React.FC<AttendancePrintModalProps> = ({
  isOpen,
  students,
  initialStudentId,
  attendanceRecords,
  classroomAddress,
  onClose,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDownloadError('');
      setIsGenerating(false);
      if (initialStudentId && students.some((s) => s.studentId === initialStudentId)) {
        setSelectedStudentId(initialStudentId);
      } else if (students.length > 0) {
        setSelectedStudentId(students[0].studentId);
      } else {
        setSelectedStudentId('');
      }
    }
  }, [isOpen, initialStudentId, students]);

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

  const selectedStudent = useMemo(
    () => students.find((s) => s.studentId === selectedStudentId) ?? null,
    [students, selectedStudentId]
  );

  const studentRecords = useMemo(() => {
    if (!selectedStudent) return [];
    return attendanceRecords
      .filter((r) => r.studentId === selectedStudent.studentId)
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.startTime.localeCompare(b.startTime);
      });
  }, [attendanceRecords, selectedStudent]);

  if (!isOpen) return null;

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  })();

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!sheetRef.current || !selectedStudent || isGenerating) return;
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

      const safeName = selectedStudent.studentName.replace(/[\\/:*?"<>|]/g, '_');
      pdf.save(`李Sir教室_出勤紀錄_${safeName}_${selectedStudent.studentId}.pdf`);
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
      aria-labelledby="attendance-print-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isGenerating) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        {/* Top Bar */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h2
              id="attendance-print-title"
              className="text-base font-semibold text-slate-900 whitespace-nowrap"
            >
              列印學生出勤紀錄
            </h2>
            {students.length > 0 && (
              <select
                aria-label="選擇列印學生"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="h-9 px-3 text-sm font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                {students.map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    {s.studentName} ({s.studentId})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              disabled={!selectedStudent || isGenerating}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="h-4 w-4 text-slate-600" aria-hidden="true" />
              列印
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!selectedStudent || isGenerating}
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
          {!selectedStudent ? (
            <div className="mx-auto max-w-[660px] bg-white border border-slate-200 p-10 text-center text-sm text-slate-600">
              尚未有學生資料可供列印，請先於「交易紀錄」加入學生交易。
            </div>
          ) : (
            <div
              ref={sheetRef}
              className="printable-sheet mx-auto w-full max-w-[660px] bg-white border border-slate-200 p-8 sm:p-10 text-slate-900 shadow-xs"
              style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6 border-b border-slate-200">
                <div className="space-y-1.5">
                  <p className="text-2xl font-bold tracking-tight text-slate-900">李Sir教室</p>
                  <p className="text-xs text-slate-600">{classroomAddress}</p>
                </div>

                <div className="sm:text-right space-y-1">
                  <p className="text-xl font-bold tracking-tight text-blue-700">學生出勤紀錄表</p>
                  <p className="text-xs font-mono tracking-wider text-slate-400">
                    ATTENDANCE RECORD
                  </p>
                  <p className="pt-1 text-xs font-mono text-slate-600 tabular-nums">
                    列印日期：{todayStr}
                  </p>
                </div>
              </div>

              {/* Student Summary */}
              <div className="py-5 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-slate-200 text-sm">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">學生姓名（編號）</p>
                  <p className="font-semibold text-slate-900">
                    {selectedStudent.studentName} ({selectedStudent.studentId})
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">購買堂數</p>
                  <p className="font-mono font-semibold text-slate-900 tabular-nums">
                    {selectedStudent.purchasedLessons} 堂
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">已出席堂數</p>
                  <p className="font-mono font-semibold text-slate-900 tabular-nums">
                    {selectedStudent.attendedLessons} 堂
                  </p>
                </div>
                <div className="space-y-1 sm:text-right">
                  <p className="text-xs text-slate-500">剩餘堂數</p>
                  <p
                    className={`font-mono font-bold tabular-nums ${
                      selectedStudent.remainingLessons <= 0 ? 'text-red-700' : 'text-blue-700'
                    }`}
                  >
                    {selectedStudent.remainingLessons} 堂
                  </p>
                </div>
              </div>

              {/* Attendance Table */}
              <div className="py-6">
                {studentRecords.length === 0 ? (
                  <div className="py-10 text-center border border-dashed border-slate-200 rounded-lg text-sm text-slate-500">
                    此學生暫時未有任何出席或預約紀錄。
                  </div>
                ) : (
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-300 text-xs font-semibold text-slate-600">
                        <th scope="col" className="py-2.5 pr-3 whitespace-nowrap">
                          出席編號
                        </th>
                        <th scope="col" className="py-2.5 px-3 whitespace-nowrap">
                          日期
                        </th>
                        <th scope="col" className="py-2.5 px-3 whitespace-nowrap">
                          上課時間
                        </th>
                        <th scope="col" className="py-2.5 pl-3 text-right whitespace-nowrap">
                          出席狀況
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {studentRecords.map((rec) => (
                        <tr key={rec.id}>
                          <td className="py-2.5 pr-3 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                            {rec.atnId}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-900 tabular-nums whitespace-nowrap">
                            {rec.date}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700 tabular-nums whitespace-nowrap">
                            {rec.startTime} – {rec.endTime}
                          </td>
                          <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                            <span
                              className={
                                rec.attended
                                  ? 'text-xs font-semibold text-emerald-700'
                                  : 'text-xs font-medium text-slate-500'
                              }
                            >
                              {rec.attended ? '是（已出席）' : '否（尚未出席）'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer */}
              <div className="mt-4 pt-5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span>李Sir教室 · {classroomAddress}</span>
                <span>共 {studentRecords.length} 筆紀錄</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
