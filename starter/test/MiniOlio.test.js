const { expect } = require("chai");
const { ethers } = require("hardhat");

const Fase = { Raccolta: 0, Molitura: 1, Analisi: 2, Imbottigliamento: 3 };
const hash = (text) => ethers.keccak256(ethers.toUtf8Bytes(text)); // any 32-byte value works in tests

describe("MiniOlio", function () {
  let olio, owner, lab, outsider;

  beforeEach(async function () {
    [owner, lab, outsider] = await ethers.getSigners();
    olio = await ethers.deployContract("MiniOlio");
    // Give the lab account only the laboratory role
    await olio.grantRole(await olio.LABORATORIO_ROLE(), lab.address);
    await olio.creaLotto("TEST-001");
  });

  async function fillAllPhases() {
    await olio.aggiungiPasso(1, Fase.Raccolta, "Harvest", hash("a"));
    await olio.aggiungiPasso(1, Fase.Molitura, "Milling", hash("b"));
    await olio.connect(lab).aggiungiPasso(1, Fase.Analisi, "Analysis", hash("c"));
    await olio.imbottiglia(1, 1, 500, hash("d"));
  }

  it("creates a lot as an ERC-721 token owned by the producer", async function () {
    expect(await olio.ownerOf(1)).to.equal(owner.address);
    expect(await olio.idDaCodice("TEST-001")).to.equal(1n);
  });

  it("rejects a duplicate lot code", async function () {
    await expect(olio.creaLotto("TEST-001")).to.be.revertedWith("code already used");
  });

  it("records the phases in order", async function () {
    await fillAllPhases();
    const passi = await olio.passi(1);
    expect(passi.length).to.equal(4);
    expect(passi[2].attore).to.equal(lab.address);
  });

  it("refuses a phase out of order", async function () {
    await expect(olio.connect(lab).aggiungiPasso(1, Fase.Analisi, "Too early", hash("x"))).to.be.revertedWith(
      "phase out of order"
    );
  });

  it("refuses someone without the right role", async function () {
    await expect(olio.connect(outsider).aggiungiPasso(1, Fase.Raccolta, "Intruder", hash("x"))).to.be.revertedWithCustomError(
      olio,
      "AccessControlUnauthorizedAccount"
    );
  });

  it("keeps the lab out of the producer's phases", async function () {
    await expect(olio.connect(lab).aggiungiPasso(1, Fase.Raccolta, "Wrong role", hash("x"))).to.be.revertedWithCustomError(
      olio,
      "AccessControlUnauthorizedAccount"
    );
  });

  it("validates only bottles inside the bottled range", async function () {
    await fillAllPhases();
    expect((await olio.verificaBottiglia("TEST-001", 1)).valida).to.equal(true);
    expect((await olio.verificaBottiglia("TEST-001", 500)).valida).to.equal(true);
    expect((await olio.verificaBottiglia("TEST-001", 501)).valida).to.equal(false);
    expect((await olio.verificaBottiglia("TEST-001", 0)).valida).to.equal(false);
  });

  it("does not validate bottles of a lot that is not bottled yet", async function () {
    expect((await olio.verificaBottiglia("TEST-001", 1)).valida).to.equal(false);
  });

  it("does not know an unknown lot", async function () {
    const r = await olio.verificaBottiglia("NOPE", 1);
    expect(r.valida).to.equal(false);
    expect(r.id).to.equal(0n);
  });

  it("marks every bottle of a recalled lot as not valid", async function () {
    await fillAllPhases();
    await olio.richiama(1, "Test recall");
    const r = await olio.verificaBottiglia("TEST-001", 10);
    expect(r.valida).to.equal(false);
    expect(r.richiamato).to.equal(true);
  });

  it("lets only the producer recall", async function () {
    await expect(olio.connect(lab).richiama(1, "No")).to.be.revertedWithCustomError(olio, "AccessControlUnauthorizedAccount");
  });
});
