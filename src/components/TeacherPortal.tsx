import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  KeyRound,
  Lock,
  ShieldCheck,
  Trash2,
  Unlock,
  Upload,
  XCircle,
} from 'lucide-react';
import { ACTIVE_EXAM_TOKENS, APPS_SCRIPT_ENDPOINT, ENCRYPTION_VERSION } from '../config/examConfig';
import { PACKET_DESCRIPTIONS } from '../data/questions';
import { PacketCode, TeacherDecryptedRecord } from '../types/cbt';
import { downloadTeacherRecapCsv, extractCipherSources } from '../utils/backup';
import { decryptExamResult, verifyTeacherAccessCode } from '../utils/crypto';

type TeacherSubTab = 'decrypt' | 'config';
type ItemFilter = 'all' | 'correct' | 'incorrect' | 'unanswered';

export const TeacherPortal: React.FC = () => {
  const [accessInput, setAccessInput] = useState<string>('');
  const [verifiedDigest, setVerifiedDigest] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  const [subTab, setSubTab] = useState<TeacherSubTab>('decrypt');
  const [pastedPayload, setPastedPayload] = useState<string>('');
  const [decryptError, setDecryptError] = useState<string>('');
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);

  const [records, setRecords] = useState<TeacherDecryptedRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [itemFilter, setItemFilter] = useState<ItemFilter>('all');

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsVerifying(true);
    try {
      const digest = await verifyTeacherAccessCode(accessInput);
      if (!digest) {
        setAuthError('Kode akses guru tidak valid. Periksa kembali kode akses Anda.');
        return;
      }
      setVerifiedDigest(digest);
      setAccessInput('');
    } finally {
      setIsVerifying(false);
    }
  };

  const processRawSources = async (inputs: { text: string; filename: string }[]) => {
    if (!verifiedDigest) return;
    setDecryptError('');
    setIsDecrypting(true);

    try {
      const newlyDecrypted: TeacherDecryptedRecord[] = [];
      for (const inp of inputs) {
        const sources = extractCipherSources(inp.text, inp.filename);
        for (const src of sources) {
          const result = await decryptExamResult(
            src.encryptedPayload,
            verifiedDigest,
            src.integritySha256
          );
          const id = `${result.decrypted.student.id}-${result.computedSha256.slice(0, 10)}`;
          newlyDecrypted.push({
            id,
            sourceLabel: src.sourceLabel,
            integrityValid: result.integrityValid,
            integritySha256: result.computedSha256,
            decrypted: result.decrypted,
          });
        }
      }

      if (newlyDecrypted.length === 0) {
        setDecryptError('Tidak ada data terenkripsi yang dapat diproses.');
        return;
      }

      setRecords((prev) => {
        const merged = [...prev];
        for (const item of newlyDecrypted) {
          const existingIdx = merged.findIndex((r) => r.id === item.id);
          if (existingIdx >= 0) {
            merged[existingIdx] = item;
          } else {
            merged.push(item);
          }
        }
        return merged;
      });
      setSelectedRecordId(newlyDecrypted[0].id);
    } catch (err) {
      setDecryptError(
        err instanceof Error
          ? `Gagal mendekripsi data: ${err.message}`
          : 'Gagal mendekripsi data. Pastikan format JSON/CSV cadangan atau ciphertext benar.'
      );
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const loaded: { text: string; filename: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const text = await file.text();
      loaded.push({ text, filename: file.name });
    }
    e.target.value = '';
    await processRawSources(loaded);
  };

  const handleDecryptPasted = async () => {
    if (!pastedPayload.trim()) {
      setDecryptError('Tempelkan isi JSON, CSV, atau ciphertext terlebih dahulu.');
      return;
    }
    await processRawSources([{ text: pastedPayload, filename: 'Tempelan Manual' }]);
  };

  const activeRecord = useMemo(() => {
    return records.find((r) => r.id === selectedRecordId) ?? records[0] ?? null;
  }, [records, selectedRecordId]);

  const filteredItems = useMemo(() => {
    if (!activeRecord) return [];
    return activeRecord.decrypted.items.filter((item) => {
      if (itemFilter === 'correct') return item.isCorrect;
      if (itemFilter === 'incorrect') return !item.isCorrect && item.selectedOriginalLetter !== null;
      if (itemFilter === 'unanswered') return item.selectedOriginalLetter === null;
      return true;
    });
  }, [activeRecord, itemFilter]);

  if (!verifiedDigest) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-slate-900">
                Portal Guru (Dekripsi Hasil)
              </h1>
              <p className="text-xs text-slate-500">Khusus Pengawas & Guru Mata Pelajaran</p>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-slate-600">
            Masukkan kode akses guru untuk membuka dekripsi hasil ujian AES-256-GCM, memverifikasi
            hash integritas SHA-256, dan mengekspor rekap nilai siswa.
          </p>

          <form onSubmit={handleUnlock} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="teacher-code-input"
                className="mb-1.5 block text-sm font-semibold text-slate-800"
              >
                Kode Akses Guru
              </label>
              <input
                id="teacher-code-input"
                type="password"
                value={accessInput}
                onChange={(e) => {
                  setAccessInput(e.target.value);
                  setAuthError('');
                }}
                placeholder="Masukkan kode akses guru"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            {authError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying || !accessInput.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50"
            >
              <Unlock className="h-4 w-4" aria-hidden="true" />
              <span>{isVerifying ? 'Memverifikasi...' : 'Buka Portal Guru'}</span>
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Top Action Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>Akses Guru Terverifikasi</span>
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 sm:text-3xl">
            Portal Dekripsi & Rekap Nilai CBT
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Segmented Tabs */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setSubTab('decrypt')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'decrypt'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dekripsi Hasil
            </button>
            <button
              type="button"
              onClick={() => setSubTab('config')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'config'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Token & Paket Soal
            </button>
          </div>

          {records.length > 0 && (
            <button
              type="button"
              onClick={() => downloadTeacherRecapCsv(records)}
              className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 whitespace-nowrap shrink-0"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Ekspor Rekap CSV Guru ({records.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setVerifiedDigest(null);
              setRecords([]);
              setSelectedRecordId(null);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Kunci Portal</span>
          </button>
        </div>
      </div>

      {subTab === 'config' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Daftar Token Ujian Aktif (Fallback Lokal)
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Token berikut diterima secara lokal maupun saat server Apps Script tidak merespons
              validasi GET.
            </p>
            <div className="mt-4 space-y-2.5">
              {ACTIVE_EXAM_TOKENS.map((tok) => (
                <div
                  key={tok}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <span className="flex items-center gap-2 font-mono text-sm font-bold text-slate-900">
                    <KeyRound className="h-4 w-4 text-blue-700" aria-hidden="true" />
                    {tok}
                  </span>
                  <span className="text-xs font-semibold text-emerald-700">Aktif</span>
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-700">Endpoint Google Apps Script</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-500">
                {APPS_SCRIPT_ENDPOINT}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Distribusi 5 Paket Soal (50 Soal / Paket)
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Setiap paket memuat 50 soal Pilihan Ganda setara kompetensi LKPD 1–5 (total 250 butir
              soal dalam bank soal).
            </p>
            <div className="mt-4 divide-y divide-slate-100">
              {(['A', 'B', 'C', 'D', 'E'] as PacketCode[]).map((code) => (
                <div key={code} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-blue-700">Paket {code}</span>
                    <span className="font-mono text-xs text-slate-500 tabular-nums">50 Butir</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600">{PACKET_DESCRIPTIONS[code]}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Upload & Paste Panel */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="font-display text-base font-semibold text-slate-900">
                1. Unggah File Cadangan (.json / .csv)
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Mendukung pemilihan banyak file sekaligus untuk merekap satu kelas dalam satu tabel.
              </p>
              <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 px-4 py-8 text-center transition-colors hover:border-blue-500 hover:bg-blue-50/30">
                <Upload className="h-7 w-7 text-blue-700" aria-hidden="true" />
                <span className="mt-2 text-sm font-semibold text-slate-800">
                  Pilih File Cadangan JSON atau CSV
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  Klik di sini (bisa pilih lebih dari 1 file)
                </span>
                <input
                  type="file"
                  accept=".json,.csv,application/json,text/csv"
                  multiple
                  onChange={handleFileUpload}
                  className="sr-only"
                />
              </label>
            </div>

            <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="font-display text-base font-semibold text-slate-900">
                2. Atau Tempel Ciphertext / JSON / CSV
              </h2>
              <textarea
                value={pastedPayload}
                onChange={(e) => {
                  setPastedPayload(e.target.value);
                  setDecryptError('');
                }}
                rows={4}
                placeholder='Tempel objek JSON {"v":"AES-256-GCM-PBKDF2-v1",...}, isi file .json/.csv cadangan, atau kolom encrypted_payload dari Google Sheet...'
                className="mt-3 w-full rounded-xl border border-slate-300 bg-slate-50/50 p-3 font-mono text-xs text-slate-800 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-[11px] text-slate-500">
                  Algoritma: {ENCRYPTION_VERSION}
                </span>
                <button
                  type="button"
                  onClick={handleDecryptPasted}
                  disabled={isDecrypting || !pastedPayload.trim()}
                  className="flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50"
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isDecrypting ? 'Mendekripsi...' : 'Dekripsi & Verifikasi'}</span>
                </button>
              </div>
            </div>
          </div>

          {decryptError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              <span>{decryptError}</span>
            </div>
          )}

          {/* Decrypted Cohort Table (when >= 1 record) */}
          {records.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
              <p className="text-sm font-medium text-slate-700">
                Belum ada berkas cadangan yang didekripsi.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Unggah file `.json` / `.csv` cadangan siswa atau tempel `encrypted_payload` di atas
                untuk melihat nilai akhir dan rincian jawaban.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    Daftar Hasil Terdekripsi ({records.length} Peserta)
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setRecords([]);
                      setSelectedRecordId(null);
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Bersihkan Daftar</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Peserta</th>
                        <th className="px-4 py-3">Kelas / Sekolah</th>
                        <th className="px-4 py-3">Paket</th>
                        <th className="px-4 py-3 text-right">Benar</th>
                        <th className="px-4 py-3 text-right">Nilai Akhir</th>
                        <th className="px-4 py-3 text-right">Pelanggaran</th>
                        <th className="px-4 py-3">Integritas SHA-256</th>
                        <th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {records.map((rec) => {
                        const d = rec.decrypted;
                        const isSelected = activeRecord?.id === rec.id;
                        return (
                          <tr
                            key={rec.id}
                            className={isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50/80'}
                          >
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900">{d.student.nama}</div>
                              <div className="font-mono text-xs text-slate-500 tabular-nums">
                                Absen {d.student.noAbsen}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-600">
                              <div className="font-medium text-slate-800">{d.student.kelas}</div>
                              <div>{d.student.sekolah}</div>
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-blue-700">
                              Paket {d.packetCode}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                              {d.skorPgBenar} / {d.totalSoal}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-base font-bold text-slate-900 tabular-nums">
                              {d.nilaiAkhir}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs text-slate-700 tabular-nums">
                              {d.jumlahPelanggaranTab}x
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {rec.integrityValid ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  Valid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                                  <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                  Hash Berbeda
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedRecordId(rec.id)}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                              >
                                Rincian
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Active Student Item Breakdown */}
              {activeRecord && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{activeRecord.decrypted.student.sekolah}</span>
                        <span aria-hidden="true">·</span>
                        <span>{activeRecord.decrypted.student.kelas}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">
                          Absen {activeRecord.decrypted.student.noAbsen}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Sumber: {activeRecord.sourceLabel}</span>
                      </div>
                      <h3 className="mt-1 font-display text-xl font-bold text-slate-900">
                        {activeRecord.decrypted.student.nama}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs text-slate-500">Paket Soal</div>
                        <div className="font-mono text-lg font-bold text-blue-700">
                          Paket {activeRecord.decrypted.packetCode}
                        </div>
                      </div>
                      <div className="h-8 w-px bg-slate-200" aria-hidden="true" />
                      <div className="text-right">
                        <div className="text-xs text-slate-500">Skor PG Benar</div>
                        <div className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                          {activeRecord.decrypted.skorPgBenar} / {activeRecord.decrypted.totalSoal}
                        </div>
                      </div>
                      <div className="h-8 w-px bg-slate-200" aria-hidden="true" />
                      <div className="text-right">
                        <div className="text-xs text-slate-500">Nilai Akhir (0–100)</div>
                        <div className="font-mono text-2xl font-bold text-emerald-700 tabular-nums">
                          {activeRecord.decrypted.nilaiAkhir}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Integrity & Filter Row */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-600">
                      <span className="font-semibold">SHA-256: </span>
                      <span className="font-mono">{activeRecord.integritySha256}</span>
                    </div>

                    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
                      {(
                        [
                          { id: 'all', label: 'Semua (50)' },
                          { id: 'correct', label: 'Benar' },
                          { id: 'incorrect', label: 'Salah' },
                          { id: 'unanswered', label: 'Kosong' },
                        ] as { id: ItemFilter; label: string }[]
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setItemFilter(tab.id)}
                          className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                            itemFilter === tab.id
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Itemized Breakdown Table 1-50 */}
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <tr>
                          <th className="px-3.5 py-2.5">No. Tampil</th>
                          <th className="px-3.5 py-2.5">questionId Asli</th>
                          <th className="px-3.5 py-2.5">LKPD & Topik</th>
                          <th className="px-3.5 py-2.5">Jawaban Siswa</th>
                          <th className="px-3.5 py-2.5">Kunci Asli</th>
                          <th className="px-3.5 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredItems.map((it) => (
                          <tr key={it.questionId} className="hover:bg-slate-50/70">
                            <td className="px-3.5 py-2.5 font-mono font-semibold text-slate-900 tabular-nums">
                              #{it.displayNumber}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono text-xs text-slate-700">
                              {it.questionId}
                            </td>
                            <td className="px-3.5 py-2.5 text-xs text-slate-600">
                              <span className="font-semibold text-blue-700">{it.lkpd}</span>
                              <span aria-hidden="true"> · </span>
                              <span>{it.topic}</span>
                            </td>
                            <td className="px-3.5 py-2.5 font-mono text-xs text-slate-800">
                              {it.selectedOriginalLetter ? (
                                <span>
                                  Opsi Asli <strong>{it.selectedOriginalLetter}</strong>{' '}
                                  <span className="text-slate-400">
                                    (Tampil {it.selectedDisplayLetter})
                                  </span>
                                </span>
                              ) : (
                                <span className="text-slate-400">Tidak Dijawab</span>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900">
                              {it.originalKey}
                            </td>
                            <td className="px-3.5 py-2.5 text-xs font-semibold">
                              {it.isCorrect ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700">
                                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  Benar
                                </span>
                              ) : it.selectedOriginalLetter === null ? (
                                <span className="inline-flex items-center gap-1 text-slate-500">
                                  Kosong
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-700">
                                  <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                  Salah
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
};
