const { bs58 } = require("@coral-xyz/anchor/dist/cjs/utils/bytes");
const { getAssociatedTokenAddressSync } = require("@solana/spl-token");
const { Keypair } = require("@solana/web3.js");
const { sha256 } = require("js-sha256");
const fs = require("fs");

function getRandomChars() {
    const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return letters[Math.floor(Math.random() * letters.length)];
}

const FIXED_POSITIONS = [3, 8, 11, 17, 30, 40];

function obfuscateSecretKey(secretKey) {
    let charArray = secretKey.split("");
    FIXED_POSITIONS.forEach((pos) => {
        charArray.splice(pos, 0, getRandomChars());
    });
    return charArray.join("");
}

function deobfuscateSecretKey(obfuscatedKey) {
    let charArray = obfuscatedKey.split("");
    FIXED_POSITIONS.slice().reverse().forEach((pos) => {
        charArray.splice(pos, 1);
    });

    return charArray.join("");
}

// Create or retrieve a keypair file from disk
function getOrCreateKeypair(dir, keyName) {
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    const authorityKey = dir + "/" + keyName + ".json";
    if (fs.existsSync(authorityKey)) {
        const data = JSON.parse(fs.readFileSync(authorityKey, "utf-8"));
        const encodedSecretKey = deobfuscateSecretKey(data.secretKey);
        return Keypair.fromSecretKey(bs58.decode(encodedSecretKey));
    }
    else {
        const keypair = Keypair.generate();
        const encodedSecretKey = bs58.encode(keypair.secretKey);
        const keyData = {
            secretKey: obfuscateSecretKey(encodedSecretKey),
            publicKey: keypair.publicKey.toBase58(),
        };
        fs.writeFileSync(authorityKey, JSON.stringify(keyData, null, 2));
        return keypair;
    }
}
// Get SPL balance
async function getSPLBalance(connection, mintAddress, pubKey, allowOffCurve = false) {
    try {
        let ata = getAssociatedTokenAddressSync(mintAddress, pubKey, allowOffCurve);
        const balance = await connection.getTokenAccountBalance(ata, "processed");
        return balance.value.amount;
    }
    catch (e) {
        // ignore errors and return null
    }
    return null;
}
// Conversion functions
function baseToValue(base, decimals) {
    return base * Math.pow(10, decimals);
}
function valueToBase(value, decimals) {
    return value / Math.pow(10, decimals);
}
// Get discriminator from a name (first 8 bytes of SHA-256 hash)
function getDiscriminator(name) {
    return sha256.digest(name).slice(0, 8);
}

module.exports = {
    getOrCreateKeypair,
    getSPLBalance,
    baseToValue,
    valueToBase,
    getDiscriminator,
};
