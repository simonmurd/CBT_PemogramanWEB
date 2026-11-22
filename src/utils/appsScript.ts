import { ACTIVE_EXAM_TOKENS, APPS_SCRIPT_ENDPOINT } from '../config/examConfig';
import { AppsScriptSubmissionPayload } from '../types/cbt';

export interface TokenValidationResult {
  valid: boolean;
  source: 'server' | 'local-fallback';
  message: string;
}

/**
 * Memvalidasi token ujian ke Google Apps Script (bila tersedia & mendukung GET),
 * dengan fallback otomatis ke daftar token lokal aktif.
 */
export async function validateExamToken(rawToken: string): Promise<TokenValidationResult> {
  const token = rawToken.trim().toUpperCase();
  if (!token) {
    return {
      valid: false,
      source: 'local-fallback',
      message: 'Silakan masukkan token ujian terlebih dahulu.',
    };
  }

  // Cek ke endpoint Apps Script terlebih dahulu dengan timeout singkat (2.5 detik)
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 2500);
    const url = `${APPS_SCRIPT_ENDPOINT}?action=validateToken&token=${encodeURIComponent(token)}`;
    const response = await fetch(url, { method: 'GET', signal: controller.signal });
    window.clearTimeout(timer);

    if (response.ok) {
      const text = await response.text();
      try {
        const json = JSON.parse(text) as { valid?: boolean; status?: string; message?: string };
        if (typeof json.valid === 'boolean') {
          return {
            valid: json.valid,
            source: 'server',
            message: json.valid
              ? 'Token terverifikasi aktif dari server.'
              : json.message || 'Token tidak terdaftar atau sudah kedaluwarsa di server.',
          };
        }
      } catch {
        // Apps Script mungkin hanya mengembalikan HTML/teks untuk doPost; lanjut ke validasi lokal
      }
    }
  } catch {
    // Jaringan lambat atau CORS GET tidak diaktifkan; gunakan fallback lokal
  }

  const isLocalValid = ACTIVE_EXAM_TOKENS.includes(token);
  return {
    valid: isLocalValid,
    source: 'local-fallback',
    message: isLocalValid
      ? 'Token terverifikasi aktif (validasi lokal).'
      : 'Token ujian tidak valid. Periksa kembali token dari pengawas ujian.',
  };
}

/**
 * Mengirim hasil ujian ke Google Apps Script doPost(e) menggunakan Content-Type: text/plain;charset=utf-8
 * dengan fallback mode: 'no-cors' bila browser memblokir preflight/CORS.
 */
export async function submitExamToAppsScript(
  payload: AppsScriptSubmissionPayload
): Promise<{ ok: boolean; mode: 'cors' | 'no-cors'; message: string }> {
  const bodyString = JSON.stringify(payload);

  try {
    const response = await fetch(APPS_SCRIPT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: bodyString,
    });

    if (response.ok || response.type === 'opaque') {
      return {
        ok: true,
        mode: 'cors',
        message: 'Data hasil ujian berhasil dikirim dan dicatat di server.',
      };
    }

    throw new Error(`HTTP ${response.status}`);
  } catch {
    // Fallback mode: 'no-cors' sesuai spesifikasi Apps Script Web App
    try {
      await fetch(APPS_SCRIPT_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: bodyString,
      });

      return {
        ok: true,
        mode: 'no-cors',
        message: 'Permintaan pengiriman telah diteruskan ke Google Apps Script (mode no-cors).',
      };
    } catch (err) {
      return {
        ok: false,
        mode: 'no-cors',
        message:
          err instanceof Error
            ? `Gagal terhubung ke server: ${err.message}`
            : 'Gagal mengirim data ke server. Simpan file cadangan dan coba kirim ulang.',
      };
    }
  }
}
