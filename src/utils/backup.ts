import { StudentBackupRecord, TeacherDecryptedRecord } from '../types/cbt';

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function triggerFileDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Mengunduh file JSON cadangan siswa (strictly tanpa nilai akhir / kunci jawaban).
 */
export function downloadStudentJsonBackup(record: StudentBackupRecord): void {
  const safeName = record.namaPeserta.replace(/[^a-zA-Z0-9]+/g, '_');
  const filename = `CADANGAN_CBT_${record.paketSoal}_${record.noAbsen}_${safeName}.json`;
  const exportObj = {
    backupVersion: record.backupVersion,
    studentId: record.studentId,
    sekolah: record.sekolah,
    kelas: record.kelas,
    noAbsen: record.noAbsen,
    namaPeserta: record.namaPeserta,
    mataPelajaran: record.mataPelajaran,
    paketSoal: record.paketSoal,
    tokenUjian: record.tokenUjian,
    jumlahTerjawab: record.jumlahTerjawab,
    totalSoal: record.totalSoal,
    durasiDetik: record.durasiDetik,
    jumlahPelanggaranTab: record.jumlahPelanggaranTab,
    submittedAt: record.submittedAt,
    encryptionVersion: record.encryptionVersion,
    integritySha256: record.integritySha256,
    encryptedPayload: record.encryptedPayload,
  };
  triggerFileDownload(filename, JSON.stringify(exportObj, null, 2), 'application/json;charset=utf-8');
}

/**
 * Mengunduh file CSV cadangan siswa (strictly tanpa nilai akhir / kunci jawaban).
 */
export function downloadStudentCsvBackup(record: StudentBackupRecord): void {
  const safeName = record.namaPeserta.replace(/[^a-zA-Z0-9]+/g, '_');
  const filename = `CADANGAN_CBT_${record.paketSoal}_${record.noAbsen}_${safeName}.csv`;

  const headers = [
    'backup_version',
    'student_id',
    'sekolah',
    'kelas',
    'no_absen',
    'nama_peserta',
    'mata_pelajaran',
    'paket_soal',
    'token_ujian',
    'jumlah_terjawab',
    'total_soal',
    'durasi_detik',
    'jumlah_pelanggaran_tab',
    'submitted_at',
    'encryption_version',
    'integrity_sha256',
    'encrypted_payload',
  ];

  const row = [
    record.backupVersion,
    record.studentId,
    record.sekolah,
    record.kelas,
    record.noAbsen,
    record.namaPeserta,
    record.mataPelajaran,
    record.paketSoal,
    record.tokenUjian,
    record.jumlahTerjawab,
    record.totalSoal,
    record.durasiDetik,
    record.jumlahPelanggaranTab,
    record.submittedAt,
    record.encryptionVersion,
    record.integritySha256,
    record.encryptedPayload,
  ];

  const csvContent = `${headers.join(',')}\n${row.map(escapeCsvCell).join(',')}\n`;
  triggerFileDownload(filename, csvContent, 'text/csv;charset=utf-8');
}

/**
 * Parser CSV sederhana yang mendukung tanda kutip ganda ber-escape.
 */
function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentCell);
        currentCell = '';
      } else if (ch === '\r' && next === '\n') {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += ch;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

export interface ParsedCipherSource {
  sourceLabel: string;
  encryptedPayload: string;
  integritySha256?: string;
}

/**
 * Mengekstrak payload terenkripsi dari teks JSON, CSV cadangan, atau ciphertext mentah.
 */
export function extractCipherSources(rawText: string, filename = 'Tempelan Manual'): ParsedCipherSource[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // Coba parse sebagai JSON terlebih dahulu
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const extracted: ParsedCipherSource[] = [];

      items.forEach((item, idx) => {
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          if (typeof obj.encryptedPayload === 'string') {
            extracted.push({
              sourceLabel: filename,
              encryptedPayload: obj.encryptedPayload,
              integritySha256: typeof obj.integritySha256 === 'string' ? obj.integritySha256 : undefined,
            });
          } else if (typeof obj.encrypted_payload === 'string') {
            extracted.push({
              sourceLabel: filename,
              encryptedPayload: obj.encrypted_payload,
              integritySha256: typeof obj.integrity_sha256 === 'string' ? obj.integrity_sha256 : undefined,
            });
          } else if (obj.alg === 'AES-256-GCM' && typeof obj.ct === 'string') {
            extracted.push({
              sourceLabel: `${filename}${items.length > 1 ? ` #${idx + 1}` : ''}`,
              encryptedPayload: JSON.stringify(obj),
            });
          }
        }
      });

      if (extracted.length > 0) return extracted;
    } catch {
      // Lanjut cek sebagai CSV
    }
  }

  // Cek apakah berbentuk CSV dengan header encrypted_payload
  const csvRows = parseCsvRows(trimmed);
  if (csvRows.length >= 2) {
    const header = csvRows[0].map((h) => h.trim().toLowerCase());
    const payloadIdx = header.findIndex((h) => h === 'encrypted_payload' || h === 'encryptedpayload');
    const hashIdx = header.findIndex((h) => h === 'integrity_sha256' || h === 'integritysha256');

    if (payloadIdx !== -1) {
      const sources: ParsedCipherSource[] = [];
      for (let r = 1; r < csvRows.length; r++) {
        const payloadCell = csvRows[r][payloadIdx]?.trim();
        if (payloadCell) {
          sources.push({
            sourceLabel: `${filename} (Baris ${r})`,
            encryptedPayload: payloadCell,
            integritySha256: hashIdx !== -1 ? csvRows[r][hashIdx]?.trim() : undefined,
          });
        }
      }
      if (sources.length > 0) return sources;
    }
  }

  throw new Error(`Tidak ditemukan field encryptedPayload / AES-256-GCM yang valid pada "${filename}".`);
}

/**
 * Mengekspor rekap hasil ujian khusus Portal Guru ke file CSV lengkap dengan skor & rincian butir.
 */
export function downloadTeacherRecapCsv(records: TeacherDecryptedRecord[]): void {
  const headers = [
    'sekolah',
    'kelas',
    'no_absen',
    'nama_peserta',
    'paket_soal',
    'token_ujian',
    'jumlah_terjawab',
    'total_soal',
    'skor_pg_benar',
    'nilai_akhir',
    'durasi_detik',
    'jumlah_pelanggaran_tab',
    'integrity_valid',
    'integrity_sha256',
    'submitted_at',
    'rincian_butir',
  ];

  const lines = records.map((rec) => {
    const d = rec.decrypted;
    const itemSummary = d.items
      .map(
        (it) =>
          `${it.displayNumber}:${it.questionId}:${it.selectedOriginalLetter ?? '-'}/${it.originalKey}:${
            it.isCorrect ? '1' : '0'
          }`
      )
      .join(' | ');

    return [
      d.student.sekolah,
      d.student.kelas,
      d.student.noAbsen,
      d.student.nama,
      d.packetCode,
      d.tokenUjian,
      d.jumlahTerjawab,
      d.totalSoal,
      d.skorPgBenar,
      d.nilaiAkhir,
      d.durasiTerpakaiDetik,
      d.jumlahPelanggaranTab,
      rec.integrityValid ? 'VALID' : 'TIDAK_COCOK',
      rec.integritySha256,
      d.submittedAt,
      itemSummary,
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  const csvContent = `${headers.join(',')}\n${lines.join('\n')}\n`;
  const dateTag = new Date().toISOString().slice(0, 10);
  triggerFileDownload(`REKAP_NILAI_GURU_TJKT_${dateTag}.csv`, csvContent, 'text/csv;charset=utf-8');
}
