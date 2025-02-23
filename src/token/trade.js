const dotenv = require("dotenv");
const fs = require("fs");
const { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction } = require("@solana/web3.js");
const { DEFAULT_DECIMALS, PumpFunSDK } = require("../../src");
const NodeWallet = require("@coral-xyz/anchor/dist/cjs/nodewallet").default;
const { AnchorProvider } = require("@coral-xyz/anchor");
const { getOrCreateKeypair, getSPLBalance } = require("./util");
const { signTx, sendTx } = require("../util");
const { searcherClient } = require("jito-ts/dist/sdk/block-engine/searcher");
const { Bundle: JitoBundle } = require("jito-ts/dist/sdk/block-engine/types.js");
const { getAssociatedTokenAddressSync } = require("@solana/spl-token");
const { Raydium, liquidityStateV4Layout } = require("@raydium-io/raydium-sdk-v2");
const BN = require('bn.js');

dotenv.config();

let KEYS_FOLDER, RPC_URL, TRADE_ACCOUNT;

if (process.env.PRODUCTION === "mainnet") {
    KEYS_FOLDER = __dirname + "/.keys";
    RPC_URL = process.env.MAINNET_RPC_URL || "https://api.mainnet-beta.solana.com";
    TRADE_ACCOUNT = process.env.TRADE_ACCOUNT || "trade-account-1";
}
else {
    KEYS_FOLDER = __dirname + "/.devkeys";
    RPC_URL = "https://api.devnet.solana.com";
    TRADE_ACCOUNT = process.env.TRADE_ACCOUNT || "trade-account-1";
}

const SLIPPAGE_BASIS_POINTS = 1000n;
const jitoSearcherClient = searcherClient(process.env.JITO_BLOCK_ENGINE_URL || "mainnet.block-engine.jito.wtf");

async function sendBundle(bundledTxns) {
    let results = "";
    try {
        if (process.env.PRODUCTION === "mainnet") {
            const response = await jitoSearcherClient.sendBundle(new JitoBundle(bundledTxns, bundledTxns.length));
            results += 'Bundle sent successfully:' + response + '<br>';
        }
        else {
            let connection = new Connection(RPC_URL);
            for (let i = 0; i < bundledTxns.length; i++) {
                try {
                    sendTx(connection, bundledTxns[i]);
                    results += 'Transaction ' + (i + 1) + ' sent successfully' + '<br>';
                } catch (txnError) {
                    results += 'Error sending transaction ' + (i + 1) + ':' + txnError + '<br>';
                }
            }
        }
    }
    catch (error) {
        results += 'Error sending bundle:' + error + '<br>';
    }
    return results;
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function createToken() {
    let connection = new Connection(RPC_URL);
    let wallet = new NodeWallet(new Keypair()); //note this is not used
    const provider = new AnchorProvider(connection, wallet, {
        commitment: "processed",
    });
    let sdk = new PumpFunSDK(provider);
    const mint = getOrCreateKeypair(KEYS_FOLDER, "mint");
    const creatorAccount = getOrCreateKeypair(KEYS_FOLDER, TRADE_ACCOUNT);
    let boundingCurveAccount = await sdk.isBondingCurveAccountCreated(mint.publicKey);
    let results = "";
    if (!boundingCurveAccount) {
        const bundledTxns = [];
        let tokenMetadata = {
            name: "ELON VINE",
            symbol: "ELONVINE",
            description: "Make America Great Again !! Vine is coming back to life thanks to Elon! Book your spot in advance.",
            twitter: "https://x.com/WatcherGuru/status/1880853494263136745",
            website: "https://x.com/WatcherGuru/status/1880853494263136745",
            file: await fs.openAsBlob(__dirname + "/logo.png"),
        };
        let createResults = await sdk.createAndBuy(creatorAccount, mint, tokenMetadata, BigInt(0.015 * LAMPORTS_PER_SOL), BigInt(0.0001 * LAMPORTS_PER_SOL), SLIPPAGE_BASIS_POINTS, {
            unitLimit: 500000,
            unitPrice: 250000,
        });
        if (createResults.success) {
            results += "Success: " + mint.publicKey.toBase58() + "<br>";
            bundledTxns.push(createResults.result);
        }
        results += await sendBundle(bundledTxns);
    } else {
        results = "Bounding Curve Account Already Created: " + mint.publicKey.toBase58() + "<br>";
    }
    return results;
}

async function buyToken(contractAddress, amount, isBump) {
    let connection = new Connection(RPC_URL);
    let wallet = new NodeWallet(new Keypair()); //note this is not used
    const provider = new AnchorProvider(connection, wallet, {
        commitment: "processed",
    });
    let sdk = new PumpFunSDK(provider);
    const mintPublicKey = new PublicKey(contractAddress);
    let boundingCurveAccount = await sdk.isBondingCurveAccountCreated(mintPublicKey);

    let results = "";
    if (boundingCurveAccount) {
        const bundledTxns = [];
        const tradeAccount = getOrCreateKeypair(KEYS_FOLDER, TRADE_ACCOUNT);
        // Buy in multiples of 4 accounts
        let jitoTip = 0.003;
        if (isBump == "true") {
            jitoTip = 0.003;
        }
        let buyResults = await sdk.buy(tradeAccount, mintPublicKey, BigInt(parseFloat(amount) * LAMPORTS_PER_SOL), isBump, BigInt(jitoTip * LAMPORTS_PER_SOL), SLIPPAGE_BASIS_POINTS, {
            unitLimit: 250000,
            unitPrice: 150000,
        });
        if (buyResults.success) {
            bundledTxns.push(buyResults.result);
            results += await sendBundle(bundledTxns);
        } else {
            results += "Error: Transaction signing error.";
        }
    } else {
        results = "Bounding Curve Account Not Created<br>";
    }
    return results;
}

async function sellAllToken(contractAddress) {
    let connection = new Connection(RPC_URL);
    let wallet = new NodeWallet(new Keypair()); //note this is not used
    const provider = new AnchorProvider(connection, wallet, {
        commitment: "processed",
    });
    let sdk = new PumpFunSDK(provider);
    const mintPublicKey = new PublicKey(contractAddress);
    let boundingCurveAccount = await sdk.isBondingCurveAccountCreated(mintPublicKey);

    let results = "";
    if (boundingCurveAccount) {
        const bundledTxns = [];
        const tradeAccount = getOrCreateKeypair(KEYS_FOLDER, TRADE_ACCOUNT);
        let currentSPLBalance = await getSPLBalance(connection, mintPublicKey, tradeAccount.publicKey);
        if (currentSPLBalance) {
            let jitoTip = 0.003;
            let sellResults = await sdk.sell(tradeAccount, mintPublicKey, BigInt(currentSPLBalance), BigInt(jitoTip * LAMPORTS_PER_SOL), SLIPPAGE_BASIS_POINTS, {
                unitLimit: 250000,
                unitPrice: 250000,
            });
            if (sellResults.success) {
                bundledTxns.push(sellResults.result);
                results += await sendBundle(bundledTxns);
            } else {
                results += "Error: Transaction signing error.";
            }
        } else {
            results = +"Error: Account balance is zero";
        }
    } else {
        results = +"Bounding Curve Account Not Created<br>";
    }
    return results;
}


async function closeTokenAccount(contractAddress) {
    let connection = new Connection(RPC_URL);
    let wallet = new NodeWallet(new Keypair()); //note this is not used
    const provider = new AnchorProvider(connection, wallet, {
        commitment: "processed",
    });
    let sdk = new PumpFunSDK(provider);
    const mintPublicKey = new PublicKey(contractAddress);
    let results = "";
    const tradeAccount = getOrCreateKeypair(KEYS_FOLDER, TRADE_ACCOUNT);
    let tokenAccountPubkey = getAssociatedTokenAddressSync(mintPublicKey, tradeAccount.publicKey, false);
    const balance = await connection.getTokenAccountBalance(tokenAccountPubkey, "processed");
    if (balance.value.uiAmount == 0) {
        results += await sdk.closeTokenAccount(connection, tradeAccount, tokenAccountPubkey);
    } else {
        results += "Error: Non-native account can only be closed if its balance is zero";
    }
    return results;
}

async function sellAllTokenOnRay(contractAddress) {
    try {
        let connection = new Connection(RPC_URL);
        const mintPublicKey = new PublicKey(contractAddress);
        let results = "";
        const tradeAccount = getOrCreateKeypair(KEYS_FOLDER, TRADE_ACCOUNT);
        let currentSPLBalance = await getSPLBalance(connection, mintPublicKey, tradeAccount.publicKey);
        if (currentSPLBalance == 0) {
            results += "Error: Account balance is zero";
            return results;
        }

        // Swap All Available Tokens for SOL
        const swapResult = await _sellAllTokenOnRay(connection, tradeAccount, mintPublicKey, currentSPLBalance);
        return swapResult;
    } catch (error) {
        return "Error swapping tokens:"+ error;
    }
}

async function fetchProgramAccounts(connection, baseMint, quoteMint) {
    const programId = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
    const accounts = await connection.getProgramAccounts(programId, {
        filters: [
            { dataSize: liquidityStateV4Layout.span },
            {
                memcmp: {
                    offset: liquidityStateV4Layout.offsetOf('baseMint'),
                    bytes: baseMint.toBase58(),
                },
            },
            {
                memcmp: {
                    offset: liquidityStateV4Layout.offsetOf('quoteMint'),
                    bytes: quoteMint.toBase58(),
                },
            },
        ],
    });

    return accounts;
}

// Swap Function (Raydium)
async function _sellAllTokenOnRay(connection, account, quoteMint, amount) {
    try {
        const raydium = await Raydium.load({
            connection,
            owner: account,
        });

        if (!raydium) {
            throw new Error("Failed to load Raydium SDK.");
        }

        const baseMint = new PublicKey("So11111111111111111111111111111111111111112"); // SOL

        const programAccounts = await fetchProgramAccounts(connection, baseMint, quoteMint);
        const poolId = programAccounts?.[0]?.pubkey?.toBase58();

        if (!poolId) {
            throw new Error("Pool ID not found.");
        }

        const { poolRpcData, poolInfo, poolKeys } = await raydium.liquidity.getPoolInfoFromRpc({ poolId });
        
        const poolInfoWithExtras = {
            ...poolInfo, // Original pool info
            baseReserve: poolRpcData.baseReserve,
            quoteReserve: poolRpcData.quoteReserve,
            version: 4, // Ensure version is provided
            status: poolRpcData.status,
        };

        const out = raydium.liquidity.computeAmountOut({
            poolInfo: poolInfoWithExtras,
            amountIn: new BN(amount),
            mintIn: quoteMint.toBase58(),
            mintOut: baseMint.toBase58(),
            slippage: 1, // 100% slippage
        });

        const { transaction } = await raydium.liquidity.swap({
            poolInfo,
            poolKeys,
            amountIn: new BN(amount),
            amountOut: out.minAmountOut,
            inputMint: quoteMint.toBase58(),
            fixedSide: "in",
            txVersion: "LEGACY", // Transaction version
        });

        
        let newTx = new Transaction();
        newTx.add(transaction);

        let jitoTip = 0.003;

        const tipIxn = SystemProgram.transfer({
            fromPubkey: account.publicKey,
            toPubkey: new PublicKey("96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5"),
            lamports: BigInt(jitoTip * LAMPORTS_PER_SOL),
        });
        newTx.add(tipIxn);

        let sellResults = await signTx(
            connection,
            newTx,
            account.publicKey,
            [account],
            0,
            "processed"
        );

        const bundledTxns = [];
        let results = "";
        if (sellResults.success) {
            bundledTxns.push(sellResults.result);
            results += await sendBundle(bundledTxns);
        } else {
            results += "Error: Transaction signing error.";
        }
        return results;
    } catch (error) {
        return "Swap failed: " + error;
    }
}

module.exports = { createToken, buyToken, sellAllToken, closeTokenAccount, sellAllTokenOnRay };