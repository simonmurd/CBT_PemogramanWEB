import { CRYPTO_DOMAIN_CONTEXT, ENCRYPTION_VERSION, TEACHER_CODE_SHA256 } from '../config/examConfig';
import { DecryptedExamResult, EncryptedEnvelope } from '../types/cbt';

const PBKDF2_ITERATIONS = 120000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function sha256Hex(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deriveAesKey(passphrase: string, salt: Uint8Array, usage: KeyUsage[]): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    usage
  );
}

function buildPassphraseFromDigest(codeDigestHex: string): string {
  return `${codeDigestHex}:${CRYPTO_DOMAIN_CONTEXT}`;
}

export async function verifyTeacherAccessCode(inputCode: string): Promise<string | null> {
  const trimmed = inputCode.trim();
  if (!trimmed) return null;
  const digest = await sha256Hex(trimmed);
  if (digest === TEACHER_CODE_SHA256) {
    return digest;
  }
  return null;
}

export async function encryptExamResult(result: DecryptedExamResult): Promise<{
  envelope: EncryptedEnvelope;
  encryptedJson: string;
  integritySha256: string;
}> {
  const plaintext = JSON.stringify(result);
  const integritySha256 = await sha256Hex(plaintext);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const passphrase = buildPassphraseFromDigest(TEACHER_CODE_SHA256);
  const key = await deriveAesKey(passphrase, salt, ['encrypt']);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext)
  );

  const envelope: EncryptedEnvelope = {
    v: ENCRYPTION_VERSION,
    alg: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iter: PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(ciphertextBuffer)),
  };

  return {
    envelope,
    encryptedJson: JSON.stringify(envelope),
    integritySha256,
  };
}

export async function decryptExamResult(
  encryptedInput: string,
  verifiedCodeDigest: string,
  expectedIntegritySha256?: string
): Promise<{
  decrypted: DecryptedExamResult;
  computedSha256: string;
  integrityValid: boolean;
}> {
  const parsed: EncryptedEnvelope = JSON.parse(encryptedInput);
  if (parsed.alg !== 'AES-256-GCM' || !parsed.salt || !parsed.iv || !parsed.ct) {
    throw new Error('Format ciphertext AES-256-GCM tidak valid.');
  }

  const salt = base64ToBytes(parsed.salt);
  const iv = base64ToBytes(parsed.iv);
  const ct = base64ToBytes(parsed.ct);

  const passphrase = buildPassphraseFromDigest(verifiedCodeDigest);
  const key = await deriveAesKey(passphrase, salt, ['decrypt']);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ct as BufferSource
  );

  const plaintext = new TextDecoder().decode(decryptedBuffer);
  const computedSha256 = await sha256Hex(plaintext);
  const decrypted: DecryptedExamResult = JSON.parse(plaintext);

  const integrityValid = expectedIntegritySha256
    ? computedSha256.toLowerCase() === expectedIntegritySha256.trim().toLowerCase()
    : true;

  return {
    decrypted,
    computedSha256,
    integrityValid,
  };
}
