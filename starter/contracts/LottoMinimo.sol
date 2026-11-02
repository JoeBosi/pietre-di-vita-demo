// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract LottoMinimo is ERC721 {
    enum Fase { Raccolta, Molitura, Analisi, Imbottigliamento }

    struct Lotto {
        string codice;
        string cultivar;
        uint32 nBottiglie;
        bool richiamato;
    }

    uint256 private _ultimoId;
    mapping(uint256 => Lotto) private _lotti;

    constructor() ERC721("Lotto minimo", "LTT") {}

    function creaLotto(string calldata codice, string calldata cultivar) external returns (uint256 id) {
        id = ++_ultimoId;
        _lotti[id] = Lotto(codice, cultivar, 0, false);
        _mint(msg.sender, id);
    }
}
