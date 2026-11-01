// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title Pietre di Vita - olive oil lot traceability (fictional mill).
/// @notice Each lot is an ERC-721 token. Each production phase is a signed,
///         append-only step recorded by the actor holding the matching role.
contract PietreDiVita is ERC721, AccessControl {
    bytes32 public constant PRODUTTORE_ROLE = keccak256("PRODUTTORE_ROLE");
    bytes32 public constant FRANTOIO_ROLE = keccak256("FRANTOIO_ROLE");
    bytes32 public constant LABORATORIO_ROLE = keccak256("LABORATORIO_ROLE");
    bytes32 public constant IMBOTTIGLIATORE_ROLE = keccak256("IMBOTTIGLIATORE_ROLE");

    enum Fase { Raccolta, Molitura, Analisi, Imbottigliamento, Spedizione }

    struct Lotto {
        string codice;
        string cultivar;
        string zona;
        uint64 dataRaccolta;
        uint32 kgOlive;
        uint32 nBottiglie;
        bool richiamato;
        string motivoRichiamo;
    }

    struct Passo {
        Fase fase;
        address attore;
        uint64 timestamp;
        string descrizione;
        bytes32 docHash;
    }

    error CodiceDuplicato(string codice);
    error FaseFuoriOrdine(Fase fase);
    error RuoloNonAutorizzato(Fase fase, address chi);
    error LottoInesistente(uint256 id);
    error GiaImbottigliato(uint256 id);
    error GiaRichiamato(uint256 id);
    error NumeroBottiglieNullo();

    event LottoCreato(uint256 indexed id, string codice, address indexed produttore);
    event PassoAggiunto(uint256 indexed id, Fase fase, address indexed attore, bytes32 docHash);
    event Imbottigliato(uint256 indexed id, uint32 nBottiglie);
    event Richiamato(uint256 indexed id, string motivo);

    uint256 private _ultimoId;
    mapping(uint256 => Lotto) private _lotti;
    mapping(uint256 => Passo[]) private _passi;
    mapping(bytes32 => uint256) private _idPerCodice; // keccak256(codice) => id

    constructor(address admin) ERC721("Pietre di Vita Lotto", "PDV") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Creates a lot (mints the token to the caller) and records the Raccolta step.
    /// @param docHash Hash of the harvest proof (e.g. photo); may be zero.
    function creaLotto(
        string calldata codice,
        string calldata cultivar,
        string calldata zona,
        uint64 dataRaccolta,
        uint32 kgOlive,
        bytes32 docHash
    ) external onlyRole(PRODUTTORE_ROLE) returns (uint256 id) {
        bytes32 k = keccak256(bytes(codice));
        if (_idPerCodice[k] != 0) revert CodiceDuplicato(codice);

        id = ++_ultimoId;
        _idPerCodice[k] = id;
        Lotto storage l = _lotti[id];
        l.codice = codice;
        l.cultivar = cultivar;
        l.zona = zona;
        l.dataRaccolta = dataRaccolta;
        l.kgOlive = kgOlive;

        _mint(msg.sender, id);
        emit LottoCreato(id, codice, msg.sender);
        _registra(id, Fase.Raccolta, "Raccolta", docHash);
    }

    /// @notice Adds a Molitura, Analisi or Spedizione step. Raccolta is automatic and
    ///         Imbottigliamento must go through imbottiglia() (it also fixes nBottiglie).
    function aggiungiPasso(uint256 id, Fase fase, string calldata descrizione, bytes32 docHash) external {
        if (fase == Fase.Raccolta || fase == Fase.Imbottigliamento) revert FaseFuoriOrdine(fase);
        _controllaRuolo(fase);
        _controllaEsiste(id);
        _controllaOrdine(id, fase);
        _registra(id, fase, descrizione, docHash);
    }

    /// @notice Records the Imbottigliamento step and fixes the bottle count (once).
    function imbottiglia(uint256 id, uint32 nBottiglie, bytes32 docHash)
        external
        onlyRole(IMBOTTIGLIATORE_ROLE)
    {
        _controllaEsiste(id);
        if (nBottiglie == 0) revert NumeroBottiglieNullo();
        if (_lotti[id].nBottiglie != 0) revert GiaImbottigliato(id);
        _controllaOrdine(id, Fase.Imbottigliamento);
        _lotti[id].nBottiglie = nBottiglie;
        _registra(id, Fase.Imbottigliamento, "Imbottigliamento", docHash);
        emit Imbottigliato(id, nBottiglie);
    }

    /// @notice Recalls a lot (once).
    function richiama(uint256 id, string calldata motivo) external onlyRole(PRODUTTORE_ROLE) {
        _controllaEsiste(id);
        if (_lotti[id].richiamato) revert GiaRichiamato(id);
        _lotti[id].richiamato = true;
        _lotti[id].motivoRichiamo = motivo;
        emit Richiamato(id, motivo);
    }

    function lotto(uint256 id) external view returns (Lotto memory) {
        _controllaEsiste(id);
        return _lotti[id];
    }

    /// @notice Returns 0 if the code is unknown.
    function idDaCodice(string calldata codice) external view returns (uint256) {
        return _idPerCodice[keccak256(bytes(codice))];
    }

    function passi(uint256 id) external view returns (Passo[] memory) {
        _controllaEsiste(id);
        return _passi[id];
    }

    /// @notice Public check for a bottle: exists if the lot exists and 1 <= n <= nBottiglie.
    function verificaBottiglia(string calldata codice, uint32 n)
        external
        view
        returns (bool esiste, bool richiamato, uint256 id)
    {
        id = _idPerCodice[keccak256(bytes(codice))];
        if (id == 0) return (false, false, 0);
        Lotto storage l = _lotti[id];
        esiste = n >= 1 && n <= l.nBottiglie;
        richiamato = l.richiamato;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ---- internals ----

    function _controllaEsiste(uint256 id) private view {
        if (id == 0 || id > _ultimoId) revert LottoInesistente(id);
    }

    function _controllaRuolo(Fase fase) private view {
        bytes32 r = fase == Fase.Molitura
            ? FRANTOIO_ROLE
            : fase == Fase.Analisi
                ? LABORATORIO_ROLE
                : fase == Fase.Imbottigliamento ? IMBOTTIGLIATORE_ROLE : PRODUTTORE_ROLE;
        if (!hasRole(r, msg.sender)) revert RuoloNonAutorizzato(fase, msg.sender);
    }

    /// @dev Order Raccolta > Molitura > Analisi > Imbottigliamento > Spedizione*.
    function _controllaOrdine(uint256 id, Fase fase) private view {
        Passo[] storage p = _passi[id];
        Fase ultima = p[p.length - 1].fase;
        bool ok = fase == Fase.Spedizione
            ? (ultima == Fase.Imbottigliamento || ultima == Fase.Spedizione)
            : uint8(fase) == uint8(ultima) + 1;
        if (!ok) revert FaseFuoriOrdine(fase);
    }

    function _registra(uint256 id, Fase fase, string memory descrizione, bytes32 docHash) private {
        _passi[id].push(Passo(fase, msg.sender, uint64(block.timestamp), descrizione, docHash));
        emit PassoAggiunto(id, fase, msg.sender, docHash);
    }
}
