# Pietre di Vita - basic starter

Result of the tutorial `tutorial/en/build.html` (invented mill, test data only).

    npm install
    cp .env.example .env      # then set API_TOKEN to a random string
    npx hardhat test
    npx hardhat node          # window 1
    npx hardhat run scripts/deploy.js --network localhost   # window 2
    node server/index.js      # window 3

Never commit `.env`. Use only test wallets.
