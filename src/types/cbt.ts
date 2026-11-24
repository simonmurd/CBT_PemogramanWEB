export type PacketCode = 'A' | 'B' | 'C' | 'D' | 'E';

export type OptionLetter = 'A' | 'B' | 'C' | 'D' | 'E';

export interface Student {
  id: string;
  sekolah: string;
  kelas: string;
  noAbsen: string;
  nama: string;
}

export interface RawQuestion {
  packetCode: PacketCode;
  questionId: string;
  lkpd: string;
  topic: string;
  prompt: string;
  codeSnippet?: string;
  options: Record<OptionLetter, string>;
  originalKey: OptionLetter;
}

export interface ShuffledOption {
  displayLetter: OptionLetter;
  originalLetter: OptionLetter;
  text: string;
}

export interface ShuffledQuestion {
  displayNumber: number;
  packetCode: PacketCode;
  questionId: string;
  lkpd: string;
  topic: string;
  prompt: string;
  codeSnippet?: string;
  options: ShuffledOption[];
  originalKey: OptionLetter;
}

export interface ExamProgressStorage {
  studentId: string;
  packetCode: PacketCode;
  examDateKey?: string;
  tokenUjian: string;
  answers: Record<string, OptionLetter>; // questionId -> selected displayLetter
  doubtIds: string[]; // questionIds marked Ragu-Ragu
  tabViolations: number;
  startTimestamp: number;
  endTimestamp: number;
  currentIndex: number;
}

export interface EncryptedEnvelope {
  v: string;
  alg: 'AES-256-GCM';
  kdf: 'PBKDF2-SHA256';
  iter: number;
  salt: string; // base64
  iv: string; // base64
  ct: string; // base64
}

export interface ItemBreakdown {
  displayNumber: number;
  questionId: string;
  lkpd: string;
  topic: string;
  selectedDisplayLetter: OptionLetter | null;
  selectedOriginalLetter: OptionLetter | null;
  originalKey: OptionLetter;
  isCorrect: boolean;
}

export interface DecryptedExamResult {
  student: Student;
  packetCode: PacketCode;
  tokenUjian: string;
  mataPelajaran: string;
  submittedAt: string;
  durasiTerpakaiDetik: number;
  jumlahPelanggaranTab: number;
  jumlahTerjawab: number;
  totalSoal: number;
  skorPgBenar: number;
  nilaiAkhir: number;
  items: ItemBreakdown[];
}

export type ServerSyncStatus = 'idle' | 'sending' | 'success' | 'error';

export interface StudentBackupRecord {
  backupVersion: string;
  studentId: string;
  sekolah: string;
  kelas: string;
  namaPeserta: string;
  noAbsen: string;
  mataPelajaran: string;
  paketSoal: PacketCode;
  tokenUjian: string;
  jumlahTerjawab: number;
  totalSoal: number;
  durasiDetik: number;
  jumlahPelanggaranTab: number;
  submittedAt: string;
  encryptionVersion: string;
  integritySha256: string;
  encryptedPayload: string; // JSON string of EncryptedEnvelope
  serverSyncStatus: ServerSyncStatus;
}

export interface AppsScriptSubmissionPayload {
  sekolah: string;
  kelas: string;
  nama_lengkap: string;
  pilihan_lkpd: string;
  paket_soal: PacketCode;
  durasi_detik: number;
  skor_pg_benar: number;
  nilai_akhir: number;
  timestamp: string;
  nama_peserta: string;
  nis_no_peserta: string;
  kelas_rombel: string;
  mata_pelajaran: string;
  token_ujian: string;
  durasi_terpakai_detik: number;
  jumlah_pelanggaran_tab: number;
  encryption_version: string;
  integrity_sha256: string;
  rekap_jawaban: string;
  encrypted_payload: string;
}

export interface TeacherDecryptedRecord {
  id: string;
  sourceLabel: string;
  integrityValid: boolean;
  integritySha256: string;
  decrypted: DecryptedExamResult;
}
