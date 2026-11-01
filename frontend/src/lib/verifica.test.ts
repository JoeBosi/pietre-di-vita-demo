import { describe, expect, it } from 'vitest';
import { deriveStato, proofForStep, type Passo, type Payload } from './verifica';

const lotto = { codice: 'X', cultivar: 'Frantoio', zona: 'Z', data_raccolta: 0, kg_olive: 1, n_bottiglie: 10,
  richiamato: false, motivo_richiamo: null, tx_create: null, tx_create_url: null, fasi_completate: [0] };
const passo: Passo = { fase: 2, fase_nome: 'Analisi', descrizione: '', attore: 'x', timestamp: 0, tx_hash: null, tx_url: null,
  documento: { id: 7, filename: 'a.pdf', mime: 'application/pdf', size: 1, sha256: 'ab', url: '/api/documenti/7' } };
const mk = (o: Partial<Payload['verifica']> = {}, l: Partial<typeof lotto> = {}, offline = false): Payload => ({
  lotto: { ...lotto, ...l }, passi: [passo], offline,
  verifica: { onchain: true, esiste: true, richiamato: false, hashMatch: [{ fase: 2, documento_id: 7, match: true }], ...o },
});

describe('deriveStato', () => {
  it('verified when everything matches', () => expect(deriveStato(mk())).toBe('verified'));
  it('unverifiable when offline', () => expect(deriveStato(mk({ onchain: false, esiste: null }, {}, true))).toBe('unverifiable'));
  it('unverifiable when lot not on chain', () => expect(deriveStato(mk({ esiste: false }))).toBe('unverifiable'));
  it('unverifiable on hash mismatch', () =>
    expect(deriveStato(mk({ hashMatch: [{ fase: 2, documento_id: 7, match: false }] }))).toBe('unverifiable'));
  it('unverifiable on chain read error', () => expect(deriveStato(mk({ errore: 'x' }))).toBe('unverifiable'));
  it('recalled from lot, even offline', () => expect(deriveStato(mk({}, { richiamato: true }, true))).toBe('recalled'));
  it('recalled from chain', () => expect(deriveStato(mk({ richiamato: true }))).toBe('recalled'));
});

describe('proofForStep', () => {
  it('ok', () => expect(proofForStep(mk(), passo)).toBe('ok'));
  it('bad', () => expect(proofForStep(mk({ hashMatch: [{ fase: 2, documento_id: 7, match: false }] }), passo)).toBe('bad'));
  it('none offline', () => expect(proofForStep(mk({}, {}, true), passo)).toBe('none'));
  it('none without document', () => expect(proofForStep(mk(), { ...passo, documento: null })).toBe('none'));
});
