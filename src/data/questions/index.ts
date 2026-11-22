import { PacketCode, RawQuestion } from '../../types/cbt';
import { PAKET_A_QUESTIONS } from './paketA';
import { PAKET_B_QUESTIONS } from './paketB';
import { PAKET_C_QUESTIONS } from './paketC';
import { PAKET_D_QUESTIONS } from './paketD';
import { PAKET_E_QUESTIONS } from './paketE';

export const QUESTION_BANK: Record<PacketCode, RawQuestion[]> = {
  A: PAKET_A_QUESTIONS,
  B: PAKET_B_QUESTIONS,
  C: PAKET_C_QUESTIONS,
  D: PAKET_D_QUESTIONS,
  E: PAKET_E_QUESTIONS,
};

export const PACKET_DESCRIPTIONS: Record<PacketCode, string> = {
  A: 'Paket A — Arsitektur Web, Tools, HTML5 Dasar, Tabel & Hyperlink',
  B: 'Paket B — Protokol Web, Ekosistem Dev, Struktur HTML, List & Tautan',
  C: 'Paket C — Client-Server, DevTools, Profesi Web, Semantik & Link',
  D: 'Paket D — HTTP Status, Server Lokal, Metadata, Tabel & Navigasi',
  E: 'Paket E — Simulasi Web, Editor, Struktur Dokumen, Tabel & Protokol Tautan',
};
