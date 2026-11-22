import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flag,
  LayoutGrid,
  Send,
  ShieldAlert,
  X,
} from 'lucide-react';
import { SUBJECT_NAME } from '../config/examConfig';
import { OptionLetter, PacketCode, ShuffledQuestion, Student } from '../types/cbt';

interface ExamWorkspaceProps {
  student: Student;
  packetCode: PacketCode;
  questions: ShuffledQuestion[];
  answers: Record<string, OptionLetter>;
  doubtIds: string[];
  tabViolations: number;
  endTimestamp: number;
  currentIndex: number;
  isSubmitting: boolean;
  onSelectAnswer: (questionId: string, displayLetter: OptionLetter) => void;
  onToggleDoubt: (questionId: string) => void;
  onChangeIndex: (newIndex: number) => void;
  onRecordTabViolation: () => void;
  onSubmitExam: (isTimeout: boolean) => void;
}

function formatSecondsMMSS(totalSec: number): string {
  const clamped = Math.max(0, Math.floor(totalSec));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const ExamWorkspace: React.FC<ExamWorkspaceProps> = ({
  student,
  packetCode,
  questions,
  answers,
  doubtIds,
  tabViolations,
  endTimestamp,
  currentIndex,
  isSubmitting,
  onSelectAnswer,
  onToggleDoubt,
  onChangeIndex,
  onRecordTabViolation,
  onSubmitExam,
}) => {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() =>
    Math.max(0, Math.ceil((endTimestamp - Date.now()) / 1000))
  );
  const [showViolationModal, setShowViolationModal] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [showMobileGrid, setShowMobileGrid] = useState<boolean>(false);

  const timeoutTriggeredRef = useRef<boolean>(false);
  const lastViolationTimestampRef = useRef<number>(0);

  // Timer tersinkronisasi dengan endTimestamp (anti-drift saat reload/sleep)
  useEffect(() => {
    const updateTimer = () => {
      const diff = Math.max(0, Math.ceil((endTimestamp - Date.now()) / 1000));
      setRemainingSeconds(diff);
      if (diff <= 0 && !timeoutTriggeredRef.current && !isSubmitting) {
        timeoutTriggeredRef.current = true;
        onSubmitExam(true);
      }
    };

    updateTimer();
    const interval = window.setInterval(updateTimer, 500);
    return () => window.clearInterval(interval);
  }, [endTimestamp, isSubmitting, onSubmitExam]);

  // Deteksi perpindahan tab/jendela dengan debounce 1500ms & perlindungan iframe Blogger
  useEffect(() => {
    const isEmbeddedIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

    const triggerViolation = () => {
      if (isSubmitting || timeoutTriggeredRef.current) return;
      const now = Date.now();
      if (now - lastViolationTimestampRef.current < 1500) {
        return;
      }
      lastViolationTimestampRef.current = now;
      onRecordTabViolation();
      setShowViolationModal(true);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolation();
      }
    };

    const handleWindowBlur = () => {
      if (isEmbeddedIframe) {
        // Saat di-embed di Blogger, abaikan blur ringan jika tab browser masih aktif (misal klik area blog)
        window.setTimeout(() => {
          if (document.hidden) {
            triggerViolation();
          }
        }, 250);
      } else {
        triggerViolation();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isSubmitting, onRecordTabViolation]);

  const activeQuestion = questions[currentIndex] ?? questions[0];
  const activeAnswer = answers[activeQuestion.questionId];
  const isDoubt = doubtIds.includes(activeQuestion.questionId);

  const stats = useMemo(() => {
    const answeredCount = Object.keys(answers).length;
    const doubtCount = doubtIds.length;
    const unansweredCount = Math.max(0, questions.length - answeredCount);
    return { answeredCount, doubtCount, unansweredCount };
  }, [answers, doubtIds, questions.length]);

  // Kelompokkan 50 nomor per 10 nomor (1–10, 11–20, 21–30, 31–40, 41–50)
  const questionGroups = useMemo(() => {
    const groups: { label: string; items: ShuffledQuestion[] }[] = [];
    for (let start = 0; start < questions.length; start += 10) {
      const end = Math.min(questions.length, start + 10);
      groups.push({
        label: `Nomor ${start + 1}–${end}`,
        items: questions.slice(start, end),
      });
    }
    return groups;
  }, [questions]);

  const isWarningTime = remainingSeconds <= 600 && remainingSeconds > 180;
  const isCriticalTime = remainingSeconds <= 180;

  const handleJumpToQuestion = (idx: number) => {
    onChangeIndex(idx);
    setShowMobileGrid(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderNumberMatrix = () => (
    <div className="space-y-4">
      {questionGroups.map((group) => (
        <div key={group.label}>
          <div className="mb-1.5 text-xs font-semibold text-slate-500 tabular-nums">
            {group.label}
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {group.items.map((q) => {
              const idx = q.displayNumber - 1;
              const isActive = idx === currentIndex;
              const isAnswered = Boolean(answers[q.questionId]);
              const isItemDoubt = doubtIds.includes(q.questionId);

              let btnStyle =
                'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50';
              if (isItemDoubt) {
                btnStyle = 'border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100';
              } else if (isAnswered) {
                btnStyle =
                  'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100';
              }

              return (
                <button
                  key={q.questionId}
                  type="button"
                  onClick={() => handleJumpToQuestion(idx)}
                  aria-label={`Soal ${q.displayNumber}${
                    isItemDoubt ? ', Ragu-ragu' : isAnswered ? ', Sudah dijawab' : ', Belum dijawab'
                  }`}
                  className={`relative flex h-11 sm:h-10 items-center justify-center rounded-lg border font-mono text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${btnStyle} ${
                    isActive ? 'ring-2 ring-blue-700 ring-offset-1 border-blue-700' : ''
                  }`}
                >
                  <span>{q.displayNumber}</span>
                  {isItemDoubt ? (
                    <Flag
                      className="absolute right-1 top-1 h-2.5 w-2.5 fill-amber-500 text-amber-600"
                      aria-hidden="true"
                    />
                  ) : isAnswered ? (
                    <span
                      className="absolute right-1 top-1 text-[9px] font-bold text-emerald-700"
                      aria-hidden="true"
                    >
                      {answers[q.questionId]}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-24 lg:pb-12">
      {/* Compact Sticky Exam Workspace Header (Mobile <= 58px, Desktop full metadata) */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
          {/* Left: Compact on mobile, full on sm+ */}
          <div className="min-w-0 flex-1">
            <div className="hidden sm:flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-slate-500">
              <span className="truncate font-semibold text-slate-700">{student.sekolah}</span>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap">{SUBJECT_NAME}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-semibold text-blue-700 whitespace-nowrap">
                Paket {packetCode}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-900">
              <span className="sm:hidden font-mono font-bold text-blue-700 shrink-0">
                Pkt {packetCode}
              </span>
              <span className="sm:hidden text-slate-300" aria-hidden="true">
                ·
              </span>
              <span className="truncate">{student.nama}</span>
              <span aria-hidden="true" className="hidden sm:inline text-slate-300">
                /
              </span>
              <span className="hidden sm:inline font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                {student.kelas} · Absen {student.noAbsen}
              </span>
            </div>
          </div>

          {/* Right: Tabular Timer & Submit Action */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 sm:px-3.5 sm:py-2 ${
                isCriticalTime
                  ? 'border-red-300 bg-red-50 text-red-800'
                  : isWarningTime
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-slate-200 bg-slate-50 text-slate-900'
              }`}
            >
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden="true" />
              <div className="flex items-baseline gap-1.5">
                <span className="hidden md:inline text-xs font-medium">Sisa Waktu</span>
                <span className="font-mono text-sm sm:text-base font-bold tabular-nums">
                  {formatSecondsMMSS(remainingSeconds)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-xl bg-blue-700 px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden="true" />
              <span className="sm:hidden">{isSubmitting ? '...' : 'Kirim'}</span>
              <span className="hidden sm:inline">
                {isSubmitting ? 'Mengirim...' : 'Selesai & Kirim Ujian'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main 2-Column Exam Canvas */}
      <div className="mx-auto mt-4 sm:mt-6 grid max-w-7xl grid-cols-1 gap-6 px-3 sm:px-6 lg:grid-cols-12 items-start">
        {/* Left Zone: Active Question */}
        <section className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-8 shadow-xs">
          {/* Question Metadata Header */}
          <div className="mb-4 sm:mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3.5 sm:pb-4">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-medium text-slate-500">
              <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                Soal {activeQuestion.displayNumber} / {questions.length}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-blue-700">{activeQuestion.lkpd}</span>
              <span aria-hidden="true">·</span>
              <span>{activeQuestion.topic}</span>
            </div>

            {isDoubt && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                <Flag className="h-3.5 w-3.5 fill-amber-500 text-amber-600" aria-hidden="true" />
                <span>Ragu-Ragu</span>
              </div>
            )}
          </div>

          {/* Question Prompt */}
          <div className="space-y-4">
            <p className="text-[15px] sm:text-lg leading-relaxed font-medium text-slate-900">
              {activeQuestion.prompt}
            </p>

            {activeQuestion.codeSnippet && (
              <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-3.5 sm:p-4 font-mono text-xs sm:text-sm leading-relaxed text-slate-100">
                <code>{activeQuestion.codeSnippet}</code>
              </pre>
            )}
          </div>

          {/* Radio Options A-E */}
          <div
            className="mt-5 sm:mt-6 space-y-2.5 sm:space-y-3"
            role="radiogroup"
            aria-label={`Pilihan soal ${activeQuestion.displayNumber}`}
          >
            {activeQuestion.options.map((opt) => {
              const isSelected = activeAnswer === opt.displayLetter;
              return (
                <button
                  key={opt.displayLetter}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onSelectAnswer(activeQuestion.questionId, opt.displayLetter)}
                  className={`flex w-full items-start gap-3 sm:gap-3.5 rounded-xl border p-3.5 sm:p-4 text-left transition-colors min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 text-slate-950'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50/80'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold transition-colors ${
                      isSelected
                        ? 'bg-blue-700 text-white'
                        : 'border border-slate-300 bg-slate-50 text-slate-700'
                    }`}
                  >
                    {opt.displayLetter}
                  </span>
                  <span className="flex-1 text-sm sm:text-base leading-relaxed">{opt.text}</span>
                </button>
              );
            })}
          </div>

          {/* Desktop Action Bar (hidden on mobile; mobile uses thumb-friendly fixed bottom bar) */}
          <div className="mt-8 hidden lg:flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={() => handleJumpToQuestion(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Sebelumnya</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleDoubt(activeQuestion.questionId)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                isDoubt
                  ? 'border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Flag
                className={`h-4 w-4 ${isDoubt ? 'fill-amber-500 text-amber-600' : 'text-slate-500'}`}
                aria-hidden="true"
              />
              <span>{isDoubt ? 'Hapus Ragu-Ragu' : 'Tandai Ragu-Ragu'}</span>
            </button>

            {currentIndex < questions.length - 1 ? (
              <button
                type="button"
                onClick={() => handleJumpToQuestion(Math.min(questions.length - 1, currentIndex + 1))}
                className="flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
              >
                <span>Simpan & Lanjutkan</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 whitespace-nowrap shrink-0"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>Selesai & Kirim Ujian</span>
              </button>
            )}
          </div>
        </section>

        {/* Right Zone: Desktop 50-Number Navigation Panel */}
        <aside className="hidden lg:block lg:col-span-4 lg:sticky lg:top-24 space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Navigasi Soal (1–50)
              </h2>
              <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums">
                {stats.answeredCount}/50 Terjawab
              </span>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-2 py-2">
                <div className="font-mono text-base font-bold text-emerald-800 tabular-nums">
                  {stats.answeredCount}
                </div>
                <div className="text-[11px] font-medium text-emerald-700">Terjawab</div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-2 py-2">
                <div className="font-mono text-base font-bold text-amber-800 tabular-nums">
                  {stats.doubtCount}
                </div>
                <div className="text-[11px] font-medium text-amber-700">Ragu-Ragu</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
                <div className="font-mono text-base font-bold text-slate-700 tabular-nums">
                  {stats.unansweredCount}
                </div>
                <div className="text-[11px] font-medium text-slate-500">Kosong</div>
              </div>
            </div>

            {renderNumberMatrix()}

            {/* Legend */}
            <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded border-2 border-blue-700 bg-white" aria-hidden="true" />
                <span>Sedang Aktif</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded border border-emerald-400 bg-emerald-50" aria-hidden="true" />
                <span>Sudah Dijawab</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-4 w-4 items-center justify-center rounded border border-amber-400 bg-amber-50">
                  <Flag className="h-2.5 w-2.5 fill-amber-500 text-amber-600" aria-hidden="true" />
                </span>
                <span>Ragu-Ragu</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded border border-slate-300 bg-white" aria-hidden="true" />
                <span>Belum Dijawab</span>
              </div>
            </div>

            {/* Focus Violations Counter */}
            <div
              className={`mt-4 flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs ${
                tabViolations > 0
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Pelanggaran Fokus Tab</span>
              </span>
              <span className="font-mono font-bold tabular-nums">{tabViolations} kali</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile Thumb-Friendly Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Navigasi cepat soal mobile"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-2.5 py-2 backdrop-blur-sm lg:hidden"
      >
        <div className="mx-auto grid max-w-xl grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={() => handleJumpToQuestion(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="flex h-11 items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Prev</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleDoubt(activeQuestion.questionId)}
            className={`flex h-11 items-center justify-center gap-1 rounded-xl border px-2 text-xs font-semibold ${
              isDoubt
                ? 'border-amber-400 bg-amber-50 text-amber-900'
                : 'border-slate-300 bg-white text-slate-700'
            }`}
          >
            <Flag
              className={`h-3.5 w-3.5 shrink-0 ${
                isDoubt ? 'fill-amber-500 text-amber-600' : 'text-slate-500'
              }`}
              aria-hidden="true"
            />
            <span>Ragu</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMobileGrid(true)}
            className="flex h-11 items-center justify-center gap-1 rounded-xl border border-slate-300 bg-slate-50 px-2 font-mono text-xs font-bold text-slate-800 tabular-nums"
          >
            <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-blue-700" aria-hidden="true" />
            <span>{stats.answeredCount}/50</span>
          </button>

          {currentIndex < questions.length - 1 ? (
            <button
              type="button"
              onClick={() => handleJumpToQuestion(Math.min(questions.length - 1, currentIndex + 1))}
              className="flex h-11 items-center justify-center gap-1 rounded-xl bg-blue-700 px-2 text-xs font-semibold text-white"
            >
              <span>Lanjut</span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="flex h-11 items-center justify-center gap-1 rounded-xl bg-emerald-700 px-2 text-xs font-semibold text-white"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Selesai</span>
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Slide-Up Drawer: Peta 50 Soal */}
      {showMobileGrid && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-xs lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Daftar nomor soal 1 sampai 50"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Pilih Nomor Soal (1–50)
                </h3>
                <p className="text-xs text-slate-500 tabular-nums">
                  Terjawab {stats.answeredCount} · Ragu {stats.doubtCount} · Kosong{' '}
                  {stats.unansweredCount}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileGrid(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                aria-label="Tutup daftar soal"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {renderNumberMatrix()}

            <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700">
              <span>Pelanggaran Fokus Tab</span>
              <span className="font-mono font-bold tabular-nums">{tabViolations} kali</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal Peringatan Pelanggaran Tab/Jendela */}
      {showViolationModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="violation-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3
                  id="violation-modal-title"
                  className="font-display text-lg font-bold text-slate-900"
                >
                  Peringatan Fokus Ujian
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  Sistem mendeteksi Anda meninggalkan tab atau jendela ujian. Aktivitas ini dicatat
                  otomatis dan akan dikirimkan bersama lembar jawaban Anda.
                </p>
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-mono text-xs font-semibold text-red-800 tabular-nums">
                  Total pelanggaran tercatat: {tabViolations} kali
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowViolationModal(false)}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                Saya Mengerti & Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Selesai Ujian */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-submit-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3
              id="confirm-submit-title"
              className="font-display text-lg font-bold text-slate-900"
            >
              Konfirmasi Pengiriman Ujian
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Pastikan seluruh jawaban telah diperiksa sebelum dikirim. Setelah dikirim, Anda tidak
              dapat mengubah jawaban kembali.
            </p>

            <dl className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-600">Jumlah Soal Terjawab</dt>
                <dd className="font-mono font-bold text-emerald-700 tabular-nums">
                  {stats.answeredCount} / {questions.length}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-600">Ditandai Ragu-Ragu</dt>
                <dd className="font-mono font-bold text-amber-700 tabular-nums">
                  {stats.doubtCount} soal
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-600">Belum Dijawab</dt>
                <dd className="font-mono font-bold text-slate-900 tabular-nums">
                  {stats.unansweredCount} soal
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                <dt className="text-slate-600">Pelanggaran Fokus Tab</dt>
                <dd className="font-mono font-bold text-slate-900 tabular-nums">
                  {tabViolations} kali
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Periksa Kembali
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  onSubmitExam(false);
                }}
                disabled={isSubmitting}
                className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50"
              >
                {isSubmitting ? 'Mengenkripsi & Mengirim...' : 'Ya, Kirim Ujian Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
