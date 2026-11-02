// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title MiniOlio - a minimal olive oil traceability contract (teaching example, invented mill)
/// Each lot is an ERC-721 token. Every phase is recorded with the hash of a document.
contract MiniOlio is ERC721, AccessControl {
    // The four phases, in the order they must be recorded
    enum Fase { Raccolta, Molitura, Analisi, Imbottigliamento }

    struct Passo {
        Fase fase;
        address attore;
        uint64 quando;
        bytes32 docHash; // fingerprint (SHA-256) of the document kept off-chain
        string descrizione;
    }

    struct Lotto {
        string codice;
        uint32 primaBottiglia; // first bottle number (0 until bottled)
        uint32 ultimaBottiglia; // last bottle number (0 until bottled)
        bool richiamato;
        string motivoRichiamo;
    }

    bytes32 public constant PRODUTTORE_ROLE = keccak256("PRODUTTORE_ROLE");
    bytes32 public constant LABORATORIO_ROLE = keccak256("LABORATORIO_ROLE");
    bytes32 public constant IMBOTTIGLIATORE_ROLE = keccak256("IMBOTTIGLIATORE_ROLE");

    uint256 private _ultimoId;
    mapping(uint256 => Lotto) private _lotti;
    mapping(uint256 => Passo[]) private _passi;
    mapping(bytes32 => uint256) private _idDaCodice; // keccak256(code) => token id

    event LottoCreato(uint256 indexed id, string codice);
    event PassoAggiunto(uint256 indexed id, Fase fase, address indexed attore, bytes32 docHash);
    event Imbottigliato(uint256 indexed id, uint32 primaBottiglia, uint32 ultimaBottiglia);
    event Richiamato(uint256 indexed id, string motivo);

    constructor() ERC721("Pietre di Vita - lotto", "PDV") {
        // For this demo the deployer gets every role. In real life each role goes to a different person.
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PRODUTTORE_ROLE, msg.sender);
        _grantRole(LABORATORIO_ROLE, msg.sender);
        _grantRole(IMBOTTIGLIATORE_ROLE, msg.sender);
    }

    /// Creates a lot: mints one token to the producer who calls.
    function creaLotto(string calldata codice) external onlyRole(PRODUTTORE_ROLE) returns (uint256 id) {
        require(bytes(codice).length > 0, "empty code");
        require(_idDaCodice[keccak256(bytes(codice))] == 0, "code already used");
        id = ++_ultimoId;
        _lotti[id].codice = codice;
        _idDaCodice[keccak256(bytes(codice))] = id;
        _safeMint(msg.sender, id);
        emit LottoCreato(id, codice);
    }

    /// Records Raccolta, Molitura or Analisi. Phases must follow the order, no skipping.
    function aggiungiPasso(uint256 id, Fase fase, string calldata descrizione, bytes32 docHash) external {
        require(fase != Fase.Imbottigliamento, "use imbottiglia");
        _controllaRuolo(fase);
        _controllaOrdine(id, fase);
        _registra(id, fase, descrizione, docHash);
    }

    /// Records the bottling and the range of bottle numbers (first..last, both included).
    function imbottiglia(uint256 id, uint32 prima, uint32 ultima, bytes32 docHash)
        external
        onlyRole(IMBOTTIGLIATORE_ROLE)
    {
        require(prima >= 1 && ultima >= prima, "bad range");
        _controllaOrdine(id, Fase.Imbottigliamento);
        _lotti[id].primaBottiglia = prima;
        _lotti[id].ultimaBottiglia = ultima;
        _registra(id, Fase.Imbottigliamento, "Bottling", docHash);
        emit Imbottigliato(id, prima, ultima);
    }

    /// Marks the lot as recalled. Anyone who then checks a bottle of the lot sees it.
    function richiama(uint256 id, string calldata motivo) external onlyRole(PRODUTTORE_ROLE) {
        _esiste(id);
        require(!_lotti[id].richiamato, "already recalled");
        _lotti[id].richiamato = true;
        _lotti[id].motivoRichiamo = motivo;
        emit Richiamato(id, motivo);
    }

    // ---------- reads (free, no wallet needed) ----------

    function lotto(uint256 id) external view returns (Lotto memory) {
        _esiste(id);
        return _lotti[id];
    }

    function passi(uint256 id) external view returns (Passo[] memory) {
        _esiste(id);
        return _passi[id];
    }

    function idDaCodice(string calldata codice) external view returns (uint256) {
        return _idDaCodice[keccak256(bytes(codice))];
    }

    /// Public check of one bottle. valida is true only if the lot exists, is fully bottled,
    /// the bottle number is inside the range and the lot is not recalled.
    function verificaBottiglia(string calldata codice, uint32 n)
        external
        view
        returns (bool valida, bool richiamato, uint256 id)
    {
        id = _idDaCodice[keccak256(bytes(codice))];
        if (id == 0) return (false, false, 0);
        Lotto storage l = _lotti[id];
        bool inIntervallo = l.primaBottiglia != 0 && n >= l.primaBottiglia && n <= l.ultimaBottiglia;
        richiamato = l.richiamato;
        valida = inIntervallo && !richiamato;
    }

    // ---------- internals ----------

    function _esiste(uint256 id) private view {
        require(id != 0 && id <= _ultimoId, "lot not found");
    }

    function _controllaRuolo(Fase fase) private view {
        if (fase == Fase.Analisi) _checkRole(LABORATORIO_ROLE);
        else _checkRole(PRODUTTORE_ROLE);
    }

    function _controllaOrdine(uint256 id, Fase fase) private view {
        _esiste(id);
        require(uint8(fase) == _passi[id].length, "phase out of order");
    }

    function _registra(uint256 id, Fase fase, string memory descrizione, bytes32 docHash) private {
        _passi[id].push(Passo(fase, msg.sender, uint64(block.timestamp), docHash, descrizione));
        emit PassoAggiunto(id, fase, msg.sender, docHash);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
