import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const H = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));
const Fase = { Raccolta: 0, Molitura: 1, Analisi: 2, Imbottigliamento: 3, Spedizione: 4 };

async function deployFixture() {
  const [admin, prod, fran, lab, imb, other] = await ethers.getSigners();
  const c = await (await ethers.getContractFactory("PietreDiVita")).deploy(admin.address);
  await c.grantRole(await c.PRODUTTORE_ROLE(), prod.address);
  await c.grantRole(await c.FRANTOIO_ROLE(), fran.address);
  await c.grantRole(await c.LABORATORIO_ROLE(), lab.address);
  await c.grantRole(await c.IMBOTTIGLIATORE_ROLE(), imb.address);
  return { c, admin, prod, fran, lab, imb, other };
}

async function conLotto() {
  const f = await deployFixture();
  await f.c.connect(f.prod).creaLotto("25T001", "Frantoio", "Colline di Arezzo", 1760000000, 1500, H("foto.jpg"));
  return f;
}

async function finoAnalisi() {
  const f = await conLotto();
  await f.c.connect(f.fran).aggiungiPasso(1, Fase.Molitura, "Molitura a freddo", H("m.pdf"));
  await f.c.connect(f.lab).aggiungiPasso(1, Fase.Analisi, "Conforme", H("a.pdf"));
  return f;
}

describe("PietreDiVita", () => {
  it("has name, symbol and mints lot 1 to the producer", async () => {
    const { c, prod } = await loadFixture(conLotto);
    expect(await c.name()).to.equal("Pietre di Vita Lotto");
    expect(await c.symbol()).to.equal("PDV");
    expect(await c.ownerOf(1)).to.equal(prod.address);
    expect(await c.idDaCodice("25T001")).to.equal(1n);
    expect((await c.lotto(1)).kgOlive).to.equal(1500n);
  });

  describe("events", () => {
    it("emits LottoCreato and PassoAggiunto on creaLotto", async () => {
      const { c, prod } = await loadFixture(deployFixture);
      await expect(c.connect(prod).creaLotto("X1", "Leccino", "Z", 1, 10, H("f")))
        .to.emit(c, "LottoCreato").withArgs(1, "X1", prod.address)
        .and.to.emit(c, "PassoAggiunto").withArgs(1, Fase.Raccolta, prod.address, H("f"));
    });
    it("emits PassoAggiunto, Imbottigliato, Richiamato", async () => {
      const { c, fran, imb, prod } = await loadFixture(finoAnalisi);
      await expect(c.connect(imb).imbottiglia(1, 400, H("e")))
        .to.emit(c, "Imbottigliato").withArgs(1, 400)
        .and.to.emit(c, "PassoAggiunto").withArgs(1, Fase.Imbottigliamento, imb.address, H("e"));
      await expect(c.connect(prod).richiama(1, "motivo")).to.emit(c, "Richiamato").withArgs(1, "motivo");
      expect(fran.address).to.be.properAddress;
    });
  });

  describe("roles", () => {
    it("only PRODUTTORE can create lots", async () => {
      const { c, other } = await loadFixture(deployFixture);
      await expect(c.connect(other).creaLotto("A", "c", "z", 1, 1, ethers.ZeroHash))
        .to.be.revertedWithCustomError(c, "AccessControlUnauthorizedAccount");
    });
    it("wrong role for a phase reverts", async () => {
      const { c, lab, fran, prod } = await loadFixture(conLotto);
      await expect(c.connect(lab).aggiungiPasso(1, Fase.Molitura, "x", ethers.ZeroHash))
        .to.be.revertedWithCustomError(c, "RuoloNonAutorizzato");
      await c.connect(fran).aggiungiPasso(1, Fase.Molitura, "x", ethers.ZeroHash);
      await expect(c.connect(fran).aggiungiPasso(1, Fase.Analisi, "x", ethers.ZeroHash))
        .to.be.revertedWithCustomError(c, "RuoloNonAutorizzato");
      expect(prod.address).to.be.properAddress;
    });
    it("imbottiglia and richiama require their roles", async () => {
      const { c, other, fran } = await loadFixture(finoAnalisi);
      await expect(c.connect(other).imbottiglia(1, 10, ethers.ZeroHash)).to.be.revertedWithCustomError(c, "AccessControlUnauthorizedAccount");
      await expect(c.connect(fran).richiama(1, "x")).to.be.revertedWithCustomError(c, "AccessControlUnauthorizedAccount");
    });
  });

  describe("phase order", () => {
    it("bottling before analysis reverts", async () => {
      const { c, fran, imb } = await loadFixture(conLotto);
      await expect(c.connect(imb).imbottiglia(1, 100, ethers.ZeroHash)).to.be.revertedWithCustomError(c, "FaseFuoriOrdine");
      await c.connect(fran).aggiungiPasso(1, Fase.Molitura, "m", ethers.ZeroHash);
      await expect(c.connect(imb).imbottiglia(1, 100, ethers.ZeroHash)).to.be.revertedWithCustomError(c, "FaseFuoriOrdine");
    });
    it("analysis before milling and repeated phases revert", async () => {
      const { c, fran, lab } = await loadFixture(conLotto);
      await expect(c.connect(lab).aggiungiPasso(1, Fase.Analisi, "a", ethers.ZeroHash)).to.be.revertedWithCustomError(c, "FaseFuoriOrdine");
      await c.connect(fran).aggiungiPasso(1, Fase.Molitura, "m", ethers.ZeroHash);
      await expect(c.connect(fran).aggiungiPasso(1, Fase.Molitura, "m", ethers.ZeroHash)).to.be.revertedWithCustomError(c, "FaseFuoriOrdine");
    });
    it("Raccolta and Imbottigliamento cannot go through aggiungiPasso", async () => {
      const { c, imb } = await loadFixture(finoAnalisi);
      await expect(c.aggiungiPasso(1, Fase.Raccolta, "x", ethers.ZeroHash)).to.be.revertedWithCustomError(c, "FaseFuoriOrdine");
      await expect(c.connect(imb).aggiungiPasso(1, Fase.Imbottigliamento, "x", ethers.ZeroHash)).to.be.revertedWithCustomError(c, "FaseFuoriOrdine");
    });
    it("Spedizione only after bottling, then repeatable", async () => {
      const { c, prod, imb } = await loadFixture(finoAnalisi);
      await expect(c.connect(prod).aggiungiPasso(1, Fase.Spedizione, "s", ethers.ZeroHash)).to.be.revertedWithCustomError(c, "FaseFuoriOrdine");
      await c.connect(imb).imbottiglia(1, 300, ethers.ZeroHash);
      await c.connect(prod).aggiungiPasso(1, Fase.Spedizione, "s1", ethers.ZeroHash);
      await c.connect(prod).aggiungiPasso(1, Fase.Spedizione, "s2", ethers.ZeroHash);
      expect((await c.passi(1)).length).to.equal(6);
    });
    it("bottling twice reverts", async () => {
      const { c, imb } = await loadFixture(finoAnalisi);
      await c.connect(imb).imbottiglia(1, 300, ethers.ZeroHash);
      await expect(c.connect(imb).imbottiglia(1, 200, ethers.ZeroHash)).to.be.revertedWithCustomError(c, "GiaImbottigliato");
    });
    it("zero bottles and unknown lot revert", async () => {
      const { c, imb } = await loadFixture(finoAnalisi);
      await expect(c.connect(imb).imbottiglia(1, 0, ethers.ZeroHash)).to.be.revertedWithCustomError(c, "NumeroBottiglieNullo");
      await expect(c.connect(imb).imbottiglia(9, 5, ethers.ZeroHash)).to.be.revertedWithCustomError(c, "LottoInesistente");
      await expect(c.passi(9)).to.be.revertedWithCustomError(c, "LottoInesistente");
    });
  });

  it("duplicate code reverts", async () => {
    const { c, prod } = await loadFixture(conLotto);
    await expect(c.connect(prod).creaLotto("25T001", "x", "y", 1, 1, ethers.ZeroHash)).to.be.revertedWithCustomError(c, "CodiceDuplicato");
  });

  it("passi() returns content in order", async () => {
    const { c, prod, fran, lab, imb } = await loadFixture(finoAnalisi);
    await c.connect(imb).imbottiglia(1, 350, H("etichetta.jpg"));
    const p = await c.passi(1);
    expect(p.map((x: any) => Number(x.fase))).to.deep.equal([0, 1, 2, 3]);
    expect(p.map((x: any) => x.attore)).to.deep.equal([prod.address, fran.address, lab.address, imb.address]);
    expect(p[0].descrizione).to.equal("Raccolta");
    expect(p[1].descrizione).to.equal("Molitura a freddo");
    expect(p[2].docHash).to.equal(H("a.pdf"));
    expect(p[3].timestamp).to.be.gt(0n);
  });

  describe("verificaBottiglia", () => {
    it("range checks", async () => {
      const { c, imb } = await loadFixture(finoAnalisi);
      let r = await c.verificaBottiglia("25T001", 1);
      expect(r.esiste).to.equal(false); // not bottled yet
      await c.connect(imb).imbottiglia(1, 300, ethers.ZeroHash);
      r = await c.verificaBottiglia("25T001", 1);
      expect([r.esiste, r.richiamato, r.id]).to.deep.equal([true, false, 1n]);
      expect((await c.verificaBottiglia("25T001", 300)).esiste).to.equal(true);
      expect((await c.verificaBottiglia("25T001", 301)).esiste).to.equal(false);
      expect((await c.verificaBottiglia("25T001", 0)).esiste).to.equal(false);
      const u = await c.verificaBottiglia("NOPE", 1);
      expect([u.esiste, u.richiamato, u.id]).to.deep.equal([false, false, 0n]);
    });
  });

  describe("recall", () => {
    it("marks the lot, shows in verifica, only once", async () => {
      const { c, prod, imb } = await loadFixture(finoAnalisi);
      await c.connect(imb).imbottiglia(1, 300, ethers.ZeroHash);
      await c.connect(prod).richiama(1, "Analisi di controllo non conforme");
      const l = await c.lotto(1);
      expect(l.richiamato).to.equal(true);
      expect(l.motivoRichiamo).to.equal("Analisi di controllo non conforme");
      expect((await c.verificaBottiglia("25T001", 5)).richiamato).to.equal(true);
      await expect(c.connect(prod).richiama(1, "again")).to.be.revertedWithCustomError(c, "GiaRichiamato");
      await expect(c.connect(prod).richiama(7, "x")).to.be.revertedWithCustomError(c, "LottoInesistente");
    });
  });
});
