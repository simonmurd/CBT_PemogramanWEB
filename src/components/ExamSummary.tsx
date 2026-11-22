import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Home,
  Loader2,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { ServerSyncStatus, StudentBackupRecord } from '../types/cbt';
import { downloadStudentCsvBackup, downloadStudentJsonBackup } from '../utils/backup';

interface ExamSummaryProps {
  record: StudentBackupRecord;
  syncStatus: ServerSyncStatus;
  syncMessage: string;
  canRetry: boolean;
  onRetrySync: () => void;
  onReturnHome: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins} menit ${secs} detik`;
}

export const ExamSummary: React.FC<ExamSummaryProps> = ({
  record,
  syncStatus,
  syncMessage,
  canRetry,
  onRetrySync,
  onReturnHome,
}) => {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        {/* Status Header (Strictly no scores shown) */}
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>Sesi Ujian Selesai</span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 sm:text-3xl">
              Rekap Status Pengerjaan Ujian
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Jawaban Anda telah dienkripsi menggunakan{' '}
              <span className="font-mono text-xs font-semibold text-slate-800">
                {record.encryptionVersion}
              </span>
              . Hasil nilai hanya dapat didekripsi oleh guru mata pelajaran.
            </p>
          </div>
        </div>

        {/* Summary Metadata Grid (No score / no answer key) */}
        <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <dt className="text-xs font-medium text-slate-500">Peserta</dt>
            <dd className="mt-1 font-semibold text-slate-900">{record.namaPeserta}</dd>
            <dd className="mt-0.5 font-mono text-xs text-slate-600 tabular-nums">
              {record.kelas} · Absen {record.noAbsen}
            </dd>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <dt className="text-xs font-medium text-slate-500">Sekolah & Mapel</dt>
            <dd className="mt-1 font-semibold text-slate-900">{record.sekolah}</dd>
            <dd className="mt-0.5 text-xs text-slate-600">{record.mataPelajaran}</dd>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <dt className="text-xs font-medium text-slate-500">Kode Paket Soal</dt>
            <dd className="mt-1 font-display text-xl font-bold text-blue-700">
              Paket {record.paketSoal}
            </dd>
            <dd className="mt-0.5 font-mono text-xs text-slate-600">Token: {record.tokenUjian}</dd>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <dt className="text-xs font-medium text-slate-500">Soal Terjawab</dt>
            <dd className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
              {record.jumlahTerjawab} / {record.totalSoal}
            </dd>
            <dd className="mt-0.5 text-xs text-slate-500">Pilihan Ganda Tunggal</dd>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <dt className="text-xs font-medium text-slate-500">Durasi Pengerjaan</dt>
            <dd className="mt-1 font-mono text-base font-bold text-slate-900 tabular-nums">
              {formatDuration(record.durasiDetik)}
            </dd>
            <dd className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums">
              ({record.durasiDetik} detik)
            </dd>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <dt className="text-xs font-medium text-slate-500">Pelanggaran Fokus Tab</dt>
            <dd
              className={`mt-1 font-mono text-xl font-bold tabular-nums ${
                record.jumlahPelanggaranTab > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {record.jumlahPelanggaranTab} kali
            </dd>
            <dd className="mt-0.5 text-xs text-slate-500">Tercatat otomatis oleh sistem</dd>
          </div>
        </dl>

        {/* Server Sync Status */}
        <div
          className={`mt-6 rounded-xl border p-4 ${
            syncStatus === 'success'
              ? 'border-emerald-200 bg-emerald-50/70'
              : syncStatus === 'error'
                ? 'border-red-200 bg-red-50/70'
                : 'border-blue-200 bg-blue-50/70'
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              {syncStatus === 'sending' ? (
                <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-blue-700" aria-hidden="true" />
              ) : syncStatus === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
              ) : (
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {syncStatus === 'sending'
                    ? 'Mengirim Data ke Server Google Apps Script...'
                    : syncStatus === 'success'
                      ? 'Pengiriman Server: Berhasil Terkirim'
                      : 'Pengiriman Server: Gagal / Antrean Ulang'}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-700">{syncMessage}</p>
              </div>
            </div>

            {canRetry && (
              <button
                type="button"
                onClick={onRetrySync}
                disabled={syncStatus === 'sending'}
                className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Kirim Ulang Data</span>
              </button>
            )}
          </div>
        </div>

        {/* Integrity SHA-256 Info */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Lock className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
            <span>Hash Integritas SHA-256 (Bukti Keaslian Berkas Terenkripsi)</span>
          </div>
          <p className="mt-1 break-all font-mono text-xs text-slate-600">{record.integritySha256}</p>
        </div>

        {/* Backup Downloads & Home Action */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => downloadStudentJsonBackup(record)}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Download className="h-4 w-4 text-blue-700" aria-hidden="true" />
              <span>Unduh JSON Cadangan</span>
            </button>

            <button
              type="button"
              onClick={() => downloadStudentCsvBackup(record)}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <span>Unduh CSV Cadangan</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onReturnHome}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            <span>Kembali ke Halaman Awal</span>
          </button>
        </div>
      </div>
    </main>
  );
};
