import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { api } from '../lib/api';

const SCAN = 'https://amoy.polygonscan.com';
const CONTRACT = '0x158a5026eD83888a443f2bA921Faf07C2D04bE0E';
const ROLES: [string, string, string][] = [
  ['Agricoltore', 'Grower', '0x9Dcf430f211933786b25d9C27e51AEe8c9b7E8FC'],
  ['Frantoio', 'Mill', '0xaA7D798B43a688c30Afb40333aAf47dc7FcAA23c'],
  ['Laboratorio', 'Lab', '0xE6C6e60126b8B00A6C369eE34999cb7367B651ea'],
  ['Imbottigliatore', 'Bottler', '0xc86c529F9003beAD61Da908C5a723548DE38c11A'],
];
const TX_HARVEST = '0xda201d4a65c4be00ecfaa36f0b1e5ba629f498352605af29317743e12ca0ee08';
const TX_MILL = '0x5b57f9ca8bbec34ed53734187248e533abfd84bd1b1df7f40d29580efe7dc6ff';
const TX_RECALL = '0x75f87d192faf4a877f97efa4a34ab7bd31316c87949f4c60f62473fe1a8471e7';
const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;

const TXT = {
  it: {
    title: 'Come funziona, e verificalo tu',
    intro: 'Ogni cosa che leggi qui si controlla con un clic, su registri pubblici.',
    steps: [
      ['Un contratto pubblico', 'Le regole della filiera stanno in un contratto chiamato PietreDiVita, sulla rete di prova Polygon Amoy. Il suo codice è pubblico e verificato.'],
      ['Ogni lotto è un token unico', 'Il lotto ha una propria carta d\'identità digitale, un token unico che nessuno può duplicare.'],
      ['Quattro ruoli, ognuno con il suo wallet', 'Agricoltore, Frantoio, Laboratorio e Imbottigliatore hanno un wallet ciascuno. Ognuno scrive il proprio passo, nell\'ordine giusto.'],
      ['Per ogni passo restano quattro dati', 'Fase, chi l\'ha scritto, quando e la descrizione. Eccone uno vero, il passo di molitura del lotto 25B001.'],
      ['Ogni bottiglia ha un numero', 'Le bottiglie sono numerate dentro il lotto e il codice QR porta dritto alla bottiglia.'],
      ['Il richiamo è immediato', 'Se un lotto ha un problema, il produttore lo segnala sul registro e ogni bottiglia lo mostra subito.'],
      ['Cosa si vede e dove sta', 'I dati del lotto sono in chiaro. Foto e documenti stanno sul server, e la loro impronta digitale (hash) è scritta sulla catena: se il file cambia, l\'impronta non corrisponde più.'],
      ['Chi lavora nella filiera entra con utente e password', 'Il server scrive sulla catena con il wallet del ruolo, così chi lavora non deve gestire chiavi.'],
    ],
    links: {
      contract: 'Contratto su Polygonscan', code: 'Codice verificato su Sourcify', token: 'Token del lotto 25B001', tx: 'Transazione del passo di molitura',
      bottle: 'Apri la bottiglia 1 del lotto 25B001', recalled: 'Apri il lotto richiamato 25B003', recallTx: 'Transazione del richiamo', harvestTx: 'Transazione con l\'impronta del documento',
      doc: 'Documento del lotto 25B001', filiera: 'Prova tu la filiera',
    },
    hashLabel: 'Impronta (SHA-256) del documento di raccolta del lotto 25B001',
    hashHow: 'Per confrontarla: scarica il documento, calcola l\'impronta (Mac e Linux: shasum -a 256 nomefile; Windows: certutil -hashfile nomefile SHA256) e confrontala con quella scritta nella transazione di raccolta.',
  },
  en: {
    title: 'How it works, and check it yourself',
    intro: 'Everything you read here can be checked with one click, on public records.',
    steps: [
      ['A public contract', 'The rules of the supply chain live in a contract called PietreDiVita, on the Polygon Amoy test network. Its code is public and verified.'],
      ['Every lot is a unique token', 'A lot has its own digital identity card, a unique token that nobody can copy.'],
      ['Four roles, each with its own wallet', 'Grower, Mill, Lab and Bottler each have a wallet. Each one writes their own step, in the right order.'],
      ['Four facts remain for every step', 'Phase, who wrote it, when, and the description. Here is a real one, the milling step of lot 25B001.'],
      ['Every bottle has a number', 'Bottles are numbered inside the lot and the QR code leads straight to the bottle.'],
      ['A recall is immediate', 'If a lot has a problem, the producer flags it on the record and every bottle shows it right away.'],
      ['What you see and where it lives', 'The lot data are in the open. Photos and documents live on the server, and their digital fingerprint (hash) is written on the chain: if the file changes, the fingerprint no longer matches.'],
      ['People in the supply chain sign in with username and password', 'The server writes to the chain with the role\'s wallet, so the people at work do not have to handle keys.'],
    ],
    links: {
      contract: 'Contract on Polygonscan', code: 'Verified code on Sourcify', token: 'Token of lot 25B001', tx: 'Transaction of the milling step',
      bottle: 'Open bottle 1 of lot 25B001', recalled: 'Open the recalled lot 25B003', recallTx: 'Recall transaction', harvestTx: 'Transaction with the document fingerprint',
      doc: 'Document of lot 25B001', filiera: 'Try the supply chain yourself',
    },
    hashLabel: 'Fingerprint (SHA-256) of the harvest document of lot 25B001',
    hashHow: 'To compare it: download the document, compute the fingerprint (Mac and Linux: shasum -a 256 filename; Windows: certutil -hashfile filename SHA256) and compare it with the one written in the harvest transaction.',
  },
} as const;

const A = 'inline-flex items-center min-h-11 text-olive-800 font-medium underline underline-offset-2 mr-4';
const ext = { target: '_blank', rel: 'noreferrer' } as const;

export function VerifySection() {
  const { lang } = useI18n();
  const x = TXT[lang];
  const [hash, setHash] = useState<string | null>(null);
  useEffect(() => {
    api<{ passi: { fase: number; documento?: { sha256: string } }[] }>('/api/pubblico/bottiglia/25B001/1')
      .then((d) => setHash(d.passi.find((p) => p.fase === 0)?.documento?.sha256 ?? null)).catch(() => setHash(null));
  }, []);
  const L = x.links;
  const links = [
    <><a className={A} href={`${SCAN}/address/${CONTRACT}#code`} {...ext}>{L.contract}</a><a className={A} href={`https://repo.sourcify.dev/80002/${CONTRACT}`} {...ext}>{L.code}</a></>,
    <a className={A} href={`${SCAN}/nft/${CONTRACT}/5`} {...ext}>{L.token}</a>,
    <>{ROLES.map(([it, en, a]) => <a key={a} className={A} href={`${SCAN}/address/${a}`} {...ext}>{lang === 'it' ? it : en} {short(a)}</a>)}</>,
    <a className={A} href={`${SCAN}/tx/${TX_MILL}`} {...ext}>{L.tx}</a>,
    <Link className={A} to="/b/25B001/1">{L.bottle}</Link>,
    <><Link className={A} to="/b/25B003/1">{L.recalled}</Link><a className={A} href={`${SCAN}/tx/${TX_RECALL}`} {...ext}>{L.recallTx}</a></>,
    <><a className={A} href={`${SCAN}/tx/${TX_HARVEST}`} {...ext}>{L.harvestTx}</a><a className={A} href="/api/documenti/1" {...ext}>{L.doc}</a></>,
    <Link className={A} to="/filiera">{L.filiera}</Link>,
  ];
  return (
    <section aria-labelledby="verify" className="space-y-4">
      <h2 id="verify" className="text-2xl font-semibold">{x.title}</h2>
      <p className="text-gray-700">{x.intro}</p>
      <ol className="space-y-3">
        {x.steps.map(([t, d], i) => (
          <li key={t} className="rounded-xl border border-olive-100 bg-white p-4">
            <h3 className="font-semibold text-lg leading-snug"><span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-olive-700 text-white text-base">{i + 1}</span>{t}</h3>
            <p className="mt-1 text-base text-gray-700">{d}</p>
            {i === 6 && hash && (
              <div className="mt-2 rounded-lg bg-olive-50 p-3 text-sm">
                <p className="font-medium">{x.hashLabel}</p>
                <p className="mt-1 break-all font-mono text-xs">{hash}</p>
                <p className="mt-2 text-gray-700">{x.hashHow}</p>
              </div>
            )}
            <div className="mt-1">{links[i]}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}
