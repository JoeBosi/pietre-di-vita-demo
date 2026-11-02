require("dotenv").config({ quiet: true });
const express = require("express");
const crypto = require("crypto");
const QRCode = require("qrcode");
const { reader, writer, address, ethers } = require("./chain");

const PORT = process.env.PORT || 3900;
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;
const API_TOKEN = process.env.API_TOKEN;
if (!API_TOKEN) throw new Error("Set API_TOKEN in .env");

const FASI = { Raccolta: 0, Molitura: 1, Analisi: 2 };
const app = express();

// Express 4 does not catch errors thrown in async handlers: this wrapper passes them to the error handler
const h = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// SHA-256 of the received bytes, as a 0x... value that fits a bytes32
const sha256Hex = (buf) => "0x" + crypto.createHash("sha256").update(buf).digest("hex");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- private API (needs the token) ----------
const api = express.Router();
api.use((req, res, next) => {
  if (req.get("x-api-token") !== API_TOKEN) return res.status(401).json({ error: "bad token" });
  next();
});
api.use(express.json());
api.use(express.raw({ type: "application/octet-stream", limit: "20mb" }));

api.post("/hash", (req, res) => {
  res.json({ sha256: sha256Hex(req.body) });
});

api.post("/lotto", h(async (req, res) => {
  const c = await writer();
  const tx = await c.creaLotto(req.body.codice);
  await tx.wait();
  res.json({ ok: true, tx: tx.hash, id: Number(await c.idDaCodice(req.body.codice)) });
}));

// Body = the document (PDF, photo, ...). The server hashes it and writes only the hash on-chain.
api.post("/lotto/:codice/passo", h(async (req, res) => {
  const fase = FASI[req.query.fase];
  if (fase === undefined) return res.status(400).json({ error: "fase must be Raccolta, Molitura or Analisi" });
  const c = await writer();
  const id = await c.idDaCodice(req.params.codice);
  const docHash = sha256Hex(req.body);
  const tx = await c.aggiungiPasso(id, fase, String(req.query.descrizione || ""), docHash);
  await tx.wait();
  res.json({ ok: true, tx: tx.hash, docHash });
}));

api.post("/lotto/:codice/imbottiglia", h(async (req, res) => {
  const c = await writer();
  const id = await c.idDaCodice(req.params.codice);
  const docHash = sha256Hex(req.body);
  const tx = await c.imbottiglia(id, Number(req.query.prima), Number(req.query.ultima), docHash);
  await tx.wait();
  res.json({ ok: true, tx: tx.hash, docHash });
}));

api.post("/lotto/:codice/richiama", h(async (req, res) => {
  const c = await writer();
  const id = await c.idDaCodice(req.params.codice);
  const tx = await c.richiama(id, req.body.motivo);
  await tx.wait();
  res.json({ ok: true, tx: tx.hash });
}));

// Errors from the chain (wrong role, wrong order...) come back as a readable 400
api.use((err, req, res, next) => {
  res.status(400).json({ error: err.reason || err.shortMessage || err.message });
});
app.use("/api", api);

// ---------- public part (no token, read only) ----------
app.get("/qr/:codice/:n.png", h(async (req, res) => {
  const url = `${BASE_URL}/b/${encodeURIComponent(req.params.codice)}/${Number(req.params.n)}`;
  res.type("png").send(await QRCode.toBuffer(url, { width: 300, margin: 2 }));
}));

app.get("/b/:codice/:n", h(async (req, res) => {
  const codice = req.params.codice;
  const n = Number(req.params.n);
  if (!Number.isInteger(n) || n < 0) return res.status(400).send("Bad bottle number");

  const [valida, richiamato, id] = await reader.verificaBottiglia(codice, n);
  let verdetto = "green";
  let titolo = "Valid bottle";
  if (id === 0n) { verdetto = "red"; titolo = "Unknown lot"; }
  else if (richiamato) { verdetto = "red"; titolo = "Recalled lot: do not use"; }
  else if (!valida) { verdetto = "red"; titolo = "This bottle number does not exist in the lot"; }

  let passiHtml = "";
  if (id !== 0n) {
    const passi = await reader.passi(id);
    passiHtml = "<ol>" + passi.map((p) =>
      `<li>${["Harvest", "Milling", "Analysis", "Bottling"][Number(p.fase)]}: ${esc(p.descrizione)}` +
      ` <small>(${new Date(Number(p.quando) * 1000).toISOString().slice(0, 10)}, document hash ${esc(p.docHash.slice(0, 12))}...)</small></li>`
    ).join("") + "</ol>";
  }

  res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bottle ${esc(codice)} / ${n}</title>
<style>body{font:18px/1.5 system-ui,sans-serif;max-width:36rem;margin:0 auto;padding:16px;background:#fff;color:#222}
.v{padding:16px;border-radius:8px;color:#fff;font-weight:700}.green{background:#2f7d32}.red{background:#b3261e}small{color:#555}</style></head>
<body><p>Pietre di Vita (invented mill, teaching demo) - bottle ${n} of lot ${esc(codice)}</p>
<div class="v ${verdetto}">${verdetto === "green" ? "GREEN" : "RED"}: ${titolo}</div>${passiHtml}
<p><small>Read directly from the contract ${esc(address)}.</small></p></body></html>`);
}));

// Last safety net for the public pages
app.use((err, req, res, next) => {
  res.status(500).send("Could not read the blockchain. Try again later.");
});

app.listen(PORT, "127.0.0.1", () => console.log(`Server on ${BASE_URL}, contract ${address}`));
