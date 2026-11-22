import { OptionLetter, PacketCode, RawQuestion, ShuffledOption, ShuffledQuestion, Student } from '../types/cbt';

const PACKET_ORDER: readonly PacketCode[] = ['A', 'B', 'C', 'D', 'E'];
const OPTION_LETTERS: readonly OptionLetter[] = ['A', 'B', 'C', 'D', 'E'];

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
 * Memetakan siswa ke salah satu dari 5 paket (A, B, C, D, E) secara deterministik.
 * Menggunakan kombinasi hash kelas/sekolah + nomor absen agar siswa dengan nomor absen
 * berurutan selalu mendapat paket berbeda, dan tetap konsisten bila halaman di-refresh.
 */
export function assignStudentPacket(student: Student): PacketCode {
  const absenNum = parseInt(student.noAbsen, 10);
  const safeAbsen = Number.isFinite(absenNum) ? absenNum : fnv1a32(student.noAbsen);
  const classOffset = fnv1a32(`${student.sekolah}|${student.kelas}`) % 5;
  const index = (Math.max(0, safeAbsen - 1) + classOffset) % 5;
  return PACKET_ORDER[index];
}

/**
 * Membangun naskah ujian 50 soal untuk siswa tertentu:
 * - Menentukan paket deterministik (A–E)
 * - Mengacak urutan ke-50 soal menggunakan FNV-1a + Mulberry32 + Fisher-Yates
 * - Mengacak urutan opsi A–E per soal secara deterministik
 */
export function buildStudentExamPaper(
  student: Student,
  packetBank: Record<PacketCode, RawQuestion[]>
): { packetCode: PacketCode; questions: ShuffledQuestion[] } {
  const packetCode = assignStudentPacket(student);
  const rawQuestions = packetBank[packetCode];
  const identitySeedString = `${student.sekolah}|${student.kelas}|${student.noAbsen}|${student.nama}`;
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

  return { packetCode, questions: prepared };
}
