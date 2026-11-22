export const APPS_SCRIPT_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbytFh9YG4zJa48sCxAdKVGOcJ2Bedev4_v7FUxVLj7qnkAkWRAUHvm8ZyTZOsYD4z5PrQ/exec';

export const EXAM_TITLE = 'Uji Kompetensi LKPD 1–5';
export const SUBJECT_NAME = 'Pemrograman Web (Kejuruan TJKT)';
export const ACADEMIC_YEAR = '2026/2027';
export const EXAM_DURATION_MINUTES = 90;
export const TOTAL_QUESTIONS_PER_PACKET = 50;
export const ENCRYPTION_VERSION = 'AES-256-GCM-PBKDF2-v1';

// Daftar token aktif untuk validasi lokal (serta fallback jika Apps Script offline/CORS)
export const ACTIVE_EXAM_TOKENS: readonly string[] = [
  'WEBXI-2026',
  'TJKT-WEB-26',
  'SMK-SKW-2026',
];

// SHA-256 digest untuk verifikasi akses Portal Guru (kode akses tidak disimpan plaintext)
export const TEACHER_CODE_SHA256 =
  '6f1a0689dd3f8d7fe5ae3a7546a3fd8b50d4c0b75a3b09d3e8260a15465e25ce';

export const CRYPTO_DOMAIN_CONTEXT = 'EVALWEB-TJKT-LKPD1-5-SINGKAWANG-2026';

export const STORAGE_KEYS = {
  EXAM_PROGRESS: 'evalweb_tjkt_cbt_progress_v1',
  LAST_SUBMISSION: 'evalweb_tjkt_cbt_last_submission_v1',
} as const;
