import { ethers, network } from "hardhat";
import { H, readDeployment } from "./common";

const Fase = { Molitura: 1, Analisi: 2, Spedizione: 4 };

async function main() {
  const dep = readDeployment(network.name);
  const signers = await ethers.getSigners();
  const by = (a: string) => signers.find((s) => s.address === a);
  const prod = by(dep.roles.PRODUTTORE_ROLE), fran = by(dep.roles.FRANTOIO_ROLE),
    lab = by(dep.roles.LABORATORIO_ROLE), imb = by(dep.roles.IMBOTTIGLIATORE_ROLE);
  if (!prod || !fran || !lab || !imb) throw new Error("Seed needs local signers for all four roles");
  const c = await ethers.getContractAt("PietreDiVita", dep.contract);

  const lots = [
    { codice: "25B001", cultivar: "Frantoio", date: "2025-10-18", kg: 2100, temp: 24, resa: "14%", acidita: "0,22", perossidi: "6,1", bott: 520, richiamo: "" },
    { codice: "25B002", cultivar: "Leccino", date: "2025-10-25", kg: 1200, temp: 25, resa: "13%", acidita: "0,28", perossidi: "7,4", bott: 300, richiamo: "" },
    { codice: "25B003", cultivar: "Moraiolo", date: "2025-11-04", kg: 2500, temp: 23, resa: "15%", acidita: "0,31", perossidi: "9,8", bott: 600, richiamo: "Analisi di controllo non conforme" },
  ];
  for (const l of lots) {
    const k = l.codice.toLowerCase();
    const ts = Math.floor(new Date(l.date).getTime() / 1000);
    await (await c.connect(prod).creaLotto(l.codice, l.cultivar, "Colline di Arezzo", ts, l.kg, H(`${k}-raccolta.jpg`))).wait();
    const id = await c.idDaCodice(l.codice);
    await (await c.connect(fran).aggiungiPasso(id, Fase.Molitura, `Molitura a freddo, ${l.temp} C, resa ${l.resa}`, H(`${k}-molitura.jpg`))).wait();
    await (await c.connect(lab).aggiungiPasso(id, Fase.Analisi, `Acidita ${l.acidita}%, perossidi ${l.perossidi} meq O2/kg, esito: extravergine`, H(`${k}-referto.pdf`))).wait();
    await (await c.connect(imb).imbottiglia(id, l.bott, H(`${k}-etichetta.jpg`))).wait();
    if (l.richiamo) await (await c.connect(prod).richiama(id, l.richiamo)).wait();
    console.log(`Lot ${l.codice} -> id ${id}${l.richiamo ? " (recalled)" : ""}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
