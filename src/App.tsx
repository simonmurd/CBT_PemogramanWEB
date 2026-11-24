import { useCallback, useEffect, useRef, useState } from 'react';
import { ExamSummary } from './components/ExamSummary';
import { ExamWorkspace } from './components/ExamWorkspace';
import { AppViewMode, HeaderBar } from './components/HeaderBar';
import { LoginPortal } from './components/LoginPortal';
import { TeacherPortal } from './components/TeacherPortal';
import {
  ENCRYPTION_VERSION,
  EXAM_DURATION_MINUTES,
  STORAGE_KEYS,
  SUBJECT_NAME,
  TOTAL_QUESTIONS_PER_PACKET,
} from './config/examConfig';
import { QUESTION_BANK } from './data/questions';
import { STUDENTS } from './data/students';
import {
  AppsScriptSubmissionPayload,
  DecryptedExamResult,
  ExamProgressStorage,
  ItemBreakdown,
  OptionLetter,
  PacketCode,
  ServerSyncStatus,
  ShuffledQuestion,
  Student,
  StudentBackupRecord,
} from './types/cbt';
import { submitExamToAppsScript } from './utils/appsScript';
import { encryptExamResult } from './utils/crypto';
import { buildStudentExamPaper, getWibDateKey } from './utils/prng';

function loadSavedProgress(): ExamProgressStorage | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EXAM_PROGRESS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExamProgressStorage;
    if (!parsed || !parsed.studentId || !parsed.endTimestamp) return null;

    const savedDateKey = parsed.examDateKey || getWibDateKey(parsed.startTimestamp);
    const todayDateKey = getWibDateKey();
    // Jika sesi berasal dari hari berbeda dan waktunya sudah habis, bersihkan agar hari baru mendapat paket baru
    if (savedDateKey !== todayDateKey && Date.now() > parsed.endTimestamp) {
      localStorage.removeItem(STORAGE_KEYS.EXAM_PROGRESS);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function loadSavedSummary(): StudentBackupRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LAST_SUBMISSION);
    if (!raw) return null;
    return JSON.parse(raw) as StudentBackupRecord;
  } catch {
    return null;
  }
}

export default function App() {
  const [view, setView] = useState<AppViewMode>('login');

  // Active exam state
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [packetCode, setPacketCode] = useState<PacketCode>('A');
  const [examDateKey, setExamDateKey] = useState<string>(() => getWibDateKey());
  const [questions, setQuestions] = useState<ShuffledQuestion[]>([]);
  const [tokenUjian, setTokenUjian] = useState<string>('');
  const [answers, setAnswers] = useState<Record<string, OptionLetter>>({});
  const [doubtIds, setDoubtIds] = useState<string[]>([]);
  const [tabViolations, setTabViolations] = useState<number>(0);
  const [startTimestamp, setStartTimestamp] = useState<number>(0);
  const [endTimestamp, setEndTimestamp] = useState<number>(0);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Summary state (strictly score-free)
  const [summaryRecord, setSummaryRecord] = useState<StudentBackupRecord | null>(null);
  const [syncStatus, setSyncStatus] = useState<ServerSyncStatus>('idle');
  const [syncMessage, setSyncMessage] = useState<string>('');

  // Ephemeral retry payload stored only in memory (never in localStorage)
  const pendingPayloadRef = useRef<AppsScriptSubmissionPayload | null>(null);

  // Restore saved active session or summary on initial mount
  useEffect(() => {
    const savedProgress = loadSavedProgress();
    if (savedProgress) {
      const student = STUDENTS.find((s) => s.id === savedProgress.studentId);
      if (student) {
        const sessionDateKey =
          savedProgress.examDateKey || getWibDateKey(savedProgress.startTimestamp);
        const paper = buildStudentExamPaper(student, QUESTION_BANK, sessionDateKey);
        setActiveStudent(student);
        setPacketCode(paper.packetCode);
        setExamDateKey(sessionDateKey);
        setQuestions(paper.questions);
        setTokenUjian(savedProgress.tokenUjian);
        setAnswers(savedProgress.answers || {});
        setDoubtIds(savedProgress.doubtIds || []);
        setTabViolations(savedProgress.tabViolations || 0);
        setStartTimestamp(savedProgress.startTimestamp);
        setEndTimestamp(savedProgress.endTimestamp);
        setCurrentIndex(savedProgress.currentIndex || 0);
        setView('exam');
        return;
      }
    }

    const savedSummary = loadSavedSummary();
    if (savedSummary) {
      setSummaryRecord(savedSummary);
      setSyncStatus(savedSummary.serverSyncStatus);
      setSyncMessage(
        savedSummary.serverSyncStatus === 'success'
          ? 'Data hasil ujian telah dikirim ke Google Apps Script.'
          : 'Silakan gunakan cadangan JSON/CSV atau kirim ulang bila perlu.'
      );
    }
  }, []);

  // Persist active exam progress automatically to localStorage (no keys/scores stored)
  useEffect(() => {
    if (!activeStudent || view !== 'exam') return;
    const snapshot: ExamProgressStorage = {
      studentId: activeStudent.id,
      packetCode,
      examDateKey,
      tokenUjian,
      answers,
      doubtIds,
      tabViolations,
      startTimestamp,
      endTimestamp,
      currentIndex,
    };
    try {
      localStorage.setItem(STORAGE_KEYS.EXAM_PROGRESS, JSON.stringify(snapshot));
    } catch {
      // Ignore storage quota errors gracefully
    }
  }, [
    activeStudent,
    view,
    packetCode,
    examDateKey,
    tokenUjian,
    answers,
    doubtIds,
    tabViolations,
    startTimestamp,
    endTimestamp,
    currentIndex,
  ]);

  const handleStartExam = (student: Student, token: string) => {
    const existing = loadSavedProgress();
    const todayDateKey = getWibDateKey();

    if (existing && existing.studentId === student.id) {
      const sessionDateKey = existing.examDateKey || getWibDateKey(existing.startTimestamp);
      const paper = buildStudentExamPaper(student, QUESTION_BANK, sessionDateKey);
      setActiveStudent(student);
      setPacketCode(paper.packetCode);
      setExamDateKey(sessionDateKey);
      setQuestions(paper.questions);
      setTokenUjian(token || existing.tokenUjian);
      setAnswers(existing.answers || {});
      setDoubtIds(existing.doubtIds || []);
      setTabViolations(existing.tabViolations || 0);
      setStartTimestamp(existing.startTimestamp);
      setEndTimestamp(existing.endTimestamp);
      setCurrentIndex(existing.currentIndex || 0);
      setView('exam');
      return;
    }

    const paper = buildStudentExamPaper(student, QUESTION_BANK, todayDateKey);
    const now = Date.now();
    const durationMs = EXAM_DURATION_MINUTES * 60 * 1000;
    setActiveStudent(student);
    setPacketCode(paper.packetCode);
    setExamDateKey(todayDateKey);
    setQuestions(paper.questions);
    setTokenUjian(token);
    setAnswers({});
    setDoubtIds([]);
    setTabViolations(0);
    setStartTimestamp(now);
    setEndTimestamp(now + durationMs);
    setCurrentIndex(0);
    setView('exam');
  };

  const handleSelectAnswer = useCallback((questionId: string, displayLetter: OptionLetter) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: displayLetter,
    }));
  }, []);

  const handleToggleDoubt = useCallback((questionId: string) => {
    setDoubtIds((prev) =>
      prev.includes(questionId) ? prev.filter((id) => id !== questionId) : [...prev, questionId]
    );
  }, []);

  const handleRecordTabViolation = useCallback(() => {
    setTabViolations((prev) => prev + 1);
  }, []);

  const dispatchAppsScriptSubmission = async (
    payload: AppsScriptSubmissionPayload,
    backupRec: StudentBackupRecord
  ) => {
    setSyncStatus('sending');
    setSyncMessage('Menghubungi endpoint Google Apps Script...');

    const result = await submitExamToAppsScript(payload);
    const nextStatus: ServerSyncStatus = result.ok ? 'success' : 'error';

    setSyncStatus(nextStatus);
    setSyncMessage(result.message);

    const updatedRecord: StudentBackupRecord = {
      ...backupRec,
      serverSyncStatus: nextStatus,
    };
    setSummaryRecord(updatedRecord);
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_SUBMISSION, JSON.stringify(updatedRecord));
    } catch {
      // Ignore storage errors
    }
  };

  const handleSubmitExam = useCallback(
    async (isTimeout: boolean) => {
      if (!activeStudent || isSubmitting) return;
      setIsSubmitting(true);

      try {
        const submittedAtIso = new Date().toISOString();
        const usedSeconds = Math.max(
          1,
          Math.min(
            EXAM_DURATION_MINUTES * 60,
            Math.round((Date.now() - startTimestamp) / 1000)
          )
        );

        // Hitung skor hanya di memori sementara saat submit
        let correctCount = 0;
        let answeredCount = 0;

        const breakdown: ItemBreakdown[] = questions.map((q) => {
          const selectedDisplay = answers[q.questionId] ?? null;
          const matchedOption = selectedDisplay
            ? q.options.find((opt) => opt.displayLetter === selectedDisplay)
            : undefined;
          const selectedOriginal = matchedOption ? matchedOption.originalLetter : null;

          if (selectedOriginal !== null) {
            answeredCount += 1;
          }

          const isCorrect = selectedOriginal !== null && selectedOriginal === q.originalKey;
          if (isCorrect) {
            correctCount += 1;
          }

          return {
            displayNumber: q.displayNumber,
            questionId: q.questionId,
            lkpd: q.lkpd,
            topic: q.topic,
            selectedDisplayLetter: selectedDisplay,
            selectedOriginalLetter: selectedOriginal,
            originalKey: q.originalKey,
            isCorrect,
          };
        });

        const finalScore = Number(((correctCount / TOTAL_QUESTIONS_PER_PACKET) * 100).toFixed(2));

        const ephemeralResult: DecryptedExamResult = {
          student: activeStudent,
          packetCode,
          tokenUjian,
          mataPelajaran: SUBJECT_NAME,
          submittedAt: submittedAtIso,
          durasiTerpakaiDetik: usedSeconds,
          jumlahPelanggaranTab: tabViolations,
          jumlahTerjawab: answeredCount,
          totalSoal: TOTAL_QUESTIONS_PER_PACKET,
          skorPgBenar: correctCount,
          nilaiAkhir: finalScore,
          items: breakdown,
        };

        const { encryptedJson, integritySha256 } = await encryptExamResult(ephemeralResult);

        const appsScriptPayload: AppsScriptSubmissionPayload = {
          sekolah: activeStudent.sekolah,
          kelas: activeStudent.kelas,
          nama_lengkap: activeStudent.nama,
          pilihan_lkpd: `LKPD 1-5 | Paket ${packetCode} | Tanggal: ${examDateKey} | Token: ${tokenUjian} | Pelanggaran Tab: ${tabViolations}${isTimeout ? ' (Auto-Timeout)' : ''}`,
          paket_soal: packetCode,
          durasi_detik: usedSeconds,
          skor_pg_benar: correctCount,
          nilai_akhir: finalScore,
          timestamp: submittedAtIso,
          nama_peserta: activeStudent.nama,
          nis_no_peserta: activeStudent.noAbsen,
          kelas_rombel: activeStudent.kelas,
          mata_pelajaran: SUBJECT_NAME,
          token_ujian: tokenUjian,
          durasi_terpakai_detik: usedSeconds,
          jumlah_pelanggaran_tab: tabViolations,
          encryption_version: ENCRYPTION_VERSION,
          integrity_sha256: integritySha256,
          rekap_jawaban: encryptedJson,
          encrypted_payload: encryptedJson,
        };

        // Simpan payload di memori sementara untuk tombol "Kirim Ulang Data" (tidak ke localStorage)
        pendingPayloadRef.current = appsScriptPayload;

        // Buat record cadangan siswa TANPA skor & kunci jawaban
        const studentRecord: StudentBackupRecord = {
          backupVersion: '1.0',
          studentId: activeStudent.id,
          sekolah: activeStudent.sekolah,
          kelas: activeStudent.kelas,
          namaPeserta: activeStudent.nama,
          noAbsen: activeStudent.noAbsen,
          mataPelajaran: SUBJECT_NAME,
          paketSoal: packetCode,
          tokenUjian,
          jumlahTerjawab: answeredCount,
          totalSoal: TOTAL_QUESTIONS_PER_PACKET,
          durasiDetik: usedSeconds,
          jumlahPelanggaranTab: tabViolations,
          submittedAt: submittedAtIso,
          encryptionVersion: ENCRYPTION_VERSION,
          integritySha256,
          encryptedPayload: encryptedJson,
          serverSyncStatus: 'sending',
        };

        // Hapus progres ujian aktif dan bersihkan state ujian dari memori
        try {
          localStorage.removeItem(STORAGE_KEYS.EXAM_PROGRESS);
          localStorage.setItem(STORAGE_KEYS.LAST_SUBMISSION, JSON.stringify(studentRecord));
        } catch {
          // Ignore storage errors
        }

        setSummaryRecord(studentRecord);
        setActiveStudent(null);
        setQuestions([]);
        setAnswers({});
        setDoubtIds([]);
        setView('summary');

        await dispatchAppsScriptSubmission(appsScriptPayload, studentRecord);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      activeStudent,
      isSubmitting,
      startTimestamp,
      questions,
      answers,
      packetCode,
      examDateKey,
      tokenUjian,
      tabViolations,
    ]
  );

  const handleRetrySync = async () => {
    if (!summaryRecord || !pendingPayloadRef.current) return;
    await dispatchAppsScriptSubmission(pendingPayloadRef.current, summaryRecord);
  };

  const handleReturnHome = () => {
    pendingPayloadRef.current = null;
    try {
      localStorage.removeItem(STORAGE_KEYS.LAST_SUBMISSION);
    } catch {
      // Ignore
    }
    setSummaryRecord(null);
    setView('login');
  };

  const existingSavedProgress = loadSavedProgress();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {view !== 'exam' && (
        <HeaderBar
          currentView={view}
          onNavigate={setView}
          hasActiveSession={Boolean(activeStudent)}
        />
      )}

      {view === 'login' && (
        <LoginPortal
          onStartExam={handleStartExam}
          existingSessionStudentId={existingSavedProgress?.studentId ?? null}
        />
      )}

      {view === 'exam' && activeStudent && questions.length > 0 && (
        <ExamWorkspace
          student={activeStudent}
          packetCode={packetCode}
          questions={questions}
          answers={answers}
          doubtIds={doubtIds}
          tabViolations={tabViolations}
          endTimestamp={endTimestamp}
          currentIndex={currentIndex}
          isSubmitting={isSubmitting}
          onSelectAnswer={handleSelectAnswer}
          onToggleDoubt={handleToggleDoubt}
          onChangeIndex={setCurrentIndex}
          onRecordTabViolation={handleRecordTabViolation}
          onSubmitExam={handleSubmitExam}
        />
      )}

      {view === 'summary' && summaryRecord && (
        <ExamSummary
          record={summaryRecord}
          syncStatus={syncStatus}
          syncMessage={syncMessage}
          canRetry={Boolean(pendingPayloadRef.current)}
          onRetrySync={handleRetrySync}
          onReturnHome={handleReturnHome}
        />
      )}

      {view === 'teacher' && <TeacherPortal />}
    </div>
  );
}
