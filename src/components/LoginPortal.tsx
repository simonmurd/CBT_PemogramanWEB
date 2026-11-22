import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  KeyRound,
  Lock,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { ACADEMIC_YEAR, EXAM_DURATION_MINUTES, EXAM_TITLE, SUBJECT_NAME } from '../config/examConfig';
import { STUDENTS } from '../data/students';
import { Student } from '../types/cbt';
import { validateExamToken } from '../utils/appsScript';

interface LoginPortalProps {
  onStartExam: (student: Student, token: string) => void;
  existingSessionStudentId: string | null;
}

const LKPD_COVERAGE = [
  {
    code: 'LKPD 1',
    title: 'Arsitektur Client-Server & Konsep Dasar Web',
    detail: 'WWW, HTTP/HTTPS, siklus request-response, kode status HTTP, anatomi URL, dan DNS.',
    count: '10 Butir',
  },
  {
    code: 'LKPD 2',
    title: 'Ekosistem Perangkat Lunak & Tools Pengembang Web',
    detail: 'Apache, Nginx, IIS, LiteSpeed, XAMPP/Laragon, rendering engine, VS Code/Acode, dan DevTools.',
    count: '10 Butir',
  },
  {
    code: 'LKPD 3',
    title: 'Profesi Pengembang Web & Struktur Dasar HTML',
    detail: 'Peran profesi web, kerangka HTML5, metadata head, komentar, tag void, dan manajemen file.',
    count: '10 Butir',
  },
  {
    code: 'LKPD 4',
    title: 'Pemformatan Teks & Penyajian Data Tabel HTML',
    detail: 'Heading, paragraf, semantik teks, daftar berurutan/bersarang, tabel, colspan, dan rowspan.',
    count: '10 Butir',
  },
  {
    code: 'LKPD 5',
    title: 'Hyperlink dengan HTML',
    detail: 'Tag anchor, Absolute vs Relative URL (../), target (_blank/_self), bookmark #id, mailto, dan tel.',
    count: '10 Butir',
  },
];

export const LoginPortal: React.FC<LoginPortalProps> = ({
  onStartExam,
  existingSessionStudentId,
}) => {
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  const [tokenInput, setTokenInput] = useState<string>('');
  const [tokenStatus, setTokenStatus] = useState<{
    checked: boolean;
    valid: boolean;
    message: string;
    source?: string;
  }>({ checked: false, valid: false, message: '' });
  const [checkingToken, setCheckingToken] = useState<boolean>(false);
  const [identityConfirmed, setIdentityConfirmed] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  // Dropdown 1: Daftar Sekolah unik
  const schools = useMemo(() => {
    return Array.from(new Set(STUDENTS.map((s) => s.sekolah))).sort((a, b) =>
      a.localeCompare(b, 'id')
    );
  }, []);

  // Dropdown 2: Kelas terfilter sesuai Sekolah
  const classesForSchool = useMemo(() => {
    if (!selectedSchool) return [];
    return Array.from(
      new Set(STUDENTS.filter((s) => s.sekolah === selectedSchool).map((s) => s.kelas))
    );
  }, [selectedSchool]);

  // Dropdown 3: Peserta terfilter sesuai Sekolah & Kelas, urut abjad A–Z, dengan nomor absen
  const studentsForClass = useMemo(() => {
    if (!selectedSchool || !selectedClass) return [];
    return STUDENTS.filter(
      (s) => s.sekolah === selectedSchool && s.kelas === selectedClass
    ).sort((a, b) => {
      const nameCmp = a.nama.localeCompare(b.nama, 'id');
      if (nameCmp !== 0) return nameCmp;
      return a.noAbsen.localeCompare(b.noAbsen, 'id');
    });
  }, [selectedSchool, selectedClass]);

  const selectedStudent = useMemo(() => {
    return STUDENTS.find((s) => s.id === selectedStudentId) ?? null;
  }, [selectedStudentId]);

  const isResumingSession =
    selectedStudent !== null && existingSessionStudentId === selectedStudent.id;

  const handleSchoolChange = (value: string) => {
    setSelectedSchool(value);
    setSelectedClass('');
    setSelectedStudentId('');
    setIdentityConfirmed(false);
    setFormError('');
  };

  const handleClassChange = (value: string) => {
    setSelectedClass(value);
    setSelectedStudentId('');
    setIdentityConfirmed(false);
    setFormError('');
  };

  const handleStudentChange = (value: string) => {
    setSelectedStudentId(value);
    setIdentityConfirmed(false);
    setFormError('');
  };

  const handleVerifyToken = async () => {
    setFormError('');
    setCheckingToken(true);
    try {
      const res = await validateExamToken(tokenInput);
      setTokenStatus({
        checked: true,
        valid: res.valid,
        message: res.message,
        source: res.source,
      });
    } finally {
      setCheckingToken(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedStudent) {
      setFormError('Pilih asal sekolah, kelas, dan nama peserta terlebih dahulu.');
      return;
    }

    let isTokenValid = tokenStatus.checked && tokenStatus.valid;
    if (!tokenStatus.checked || tokenInput.trim() !== '') {
      setCheckingToken(true);
      const res = await validateExamToken(tokenInput);
      setCheckingToken(false);
      setTokenStatus({
        checked: true,
        valid: res.valid,
        message: res.message,
        source: res.source,
      });
      isTokenValid = res.valid;
    }

    if (!isTokenValid) {
      setFormError('Token ujian belum valid. Periksa kembali token dari pengawas.');
      return;
    }

    if (!identityConfirmed) {
      setFormError('Centang kotak konfirmasi identitas peserta sebelum memulai ujian.');
      return;
    }

    onStartExam(selectedStudent, tokenInput.trim().toUpperCase());
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
      {/* Page Hero Title */}
      <div className="mb-8 max-w-3xl">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
          <span>{SUBJECT_NAME}</span>
          <span aria-hidden="true">·</span>
          <span>Tahun Pelajaran {ACADEMIC_YEAR}</span>
          <span aria-hidden="true">·</span>
          <span>50 Soal Pilihan Ganda</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{EXAM_DURATION_MINUTES} Menit</span>
        </div>
        <h1
          className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
          style={{ textWrap: 'balance' }}
        >
          {EXAM_TITLE} — Computer-Based Test
        </h1>
        <p className="mt-2.5 text-base leading-relaxed text-slate-600">
          Pilih identitas peserta secara berurutan, masukkan token ujian dari pengawas, dan
          konfirmasi biodata untuk mendapatkan paket soal teracak secara deterministik.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Left Zone: Cascading Login Form */}
        <section className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
          <div className="mb-6 border-b border-slate-100 pb-4">
            <h2 className="font-display text-xl font-semibold text-slate-900">
              Identitas & Validasi Peserta
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Perubahan pada sekolah atau kelas akan otomatis memperbarui daftar di bawahnya.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Level 1: Sekolah */}
            <div>
              <label
                htmlFor="select-school"
                className="mb-1.5 block text-sm font-semibold text-slate-800"
              >
                1. Asal Sekolah / Institusi
              </label>
              <select
                id="select-school"
                value={selectedSchool}
                onChange={(e) => handleSchoolChange(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                <option value="">-- Pilih Asal Sekolah --</option>
                {schools.map((school) => (
                  <option key={school} value={school}>
                    {school}
                  </option>
                ))}
              </select>
            </div>

            {/* Level 2: Kelas */}
            <div>
              <label
                htmlFor="select-class"
                className="mb-1.5 block text-sm font-semibold text-slate-800"
              >
                2. Kelas / Jurusan
              </label>
              <select
                id="select-class"
                value={selectedClass}
                onChange={(e) => handleClassChange(e.target.value)}
                disabled={!selectedSchool}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors disabled:bg-slate-100 disabled:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                <option value="">
                  {selectedSchool ? '-- Pilih Kelas / Jurusan --' : '-- Pilih Sekolah Terlebih Dahulu --'}
                </option>
                {classesForSchool.map((kelas) => (
                  <option key={kelas} value={kelas}>
                    {kelas}
                  </option>
                ))}
              </select>
            </div>

            {/* Level 3: Nama Peserta (A-Z + No Absen) */}
            <div>
              <label
                htmlFor="select-student"
                className="mb-1.5 block text-sm font-semibold text-slate-800"
              >
                3. Nama Peserta (Urut Abjad A–Z)
              </label>
              <select
                id="select-student"
                value={selectedStudentId}
                onChange={(e) => handleStudentChange(e.target.value)}
                disabled={!selectedClass}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors disabled:bg-slate-100 disabled:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                <option value="">
                  {selectedClass
                    ? '-- Pilih Nama Peserta & No. Absen --'
                    : '-- Pilih Kelas Terlebih Dahulu --'}
                </option>
                {studentsForClass.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.nama} (No. Absen {st.noAbsen})
                  </option>
                ))}
              </select>
            </div>

            {/* Read-only Biodata Verification Card */}
            {selectedStudent && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <UserCheck className="h-4 w-4 text-blue-700" aria-hidden="true" />
                  <span>Ringkasan Biodata Peserta (Read-Only)</span>
                </div>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-2.5 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-slate-500">Nama Lengkap</dt>
                    <dd className="font-semibold text-slate-900">{selectedStudent.nama}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">No. Peserta / Absen</dt>
                    <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                      Absen {selectedStudent.noAbsen} ({selectedStudent.id})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Asal Sekolah</dt>
                    <dd className="font-medium text-slate-800">{selectedStudent.sekolah}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Kelas</dt>
                    <dd className="font-medium text-slate-800">{selectedStudent.kelas}</dd>
                  </div>
                </dl>
              </div>
            )}

            {/* Input Token Ujian */}
            <div>
              <label
                htmlFor="input-token"
                className="mb-1.5 block text-sm font-semibold text-slate-800"
              >
                4. Token Ujian
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <KeyRound
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="input-token"
                    type="text"
                    value={tokenInput}
                    onChange={(e) => {
                      setTokenInput(e.target.value.toUpperCase());
                      setTokenStatus({ checked: false, valid: false, message: '' });
                      setFormError('');
                    }}
                    placeholder="Masukkan token ujian (misal: WEBXI-2026)"
                    autoComplete="off"
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 font-mono text-sm uppercase tracking-wider text-slate-900 transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleVerifyToken}
                  disabled={checkingToken || !tokenInput.trim()}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {checkingToken ? 'Memeriksa...' : 'Cek Token'}
                </button>
              </div>

              {tokenStatus.checked && (
                <div
                  className={`mt-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                    tokenStatus.valid
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-red-200 bg-red-50 text-red-800'
                  }`}
                >
                  {tokenStatus.valid ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                  )}
                  <span>{tokenStatus.message}</span>
                </div>
              )}
            </div>

            {/* Checkbox Konfirmasi Identitas */}
            <div className="pt-1">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 transition-colors hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={identityConfirmed}
                  onChange={(e) => {
                    setIdentityConfirmed(e.target.checked);
                    setFormError('');
                  }}
                  disabled={!selectedStudent}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                <span className="text-xs sm:text-sm leading-relaxed text-slate-700">
                  Saya menyatakan bahwa data nama, nomor absen, kelas, dan sekolah di atas adalah
                  benar milik saya sendiri serta bersedia mengikuti ujian secara jujur.
                </span>
              </label>
            </div>

            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                <span>{formError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!selectedStudent || !identityConfirmed || !tokenInput.trim() || checkingToken}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <span>{isResumingSession ? 'Lanjutkan Sesi Ujian' : 'Mulai Ujian'}</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </section>

        {/* Right Zone: Tata Tertib & Cakupan Kisi-Kisi */}
        <aside className="lg:col-span-5 space-y-6">
          {/* Tata Tertib & Fitur Keamanan */}
          <div
            id="tata-tertib"
            className="rounded-2xl border border-slate-200 bg-white p-6"
          >
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Ketentuan Pelaksanaan Ujian
            </h2>
            <ul className="mt-4 space-y-3.5 text-sm text-slate-600">
              <li className="flex items-start gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
                <span>
                  Durasi pengerjaan adalah <strong className="text-slate-900">90 menit</strong> untuk{' '}
                  <strong className="text-slate-900">50 soal</strong> Pilihan Ganda (A–E). Sistem
                  otomatis mengirim jawaban saat waktu habis.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
                <span>
                  Peserta memperoleh satu dari <strong className="text-slate-900">5 Paket Soal (A–E)</strong>{' '}
                  dengan urutan nomor soal dan opsi jawaban yang diacak otomatis berbasis identitas.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <span>
                  Perpindahan tab atau jendela browser selama ujian tercatat otomatis sebagai{' '}
                  <strong className="text-slate-900">pelanggaran fokus</strong> dan dilaporkan ke server.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <span>
                  Progres jawaban disimpan otomatis di perangkat. Nilai akhir dienkripsi dengan{' '}
                  <strong className="text-slate-900">AES-256-GCM</strong> dan hanya dapat dibuka oleh guru.
                </span>
              </li>
            </ul>
          </div>

          {/* Cakupan Kisi-Kisi LKPD 1-5 */}
          <div
            id="cakupan-lkpd"
            className="rounded-2xl border border-slate-200 bg-white p-6"
          >
            <div className="mb-4 flex items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Cakupan Kisi-Kisi LKPD 1–5
              </h2>
              <span className="text-xs font-medium text-slate-500 tabular-nums">50 Butir / Paket</span>
            </div>
            <div className="divide-y divide-slate-100">
              {LKPD_COVERAGE.map((item) => (
                <div key={item.code} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-blue-700">{item.code}</span>
                    <span className="text-xs text-slate-500 tabular-nums">{item.count}</span>
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
};
