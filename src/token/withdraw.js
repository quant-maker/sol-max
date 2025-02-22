const { Transaction, SystemProgram, LAMPORTS_PER_SOL, Connection, PublicKey } = require("@solana/web3.js");
const dotenv = require("dotenv");
const { getOrCreateKeypair } = require("./util.js");

dotenv.config();

let KEYS_FOLDER, RPC_URL, TRADE_ACCOUNT, WITHDRAWAL_ADDRESS;

if (process.env.PRODUCTION === "mainnet") {
    KEYS_FOLDER = __dirname + "/.keys";
    RPC_URL = process.env.MAINNET_RPC_URL || "https://api.mainnet-beta.solana.com";
    TRADE_ACCOUNT = process.env.TRADE_ACCOUNT || "trade-account-1";
    WITHDRAWAL_ADDRESS = process.env.WITHDRAWAL_ADDRESS || "";
}
else {
    KEYS_FOLDER = __dirname + "/.devkeys";
    RPC_URL = "https://api.devnet.solana.com";
    TRADE_ACCOUNT = process.env.TRADE_ACCOUNT || "trade-account-1";
    WITHDRAWAL_ADDRESS = process.env.WITHDRAWAL_ADDRESS || "";
}

// Function to transfer SOL from one account to another
async function transferSOL(connection, fromKeypair, toPubkey) {
    try {
        const balance = await connection.getBalance(fromKeypair.publicKey);
        const minRentExempt = 5000; // Keeping a small buffer for safety
        if (balance <= minRentExempt) {
            return 'Skipping '+ fromKeypair.publicKey.toBase58() + ' insufficient balance.<br>';
        }
        const amountToTransfer = balance - minRentExempt;
        const transaction = new Transaction().add(SystemProgram.transfer({
            fromPubkey: fromKeypair.publicKey,
            toPubkey: toPubkey,
            lamports: amountToTransfer,
        }));
        const signature = connection.sendTransaction(transaction, [fromKeypair]);
        //await connection.confirmTransaction(signature, 'processed');
        return 'Transferred ' + (amountToTransfer / LAMPORTS_PER_SOL).toFixed(6) + ' SOL from ' + fromKeypair.publicKey.toBase58() + ' to ' + toPubkey.toBase58() + '<br>';
    }
    catch (error) {
        return 'Error transferring from ' + fromKeypair.publicKey.toBase58() + ' to ' + toPubkey.toBase58() + ': '+ error.message + '<br>';
    }
}

async function withdrawFromTraderWallet() {
    const connection = new Connection(RPC_URL);
    const tradeAccount = getOrCreateKeypair(KEYS_FOLDER, TRADE_ACCOUNT);
    if (WITHDRAWAL_ADDRESS == "") {
        return "Withdrawl address is not set.";
    }
    const toAccount = new PublicKey(WITHDRAWAL_ADDRESS);
    let result = await transferSOL(connection, tradeAccount, toAccount);
    return result;
}

function getTraderAddress() {
    const tradeAccount = getOrCreateKeypair(KEYS_FOLDER, TRADE_ACCOUNT);
    return tradeAccount.publicKey.toBase58();
}

module.exports = { withdrawFromTraderWallet, getTraderAddress };
