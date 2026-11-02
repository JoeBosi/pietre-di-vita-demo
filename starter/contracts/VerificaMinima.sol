// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract VerificaMinima {
    mapping(bytes32 => uint256) private _idPerCodice; // keccak256(code) => id, 0 = unknown
    mapping(uint256 => uint32) private _nBottiglie;
    mapping(uint256 => bool) private _richiamato;

    function verificaBottiglia(string calldata codice, uint32 n)
        external
        view
        returns (bool esiste, bool richiamato, uint256 id)
    {
        id = _idPerCodice[keccak256(bytes(codice))];
        if (id == 0) return (false, false, 0);
        esiste = n >= 1 && n <= _nBottiglie[id];
        richiamato = _richiamato[id];
    }
}
