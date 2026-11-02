// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract PassiMinimi is AccessControl {
    bytes32 public constant FRANTOIO_ROLE = keccak256("FRANTOIO_ROLE");
    bytes32 public constant LABORATORIO_ROLE = keccak256("LABORATORIO_ROLE");

    enum Fase { Raccolta, Molitura, Analisi }
    struct Passo { Fase fase; address attore; uint64 timestamp; bytes32 docHash; }

    Passo[] private _passi;
    error FaseFuoriOrdine(Fase fase);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _registra(Fase.Raccolta, bytes32(0));
    }

    function molisci(bytes32 docHash) external onlyRole(FRANTOIO_ROLE) { _avanza(Fase.Molitura, docHash); }
    function analizza(bytes32 docHash) external onlyRole(LABORATORIO_ROLE) { _avanza(Fase.Analisi, docHash); }

    function _avanza(Fase fase, bytes32 docHash) private {
        Fase ultima = _passi[_passi.length - 1].fase;
        if (uint8(fase) != uint8(ultima) + 1) revert FaseFuoriOrdine(fase);
        _registra(fase, docHash);
    }

    function _registra(Fase fase, bytes32 docHash) private {
        _passi.push(Passo(fase, msg.sender, uint64(block.timestamp), docHash));
    }
}
