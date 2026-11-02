# Pietre di Vita - basic starter

Result of the tutorial `tutorial/en/build.html` (invented mill, test data only).

    npm install
    cp .env.example .env      # then set API_TOKEN to a random string
    npx hardhat test
    npx hardhat node          # window 1
    npx hardhat run scripts/deploy.js --network localhost   # window 2
    node server/index.js      # window 3

Never commit `.env`. Use only test wallets.

## Try it online (no installation)

- `contracts/MiniOlio.sol`, `LottoMinimo.sol`, `PassiMinimi.sol`, `VerificaMinima.sol`: open them in Remix IDE (compiler 0.8.24).
- `web/`: a small page that reads the real Pietre di Vita contract on Polygon Amoy and shows green or red for a bottle.
  Run it locally with `cd web && npm install && npm run dev`, or open it in StackBlitz.
- `scripts/fingerprint.mjs`: `node scripts/fingerprint.mjs report.txt [expected-fingerprint]` prints the SHA-256 fingerprint of a file.
- The Python notebooks are in `../notebooks/` (Google Colab).
