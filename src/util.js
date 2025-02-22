const {
    ComputeBudgetProgram,
    Transaction,
    TransactionMessage,
    VersionedTransaction
} = require("@solana/web3.js");

const DEFAULT_COMMITMENT = "processed";

const calculateWithSlippageBuy = (amount, basisPoints) => {
    return amount + (amount * basisPoints) / 10000n;
};

const calculateWithSlippageSell = (amount, basisPoints) => {
    return amount - (amount * basisPoints) / 10000n;
};

async function signTx(connection, tx, payer, signers, priorityFees, commitment = DEFAULT_COMMITMENT) {
    let newTx = new Transaction();

    if (priorityFees) {
        const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
            units: priorityFees.unitLimit,
        });
        const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: priorityFees.unitPrice,
        });
        newTx.add(modifyComputeUnits);
        newTx.add(addPriorityFee);
    }

    newTx.add(tx);
    let versionedTx = await buildVersionedTx(connection, payer, newTx, commitment);
    versionedTx.sign(signers);
    return {
        success: true,
        error: "Transaction signed",
        result: versionedTx,
    };
}

async function sendTx(connection, transaction) {
    try {
        const sig = await connection.sendTransaction(transaction, {
            skipPreflight: true,
        });
        return sig;
    } catch (e) {
        console.error("Error sending transaction:", e);
        return null;
    }
}

const buildVersionedTx = async (connection, payer, tx, commitment = DEFAULT_COMMITMENT) => {
    const blockHash = (await connection.getLatestBlockhash(commitment)).blockhash;
    let messageV0 = new TransactionMessage({
        payerKey: payer,
        recentBlockhash: blockHash,
        instructions: tx.instructions,
    }).compileToV0Message();
    return new VersionedTransaction(messageV0);
};

// Export functions and constants using CommonJS
module.exports = {
    DEFAULT_COMMITMENT,
    calculateWithSlippageBuy,
    calculateWithSlippageSell,
    signTx,
    sendTx,
    buildVersionedTx
};
