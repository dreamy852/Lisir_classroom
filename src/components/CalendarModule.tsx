import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import { AttendanceRecord } from '../types/attendance';
import { CalendarEvent } from '../types/calendar';

interface CalendarModuleProps {
  attendanceRecords: AttendanceRecord[];
  calendarEvents: CalendarEvent[];
  onToggleAttended: (id: string, attended: boolean) => void;
  onAddEvent: (data: Omit<CalendarEvent, 'id' | 'createdAt'>) => void;
  onUpdateEvent: (id: string, data: Omit<CalendarEvent, 'id' | 'createdAt'>) => void;
  onDeleteEvent: (id: string) => void;
  isAddEventModalOpen: boolean;
  onOpenAddEventModal: () => void;
  onCloseAddEventModal: () => void;
}

const WEEKDAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'] as const;

type DayEntry =
  | { kind: 'class'; sortTime: string; record: AttendanceRecord }
  | { kind: 'event'; sortTime: string; event: CalendarEvent };

function parseYmd(ymd: string): Date | null {
  const parts = ymd.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getSundayOfWeek(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function maskNameWithO(name: string): string {
  return Array.from(name)
    .map((ch) => (/\s/.test(ch) ? ch : 'O'))
    .join('');
}

export const CalendarModule: React.FC<CalendarModuleProps> = ({
  attendanceRecords,
  calendarEvents,
  onToggleAttended,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  isAddEventModalOpen,
  onOpenAddEventModal,
  onCloseAddEventModal,
}) => {
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }, []);

  const currentWeekKey = useMemo(() => formatYmd(getSundayOfWeek(today)), [today]);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(currentWeekKey);
  const [hideNames, setHideNames] = useState(false);

  // Event modal state (add / edit)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [isEditEventModalOpen, setIsEditEventModalOpen] = useState(false);
  const [eventDate, setEventDate] = useState(() => formatYmd(today));
  const [eventTime, setEventTime] = useState('14:00');
  const [eventContent, setEventContent] = useState('');
  const [eventError, setEventError] = useState('');

  // Inline delete confirmation state for red events
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  const contentInputRef = useRef<HTMLInputElement>(null);
  const eventModalOpen = isAddEventModalOpen || isEditEventModalOpen;

  useEffect(() => {
    if (isAddEventModalOpen) {
      setEditingEvent(null);
      setEventDate(formatYmd(today));
      setEventTime('14:00');
      setEventContent('');
      setEventError('');
      const timer = window.setTimeout(() => {
        contentInputRef.current?.focus();
      }, 40);
      return () => window.clearTimeout(timer);
    }
  }, [isAddEventModalOpen, today]);

  useEffect(() => {
    if (!eventModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeEventModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [eventModalOpen]);

  const closeEventModal = () => {
    setIsEditEventModalOpen(false);
    setEditingEvent(null);
    setEventError('');
    onCloseAddEventModal();
  };

  const openEditEventModal = (ev: CalendarEvent) => {
    setDeletingEventId(null);
    setEditingEvent(ev);
    setEventDate(ev.date);
    setEventTime(ev.time);
    setEventContent(ev.content);
    setEventError('');
    setIsEditEventModalOpen(true);
    window.setTimeout(() => {
      contentInputRef.current?.focus();
    }, 40);
  };

  const handleEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedContent = eventContent.trim();
    if (!eventDate) {
      setEventError('請選擇日期');
      return;
    }
    if (!eventTime) {
      setEventError('請選擇時間');
      return;
    }
    if (!trimmedContent) {
      setEventError('請輸入事件內容');
      contentInputRef.current?.focus();
      return;
    }

    const payload = {
      date: eventDate,
      time: eventTime,
      content: trimmedContent,
    };

    if (editingEvent) {
      onUpdateEvent(editingEvent.id, payload);
    } else {
      onAddEvent(payload);
    }
    closeEventModal();
  };

  // Build list of selectable weeks ordered from latest to earliest
  const weekOptions = useMemo(() => {
    const sundayKeys = new Set<string>();
    const currentSunday = getSundayOfWeek(today);

    for (let offset = -4; offset <= 6; offset += 1) {
      sundayKeys.add(formatYmd(addDays(currentSunday, offset * 7)));
    }

    attendanceRecords.forEach((rec) => {
      const parsed = parseYmd(rec.date);
      if (parsed) {
        sundayKeys.add(formatYmd(getSundayOfWeek(parsed)));
      }
    });

    calendarEvents.forEach((ev) => {
      const parsed = parseYmd(ev.date);
      if (parsed) {
        sundayKeys.add(formatYmd(getSundayOfWeek(parsed)));
      }
    });

    return Array.from(sundayKeys)
      .sort((a, b) => b.localeCompare(a))
      .map((sundayStr) => {
        const sunday = parseYmd(sundayStr)!;
        const saturday = addDays(sunday, 6);
        const saturdayStr = formatYmd(saturday);

        let tag = '';
        if (sundayStr === currentWeekKey) {
          tag = '（本週）';
        } else if (sundayStr === formatYmd(addDays(currentSunday, 7))) {
          tag = '（下週）';
        } else if (sundayStr === formatYmd(addDays(currentSunday, -7))) {
          tag = '（上週）';
        }

        return {
          key: sundayStr,
          label: `${sundayStr} 至 ${saturdayStr}${tag}`,
        };
      });
  }, [attendanceRecords, calendarEvents, today, currentWeekKey]);

  const weekDays = useMemo(() => {
    const sunday = parseYmd(selectedWeekStart) ?? getSundayOfWeek(today);
    const todayStr = formatYmd(today);

    return WEEKDAY_LABELS.map((label, idx) => {
      const dateObj = addDays(sunday, idx);
      const dateStr = formatYmd(dateObj);

      const classEntries: DayEntry[] = attendanceRecords
        .filter((rec) => rec.date === dateStr)
        .map((record) => ({
          kind: 'class',
          sortTime: record.startTime,
          record,
        }));

      const eventEntries: DayEntry[] = calendarEvents
        .filter((ev) => ev.date === dateStr)
        .map((event) => ({
          kind: 'event',
          sortTime: event.time,
          event,
        }));

      const entries = [...classEntries, ...eventEntries].sort((a, b) => {
        const timeCompare = a.sortTime.localeCompare(b.sortTime);
        if (timeCompare !== 0) return timeCompare;
        if (a.kind !== b.kind) return a.kind === 'event' ? -1 : 1;
        return 0;
      });

      return {
        label,
        dateStr,
        shortDate: `${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(
          dateObj.getDate()
        ).padStart(2, '0')}`,
        isToday: dateStr === todayStr,
        entries,
      };
    });
  }, [selectedWeekStart, attendanceRecords, calendarEvents, today]);

  const weekCounts = useMemo(() => {
    let pending = 0;
    let attended = 0;
    let events = 0;
    weekDays.forEach((day) => {
      day.entries.forEach((entry) => {
        if (entry.kind === 'event') {
          events += 1;
        } else if (entry.record.attended) {
          attended += 1;
        } else {
          pending += 1;
        }
      });
    });
    return { pending, attended, events };
  }, [weekDays]);

  return (
    <section aria-labelledby="calendar-heading" className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <h1
            id="calendar-heading"
            className="text-2xl font-bold tracking-tight text-slate-900 text-balance"
          >
            日曆系統
          </h1>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-slate-600 tabular-nums">
            <span>
              本週未出席{' '}
              <strong className="font-semibold text-blue-700">{weekCounts.pending}</strong> 節
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span>
              已出席{' '}
              <strong className="font-semibold text-slate-900">{weekCounts.attended}</strong> 節
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span>
              事件{' '}
              <strong className="font-semibold text-red-700">{weekCounts.events}</strong> 項
            </span>
          </div>
          <p className="text-xs text-slate-500">
            點擊藍色課堂區塊可即時切換「已出席（半透明）」／「未出席」，同步更新學生出席紀錄與剩餘堂數紀錄。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setHideNames((prev) => !prev)}
            aria-pressed={hideNames}
            className={`inline-flex items-center gap-1.5 h-10 px-3.5 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              hideNames
                ? 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {hideNames ? (
              <Eye className="h-4 w-4" aria-hidden="true" />
            ) : (
              <EyeOff className="h-4 w-4 text-slate-500" aria-hidden="true" />
            )}
            {hideNames ? '顯示姓名' : '隱藏姓名'}
          </button>

          <button
            type="button"
            onClick={onOpenAddEventModal}
            className="inline-flex items-center gap-1.5 h-10 px-3.5 text-sm font-medium text-red-700 bg-white border border-red-200 hover:border-red-300 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4 text-red-600" aria-hidden="true" />
            新增事件
          </button>

          <div className="inline-flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-slate-500 shrink-0" aria-hidden="true" />
            <label htmlFor="calendar-week-select" className="sr-only">
              選擇星期（由最新到最早）
            </label>
            <select
              id="calendar-week-select"
              value={selectedWeekStart}
              onChange={(e) => setSelectedWeekStart(e.target.value)}
              className="h-10 px-3 font-mono text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 cursor-pointer tabular-nums"
            >
              {weekOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 7-Day Calendar Grid (週日 -> 週六) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {weekDays.map((day) => (
            <div key={day.dateStr} className="flex flex-col min-h-[220px] md:min-h-[380px]">
              {/* Day Column Header */}
              <div
                className={`px-3.5 py-3 border-b border-slate-200 flex items-center justify-between md:flex-col md:items-start md:gap-0.5 ${
                  day.isToday ? 'bg-blue-50/70' : 'bg-slate-50/70'
                }`}
              >
                <span
                  className={`text-xs font-semibold ${
                    day.isToday ? 'text-blue-700' : 'text-slate-700'
                  }`}
                >
                  {day.label}
                  {day.isToday ? ' · 今天' : ''}
                </span>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {day.shortDate}
                </span>
              </div>

              {/* Chronological Time Blocks */}
              <div className="flex-1 p-2.5 space-y-2">
                {day.entries.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">無安排</p>
                ) : (
                  day.entries.map((entry) => {
                    if (entry.kind === 'event') {
                      const ev = entry.event;
                      const isDeleting = deletingEventId === ev.id;

                      return (
                        <div
                          key={`event-${ev.id}`}
                          className="p-2.5 rounded-lg border border-red-200 bg-red-50/90 text-red-950 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1 text-xs font-mono font-semibold text-red-700 tabular-nums">
                              <Clock className="h-3 w-3 shrink-0 text-red-600" aria-hidden="true" />
                              <span>{ev.time}</span>
                            </div>

                            {!isDeleting && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => openEditEventModal(ev)}
                                  aria-label={`編輯事件 ${ev.content}`}
                                  title="編輯事件"
                                  className="inline-flex items-center justify-center h-6 w-6 rounded text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
                                >
                                  <Pencil className="h-3 w-3" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingEventId(ev.id)}
                                  aria-label={`刪除事件 ${ev.content}`}
                                  title="刪除事件"
                                  className="inline-flex items-center justify-center h-6 w-6 rounded text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
                                >
                                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </div>
                            )}
                          </div>

                          <p className="text-sm font-medium text-red-900 leading-snug break-words">
                            {ev.content}
                          </p>

                          {isDeleting && (
                            <div className="pt-1.5 border-t border-red-200 space-y-1.5">
                              <p className="text-xs font-medium text-red-800">確定刪除此事件？</p>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteEvent(ev.id);
                                    setDeletingEventId(null);
                                  }}
                                  className="h-7 px-2.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  確認
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingEventId(null)}
                                  className="h-7 px-2.5 text-xs font-medium text-red-800 bg-white border border-red-200 hover:bg-red-50 rounded transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  取消
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }

                    const rec = entry.record;
                    const displayedName = hideNames
                      ? maskNameWithO(rec.studentName)
                      : rec.studentName;

                    return (
                      <button
                        key={`class-${rec.id}`}
                        type="button"
                        onClick={() => onToggleAttended(rec.id, !rec.attended)}
                        aria-pressed={rec.attended}
                        title={
                          rec.attended
                            ? '已出席（點擊轉為未出席）'
                            : '未出席（點擊轉為已出席）'
                        }
                        className={`w-full text-left p-2.5 rounded-lg border transition-all space-y-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 ${
                          rec.attended
                            ? 'border-blue-200 bg-blue-50/70 opacity-45 hover:opacity-75'
                            : 'border-blue-300 bg-blue-50 hover:bg-blue-100/80 opacity-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 text-xs font-mono font-semibold text-blue-700 tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3 shrink-0 text-blue-600" aria-hidden="true" />
                            {rec.startTime}–{rec.endTime}
                          </span>
                          <span className="font-sans text-[11px] font-medium text-blue-700">
                            {rec.attended ? '已出席' : '未出席'}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-900 leading-snug">
                          {displayedName}
                        </p>
                        <p className="text-xs font-mono text-slate-500 tabular-nums">
                          {rec.studentId} · {rec.atnId}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add / Edit Event Modal */}
      {eventModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeEventModal();
            }
          }}
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 id="event-modal-title" className="text-base font-semibold text-slate-900">
                {editingEvent ? '編輯事件' : '新增事件'}
              </h2>
              <button
                type="button"
                onClick={closeEventModal}
                aria-label="關閉視窗"
                className="inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleEventSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="ev-date" className="block text-sm font-medium text-slate-700">
                    日期
                  </label>
                  <input
                    id="ev-date"
                    type="date"
                    value={eventDate}
                    onChange={(e) => {
                      setEventDate(e.target.value);
                      if (eventError) setEventError('');
                    }}
                    className="w-full h-10 px-3 font-mono text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/15"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="ev-time" className="block text-sm font-medium text-slate-700">
                    時間
                  </label>
                  <input
                    id="ev-time"
                    type="time"
                    value={eventTime}
                    onChange={(e) => {
                      setEventTime(e.target.value);
                      if (eventError) setEventError('');
                    }}
                    className="w-full h-10 px-3 font-mono text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/15"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="ev-content" className="block text-sm font-medium text-slate-700">
                  事件內容
                </label>
                <input
                  ref={contentInputRef}
                  id="ev-content"
                  type="text"
                  value={eventContent}
                  onChange={(e) => {
                    setEventContent(e.target.value);
                    if (eventError) setEventError('');
                  }}
                  placeholder="例如：家長電話聯絡、公眾假期休息"
                  className="w-full h-10 px-3 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg placeholder:text-slate-400 focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/15"
                />
              </div>

              {eventError && (
                <p className="text-xs font-medium text-red-600" role="alert">
                  {eventError}
                </p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeEventModal}
                  className="h-10 px-4 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="h-10 px-4 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {editingEvent ? '儲存變更' : '確認新增'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
