/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { AttendanceModule } from './components/AttendanceModule';
import { CalendarModule } from './components/CalendarModule';
import { RemainingLessonsModule } from './components/RemainingLessonsModule';
import { TransactionLogModule } from './components/TransactionLogModule';
import { AttendanceRecord } from './types/attendance';
import { CalendarEvent } from './types/calendar';
import {
  RemainingLessonStatus,
  StudentIdentity,
  StudentLessonSummary,
} from './types/student';
import { PaymentStatus, TransactionRecord } from './types/transaction';

const TRANSACTIONS_STORAGE_KEY = 'lee_sir_classroom_transactions_v1';
const ATTENDANCE_STORAGE_KEY = 'lee_sir_classroom_attendance_v1';
const EVENTS_STORAGE_KEY = 'lee_sir_classroom_events_v1';
const HIDDEN_STUDENTS_STORAGE_KEY = 'lee_sir_classroom_hidden_students_v1';
const CLASSROOM_ADDRESS = '觀塘華成工商中心1樓02 R室';

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function makeCurrentMonthIso(dayOffsetBack: number): string {
  const now = new Date();
  const targetDay = Math.max(1, now.getDate() - dayOffsetBack);
  const d = new Date(now.getFullYear(), now.getMonth(), targetDay, 12, 0, 0, 0);
  return d.toISOString();
}

function makeWeekDayYmd(weekdayIndex: number): string {
  const now = new Date();
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const target = new Date(
    sunday.getFullYear(),
    sunday.getMonth(),
    sunday.getDate() + weekdayIndex
  );
  return formatYmd(target);
}

const INITIAL_TRANSACTIONS: TransactionRecord[] = [
  {
    id: 'tx-1',
    studentId: '10001',
    studentName: '陳小明',
    format: '小組',
    price: 1600,
    lessons: 8,
    includesTrial: false,
    trialFee: 0,
    subject: '數學',
    grade: '中三',
    paymentStatus: '已付錢',
    createdAt: makeCurrentMonthIso(0),
  },
  {
    id: 'tx-2',
    studentId: '10002',
    studentName: '林詩涵',
    format: '個人',
    price: 2400,
    lessons: 2,
    includesTrial: true,
    trialFee: 250,
    subject: '物理',
    grade: '中五',
    paymentStatus: '未付錢',
    createdAt: makeCurrentMonthIso(1),
  },
  {
    id: 'tx-3',
    studentId: '10003',
    studentName: '張子軒',
    format: '小組',
    price: 1200,
    lessons: 2,
    includesTrial: false,
    trialFee: 0,
    subject: '英文',
    grade: '中四',
    paymentStatus: '已付錢',
    createdAt: makeCurrentMonthIso(2),
  },
];

const INITIAL_ATTENDANCE: AttendanceRecord[] = [
  {
    id: 'atn-seed-1',
    atnId: 'ATN-0001',
    date: makeWeekDayYmd(1),
    startTime: '16:00',
    endTime: '17:30',
    studentId: '10001',
    studentName: '陳小明',
    attended: true,
    createdAt: makeCurrentMonthIso(2),
  },
  {
    id: 'atn-seed-2',
    atnId: 'ATN-0002',
    date: makeWeekDayYmd(2),
    startTime: '17:00',
    endTime: '18:30',
    studentId: '10002',
    studentName: '林詩涵',
    attended: true,
    createdAt: makeCurrentMonthIso(2),
  },
  {
    id: 'atn-seed-3',
    atnId: 'ATN-0003',
    date: makeWeekDayYmd(1),
    startTime: '18:00',
    endTime: '19:30',
    studentId: '10003',
    studentName: '張子軒',
    attended: true,
    createdAt: makeCurrentMonthIso(2),
  },
  {
    id: 'atn-seed-4',
    atnId: 'ATN-0004',
    date: makeWeekDayYmd(3),
    startTime: '18:00',
    endTime: '19:30',
    studentId: '10003',
    studentName: '張子軒',
    attended: true,
    createdAt: makeCurrentMonthIso(1),
  },
  {
    id: 'atn-seed-5',
    atnId: 'ATN-0005',
    date: makeWeekDayYmd(2),
    startTime: '18:00',
    endTime: '19:30',
    studentId: '10003',
    studentName: '張子軒',
    attended: true,
    createdAt: makeCurrentMonthIso(1),
  },
  {
    id: 'atn-seed-6',
    atnId: 'ATN-0006',
    date: makeWeekDayYmd(4),
    startTime: '16:00',
    endTime: '17:30',
    studentId: '10001',
    studentName: '陳小明',
    attended: false,
    createdAt: makeCurrentMonthIso(0),
  },
  {
    id: 'atn-seed-7',
    atnId: 'ATN-0007',
    date: makeWeekDayYmd(6),
    startTime: '10:30',
    endTime: '12:00',
    studentId: '10002',
    studentName: '林詩涵',
    attended: false,
    createdAt: makeCurrentMonthIso(0),
  },
];

const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: 'ev-seed-1',
    date: makeWeekDayYmd(5),
    time: '14:00',
    content: '致電陳太跟進下月課程續費',
    createdAt: makeCurrentMonthIso(0),
  },
];

function isValidFiveDigitId(val: unknown): val is string {
  return typeof val === 'string' && /^\d{5}$/.test(val);
}

function generateNextFiveDigitId(existingIds: Set<string>): string {
  let num = 10001;
  existingIds.forEach((id) => {
    const parsed = Number(id);
    if (!Number.isNaN(parsed) && parsed >= num && parsed < 99999) {
      num = parsed + 1;
    }
  });
  while (existingIds.has(String(num))) {
    num += 1;
  }
  return String(num);
}

function generateNextAtnId(existing: AttendanceRecord[]): string {
  let maxNum = 0;
  existing.forEach((rec) => {
    const match = /^ATN-(\d+)$/i.exec(rec.atnId);
    if (match) {
      const parsed = Number(match[1]);
      if (!Number.isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  });
  return `ATN-${String(maxNum + 1).padStart(4, '0')}`;
}

function normalizeTransactions(rawList: unknown[]): TransactionRecord[] {
  const nameToId = new Map<string, { id: string; canonicalName: string }>();
  const usedIds = new Set<string>();

  // First pass: register valid existing 5-digit IDs
  rawList.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const rec = item as Record<string, unknown>;
    if (typeof rec.studentName !== 'string') return;
    const cleanName = rec.studentName.trim();
    if (!cleanName) return;
    const key = cleanName.toLowerCase();
    if (!nameToId.has(key) && isValidFiveDigitId(rec.studentId) && !usedIds.has(rec.studentId)) {
      nameToId.set(key, { id: rec.studentId, canonicalName: cleanName });
      usedIds.add(rec.studentId);
    }
  });

  const normalized: TransactionRecord[] = [];
  rawList.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const rec = item as Record<string, unknown>;
    if (typeof rec.id !== 'string' || typeof rec.studentName !== 'string') return;
    const cleanName = rec.studentName.trim();
    if (!cleanName) return;

    const key = cleanName.toLowerCase();
    let identity = nameToId.get(key);
    if (!identity) {
      const newId = generateNextFiveDigitId(usedIds);
      usedIds.add(newId);
      identity = { id: newId, canonicalName: cleanName };
      nameToId.set(key, identity);
    }

    const paymentStatus: PaymentStatus = rec.paymentStatus === '未付錢' ? '未付錢' : '已付錢';
    normalized.push({
      id: rec.id,
      studentId: identity.id,
      studentName: identity.canonicalName,
      format: rec.format === '個人' ? '個人' : '小組',
      price: typeof rec.price === 'number' && !Number.isNaN(rec.price) ? Math.max(0, rec.price) : 0,
      lessons:
        typeof rec.lessons === 'number' && !Number.isNaN(rec.lessons)
          ? Math.max(0, rec.lessons)
          : 0,
      includesTrial: Boolean(rec.includesTrial),
      trialFee:
        typeof rec.trialFee === 'number' && !Number.isNaN(rec.trialFee)
          ? Math.max(0, rec.trialFee)
          : 0,
      subject: typeof rec.subject === 'string' ? rec.subject : '',
      grade: typeof rec.grade === 'string' ? rec.grade : '',
      paymentStatus,
      createdAt: typeof rec.createdAt === 'string' ? rec.createdAt : new Date().toISOString(),
    });
  });

  return normalized;
}

function loadInitialTransactions(): TransactionRecord[] {
  try {
    const saved = window.localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return normalizeTransactions(parsed);
      }
    }
  } catch {
    // Fallback to initial transactions
  }
  return INITIAL_TRANSACTIONS;
}

function loadInitialAttendance(): AttendanceRecord[] {
  try {
    const saved = window.localStorage.getItem(ATTENDANCE_STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is AttendanceRecord =>
            Boolean(item) &&
            typeof item.id === 'string' &&
            typeof item.atnId === 'string' &&
            typeof item.date === 'string' &&
            typeof item.startTime === 'string' &&
            typeof item.endTime === 'string' &&
            typeof item.studentId === 'string' &&
            typeof item.studentName === 'string'
        );
      }
    }
  } catch {
    // Fallback to initial attendance
  }
  return INITIAL_ATTENDANCE;
}

function loadHiddenStudentIds(): string[] {
  try {
    const saved = window.localStorage.getItem(HIDDEN_STUDENTS_STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter((id): id is string => typeof id === 'string');
      }
    }
  } catch {
    // Ignore malformed data
  }
  return [];
}

function loadInitialEvents(): CalendarEvent[] {
  try {
    const saved = window.localStorage.getItem(EVENTS_STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is CalendarEvent =>
            Boolean(item) &&
            typeof item.id === 'string' &&
            typeof item.date === 'string' &&
            typeof item.time === 'string' &&
            typeof item.content === 'string'
        );
      }
    }
  } catch {
    // Fallback to initial events
  }
  return INITIAL_EVENTS;
}

function computeLessonStatus(remaining: number): RemainingLessonStatus {
  if (remaining > 2) return '良好';
  if (remaining > 0) return '快用完';
  return '催繳';
}

type ActiveTab = 'transactions' | 'attendance' | 'remaining' | 'calendar';

export default function App() {
  const [transactions, setTransactions] = useState<TransactionRecord[]>(loadInitialTransactions);
  const [attendanceRecords, setAttendanceRecords] =
    useState<AttendanceRecord[]>(loadInitialAttendance);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(loadInitialEvents);
  const [hiddenStudentIds, setHiddenStudentIds] = useState<string[]>(loadHiddenStudentIds);

  const [activeTab, setActiveTab] = useState<ActiveTab>('transactions');
  const [isAddTransactionModalOpen, setIsAddTransactionModalOpen] = useState(false);
  const [isAddAttendanceModalOpen, setIsAddAttendanceModalOpen] = useState(false);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(transactions));
    } catch {
      // Ignore storage quota errors
    }
  }, [transactions]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(attendanceRecords));
    } catch {
      // Ignore storage quota errors
    }
  }, [attendanceRecords]);

  useEffect(() => {
    try {
      window.localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(calendarEvents));
    } catch {
      // Ignore storage quota errors
    }
  }, [calendarEvents]);

  useEffect(() => {
    try {
      window.localStorage.setItem(HIDDEN_STUDENTS_STORAGE_KEY, JSON.stringify(hiddenStudentIds));
    } catch {
      // Ignore storage quota errors
    }
  }, [hiddenStudentIds]);

  // Canonical list of unique students derived from Transactions and AttendanceRecords
  // Ensuring zero duplicate student names and preserving students whose transactions were deleted (negative balance)
  const students = useMemo<StudentIdentity[]>(() => {
    const map = new Map<string, StudentIdentity>();
    transactions.forEach((tx) => {
      if (!map.has(tx.studentId)) {
        map.set(tx.studentId, { id: tx.studentId, name: tx.studentName });
      }
    });
    attendanceRecords.forEach((rec) => {
      if (!map.has(rec.studentId)) {
        map.set(rec.studentId, { id: rec.studentId, name: rec.studentName });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, [transactions, attendanceRecords]);

  // Derived Remaining Lessons summary per student:
  // 剩餘堂數 = 購買堂數 - 已上堂數（試堂視為 1 整堂課，可為負數）
  const studentSummaries = useMemo<StudentLessonSummary[]>(() => {
    const hiddenSet = new Set(hiddenStudentIds);

    return students.map((stu) => {
      const studentTxs = transactions.filter((tx) => tx.studentId === stu.id);
      const purchasedLessons = studentTxs.reduce(
        (sum, tx) => sum + tx.lessons + (tx.includesTrial ? 1 : 0),
        0
      );
      const attendedLessons = attendanceRecords.filter(
        (rec) => rec.studentId === stu.id && rec.attended
      ).length;
      const remainingLessons = Math.round((purchasedLessons - attendedLessons) * 10) / 10;

      return {
        studentId: stu.id,
        studentName: stu.name,
        purchasedLessons: Math.round(purchasedLessons * 10) / 10,
        attendedLessons,
        remainingLessons,
        status: computeLessonStatus(remainingLessons),
        isHidden: hiddenSet.has(stu.id),
      };
    });
  }, [students, transactions, attendanceRecords, hiddenStudentIds]);

  const resolveStudentIdentity = (
    rawName: string,
    currentTransactions: TransactionRecord[],
    currentAttendance: AttendanceRecord[]
  ): { studentId: string; studentName: string } => {
    const cleanName = rawName.trim();
    const existingTx = currentTransactions.find(
      (tx) => tx.studentName.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (existingTx) {
      return { studentId: existingTx.studentId, studentName: existingTx.studentName };
    }
    const existingAtt = currentAttendance.find(
      (rec) => rec.studentName.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (existingAtt) {
      return { studentId: existingAtt.studentId, studentName: existingAtt.studentName };
    }
    const usedIds = new Set<string>([
      ...currentTransactions.map((tx) => tx.studentId),
      ...currentAttendance.map((rec) => rec.studentId),
    ]);
    return {
      studentId: generateNextFiveDigitId(usedIds),
      studentName: cleanName,
    };
  };

  // Transaction handlers
  const handleAddTransaction = (data: Omit<TransactionRecord, 'id' | 'studentId'>) => {
    setTransactions((prev) => {
      const identity = resolveStudentIdentity(data.studentName, prev, attendanceRecords);
      const newRecord: TransactionRecord = {
        ...data,
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        studentId: identity.studentId,
        studentName: identity.studentName,
      };
      return [newRecord, ...prev];
    });
  };

  const handleUpdateTransaction = (
    id: string,
    data: Omit<TransactionRecord, 'id' | 'studentId'>
  ) => {
    setTransactions((prev) => {
      const identity = resolveStudentIdentity(data.studentName, prev, attendanceRecords);
      return prev.map((record) =>
        record.id === id
          ? {
              ...record,
              ...data,
              studentId: identity.studentId,
              studentName: identity.studentName,
            }
          : record
      );
    });
  };

  const handleUpdatePaymentStatus = (id: string, paymentStatus: PaymentStatus) => {
    setTransactions((prev) =>
      prev.map((record) => (record.id === id ? { ...record, paymentStatus } : record))
    );
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((record) => record.id !== id));
  };

  // Attendance handlers
  const handleAddAttendance = (data: Omit<AttendanceRecord, 'id' | 'atnId' | 'createdAt'>) => {
    setAttendanceRecords((prev) => {
      const nextAtnId = generateNextAtnId(prev);
      const newRecord: AttendanceRecord = {
        ...data,
        id: `atn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        atnId: nextAtnId,
        createdAt: new Date().toISOString(),
      };
      return [newRecord, ...prev];
    });
  };

  const handleUpdateAttendance = (
    id: string,
    data: Omit<AttendanceRecord, 'id' | 'atnId' | 'createdAt'>
  ) => {
    setAttendanceRecords((prev) =>
      prev.map((rec) => (rec.id === id ? { ...rec, ...data } : rec))
    );
  };

  const handleToggleAttended = (id: string, attended: boolean) => {
    setAttendanceRecords((prev) =>
      prev.map((rec) => (rec.id === id ? { ...rec, attended } : rec))
    );
  };

  const handleDeleteAttendance = (id: string) => {
    setAttendanceRecords((prev) => prev.filter((rec) => rec.id !== id));
  };

  // Hide / Unhide student handlers
  const handleHideStudent = (studentId: string) => {
    setHiddenStudentIds((prev) => (prev.includes(studentId) ? prev : [...prev, studentId]));
  };

  const handleUnhideStudent = (studentId: string) => {
    setHiddenStudentIds((prev) => prev.filter((id) => id !== studentId));
  };

  // Calendar Event handlers
  const handleAddEvent = (data: Omit<CalendarEvent, 'id' | 'createdAt'>) => {
    const newEvent: CalendarEvent = {
      ...data,
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    setCalendarEvents((prev) => [...prev, newEvent]);
  };

  const handleUpdateEvent = (id: string, data: Omit<CalendarEvent, 'id' | 'createdAt'>) => {
    setCalendarEvents((prev) =>
      prev.map((ev) => (ev.id === id ? { ...ev, ...data } : ev))
    );
  };

  const handleDeleteEvent = (id: string) => {
    setCalendarEvents((prev) => prev.filter((ev) => ev.id !== id));
  };

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'transactions', label: '交易紀錄' },
    { id: 'attendance', label: '學生出席紀錄' },
    { id: 'remaining', label: '剩餘堂數紀錄' },
    { id: 'calendar', label: '日曆系統' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Three-Zone Top Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            李Sir教室
          </span>

          {/* Zone 2: Single-Line Tab Navigation */}
          <nav aria-label="功能模組" className="flex items-center gap-5 sm:gap-7 h-full overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={`relative h-full inline-flex items-center text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === tab.id
                    ? 'text-blue-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-700"
                  />
                )}
              </button>
            ))}
          </nav>

          {/* Zone 3: Contextual Primary Action */}
          <div className="shrink-0 min-w-[132px] flex justify-end">
            {activeTab === 'transactions' && (
              <button
                type="button"
                onClick={() => setIsAddTransactionModalOpen(true)}
                className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                加入交易紀錄
              </button>
            )}
            {activeTab === 'attendance' && (
              <button
                type="button"
                onClick={() => setIsAddAttendanceModalOpen(true)}
                className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                新增出席紀錄
              </button>
            )}
            {activeTab === 'calendar' && (
              <button
                type="button"
                onClick={() => setIsAddEventModalOpen(true)}
                className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                新增事件
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Classroom Address Strip */}
        <div className="flex items-center gap-2 text-sm text-slate-600 pb-4 border-b border-slate-200">
          <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span>教室地址：{CLASSROOM_ADDRESS}</span>
        </div>

        {activeTab === 'transactions' && (
          <TransactionLogModule
            transactions={transactions}
            students={students}
            classroomAddress={CLASSROOM_ADDRESS}
            onAddTransaction={handleAddTransaction}
            onUpdateTransaction={handleUpdateTransaction}
            onUpdatePaymentStatus={handleUpdatePaymentStatus}
            onDeleteTransaction={handleDeleteTransaction}
            isModalOpen={isAddTransactionModalOpen}
            onOpenAddModal={() => setIsAddTransactionModalOpen(true)}
            onCloseModal={() => setIsAddTransactionModalOpen(false)}
          />
        )}

        {activeTab === 'attendance' && (
          <AttendanceModule
            records={attendanceRecords}
            students={students}
            studentSummaries={studentSummaries}
            classroomAddress={CLASSROOM_ADDRESS}
            onAddRecord={handleAddAttendance}
            onUpdateRecord={handleUpdateAttendance}
            onToggleAttended={handleToggleAttended}
            onDeleteRecord={handleDeleteAttendance}
            isAddModalOpen={isAddAttendanceModalOpen}
            onOpenAddModal={() => setIsAddAttendanceModalOpen(true)}
            onCloseAddModal={() => setIsAddAttendanceModalOpen(false)}
          />
        )}

        {activeTab === 'remaining' && (
          <RemainingLessonsModule
            summaries={studentSummaries}
            onHideStudent={handleHideStudent}
            onUnhideStudent={handleUnhideStudent}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarModule
            attendanceRecords={attendanceRecords}
            calendarEvents={calendarEvents}
            onToggleAttended={handleToggleAttended}
            onAddEvent={handleAddEvent}
            onUpdateEvent={handleUpdateEvent}
            onDeleteEvent={handleDeleteEvent}
            isAddEventModalOpen={isAddEventModalOpen}
            onOpenAddEventModal={() => setIsAddEventModalOpen(true)}
            onCloseAddEventModal={() => setIsAddEventModalOpen(false)}
          />
        )}
      </main>
    </div>
  );
}
