import { OptionLetter, PacketCode, RawQuestion, ShuffledOption, ShuffledQuestion, Student } from '../types/cbt';

const PACKET_ORDER: readonly PacketCode[] = ['A', 'B', 'C', 'D', 'E'];
const OPTION_LETTERS: readonly OptionLetter[] = ['A', 'B', 'C', 'D', 'E'];

/**
 * Mengembalikan tanggal kalender WIB (Asia/Jakarta, UTC+7) dalam format YYYY-MM-DD.
 * Pergantian hari terjadi tepat pukul 00:00 WIB setiap 24 jam.
 */
export function getWibDateKey(timestampMs: number = Date.now()): string {
  try {
    const formatted = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(timestampMs));
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
      return formatted;
    }
  } catch {
    // Fallback manual ke UTC+7
  }
  const wibDate = new Date(timestampMs + 7 * 60 * 60 * 1000);
  const y = wibDate.getUTCFullYear();
  const m = String(wibDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(wibDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Mengonversi YYYY-MM-DD menjadi indeks hari bulat agar rotasi paket selalu bergeser +1 setiap hari.
 */
export function getDayIndexFromDateKey(dateKey: string): number {
  const parts = dateKey.split('-').map((v) => parseInt(v, 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return Math.floor(Date.now() / 86400000);
  }
  const [year, month, day] = parts;
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

/**
 * 32-bit FNV-1a hash deterministik.
 */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Mulberry32 PRNG deterministik berbasis seed 32-bit.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle deterministik dengan PRNG yang diberikan.
 */
export function fisherYatesShuffle<T>(items: readonly T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

/**
 * Memetakan siswa ke salah satu dari 5 paket (A, B, C, D, E) secara deterministik:
 * - Siswa bernomor absen berurutan pada hari yang sama mendapat paket berbeda.
 * - Setiap berganti hari (lewat pukul 00:00 WIB / > 24 jam), paket siswa otomatis bergeser
 *   sehingga siswa yang sama mendapat paket berbeda dari hari sebelumnya,
 *   namun tetap konsisten bila halaman di-refresh di hari/sesi yang sama.
 */
export function assignStudentPacket(
  student: Student,
  examDateKey: string = getWibDateKey()
): PacketCode {
  const absenNum = parseInt(student.noAbsen, 10);
  const safeAbsen = Number.isFinite(absenNum) ? absenNum : fnv1a32(student.noAbsen);
  const classOffset = fnv1a32(`${student.sekolah}|${student.kelas}`) % 5;
  const dayOffset = getDayIndexFromDateKey(examDateKey);
  const index = (Math.max(0, safeAbsen - 1) + classOffset + dayOffset) % 5;
  return PACKET_ORDER[index];
}

/**
 * Membangun naskah ujian 50 soal untuk siswa tertentu pada tanggal sesi `examDateKey`:
 * - Menentukan paket harian deterministik (A–E)
 * - Mengacak urutan ke-50 soal menggunakan FNV-1a + Mulberry32 + Fisher-Yates (berbasis identitas + tanggal)
 * - Mengacak urutan opsi A–E per soal secara deterministik
 */
export function buildStudentExamPaper(
  student: Student,
  packetBank: Record<PacketCode, RawQuestion[]>,
  examDateKey: string = getWibDateKey()
): { packetCode: PacketCode; examDateKey: string; questions: ShuffledQuestion[] } {
  const packetCode = assignStudentPacket(student, examDateKey);
  const rawQuestions = packetBank[packetCode];
  const identitySeedString = `${student.sekolah}|${student.kelas}|${student.noAbsen}|${student.nama}|${examDateKey}`;
  const baseSeed = fnv1a32(identitySeedString);
  const questionRng = mulberry32(baseSeed);

  const shuffledQuestions = fisherYatesShuffle(rawQuestions, questionRng);

  const prepared: ShuffledQuestion[] = shuffledQuestions.map((q, idx) => {
    const optionSeed = baseSeed ^ fnv1a32(q.questionId);
    const optionRng = mulberry32(optionSeed);
    const shuffledOrigLetters = fisherYatesShuffle(OPTION_LETTERS, optionRng);

    const options: ShuffledOption[] = shuffledOrigLetters.map((origLetter, optIdx) => ({
      displayLetter: OPTION_LETTERS[optIdx],
      originalLetter: origLetter,
      text: q.options[origLetter],
    }));

    return {
      displayNumber: idx + 1,
      packetCode: q.packetCode,
      questionId: q.questionId,
      lkpd: q.lkpd,
      topic: q.topic,
      prompt: q.prompt,
      codeSnippet: q.codeSnippet,
      options,
      originalKey: q.originalKey,
    };
  });

  return { packetCode, examDateKey, questions: prepared };
}
