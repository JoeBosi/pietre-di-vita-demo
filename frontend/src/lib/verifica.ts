export interface HashMatch { fase: number; documento_id: number; match: boolean }
export interface Verifica {
  onchain: boolean;
  esiste: boolean | null;
  richiamato: boolean | null;
  hashMatch: HashMatch[];
  explorerBase?: string;
  errore?: string;
  statoCoerente?: boolean;
}
export interface Documento { id: number; filename: string; mime: string; size: number; sha256: string; url: string }
export interface Passo {
  fase: number; fase_nome: string; descrizione: string; attore: string; timestamp: number;
  tx_hash: string | null; tx_url: string | null; documento: Documento | null;
}
export interface Lotto {
  codice: string; cultivar: string; zona: string; data_raccolta: number; kg_olive: number;
  n_bottiglie: number | null; richiamato: boolean; motivo_richiamo: string | null;
  tx_create: string | null; tx_create_url: string | null; fasi_completate: number[];
}
export interface Payload {
  bottiglia?: { numero: number; di: number };
  lotto: Lotto; passi: Passo[]; verifica: Verifica; offline: boolean;
}

export type Stato = 'verified' | 'unverifiable' | 'recalled';
export type Prova = 'ok' | 'bad' | 'none';

/** Recalled wins over everything; verified needs a clean on-chain comparison. */
export function deriveStato(p: Pick<Payload, 'lotto' | 'verifica' | 'offline'>): Stato {
  const v = p.verifica;
  if (p.lotto.richiamato || v.richiamato === true) return 'recalled';
  if (p.offline || !v.onchain || v.errore || v.esiste !== true || v.statoCoerente === false) return 'unverifiable';
  return v.hashMatch.every((h) => h.match) ? 'verified' : 'unverifiable';
}

/** Proof for one step: ok (document matches), bad (differs), none (nothing to compare). */
export function proofForStep(p: Pick<Payload, 'verifica' | 'offline'>, passo: Passo): Prova {
  if (p.offline || !p.verifica.onchain || !passo.documento) return 'none';
  const h = p.verifica.hashMatch.find((x) => x.documento_id === passo.documento!.id);
  if (!h) return 'none';
  return h.match ? 'ok' : 'bad';
}
