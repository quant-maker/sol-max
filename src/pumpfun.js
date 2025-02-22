const {
    PublicKey,
    Transaction,
    SystemProgram,
} = require("@solana/web3.js");
const { Program } = require("@coral-xyz/anchor");
const { GlobalAccount } = require("./globalAccount");
const {
    toCompleteEvent,
    toCreateEvent,
    toSetParamsEvent,
    toTradeEvent,
} = require("./events");
const {
    createAssociatedTokenAccountInstruction,
    getAccount,
    getAssociatedTokenAddress,
    closeAccount,
} = require("@solana/spl-token");
const { BondingCurveAccount } = require("./bondingCurveAccount");
const { BN } = require("bn.js");
const {
    DEFAULT_COMMITMENT,
    calculateWithSlippageBuy,
    calculateWithSlippageSell,
    signTx,
} = require("./util");
const { IDL } = require("./IDL");

const PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const MPL_TOKEN_METADATA_PROGRAM_ID =
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

const GLOBAL_ACCOUNT_SEED = "global";
const MINT_AUTHORITY_SEED = "mint-authority";
const BONDING_CURVE_SEED = "bonding-curve";
const METADATA_SEED = "metadata";
const DEFAULT_DECIMALS = 6;

class PumpFunSDK {
    program;
    connection;
    TIP_ACCOUNTS;
    constructor(provider) {
        this.program = new Program(IDL, provider);
        this.connection = this.program.provider.connection;
        this.TIP_ACCOUNTS = [
            "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
            "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
            "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
            "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
            "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
            "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
            "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
            "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
        ].map((pubkey) => new PublicKey(pubkey));
    }
    getRandomTipAccount() {
        return this.TIP_ACCOUNTS[
            Math.floor(Math.random() * this.TIP_ACCOUNTS.length)
        ];
    }
    async createAndBuy(
        creator,
        mint,
        createTokenMetadata,
        buyAmountSol,
        jitoTip,
        slippageBasisPoints,
        priorityFees,
        commitment = DEFAULT_COMMITMENT
    ) {
        let tokenMetadata = await this.createTokenMetadata(createTokenMetadata);
        let createTx = await this.getCreateInstructions(
            creator.publicKey,
            createTokenMetadata.name,
            createTokenMetadata.symbol,
            tokenMetadata.metadataUri,
            mint
        );
        let newTx = new Transaction().add(createTx);
        if (buyAmountSol > 0) {
            const globalAccount = await this.getGlobalAccount(commitment);
            const buyAmount = globalAccount.getInitialBuyPrice(buyAmountSol);
            const buyAmountWithSlippage = calculateWithSlippageBuy(
                buyAmountSol,
                slippageBasisPoints
            );
            const buyTx = await this.getBuyInstructions(
                creator.publicKey,
                mint.publicKey,
                globalAccount.feeRecipient,
                buyAmount,
                buyAmountWithSlippage
            );
            newTx.add(buyTx);
        }
        const tipIxn = SystemProgram.transfer({
            fromPubkey: creator.publicKey,
            toPubkey: this.getRandomTipAccount(),
            lamports: jitoTip,
        });
        newTx.add(tipIxn);
        let createResults = await signTx(
            this.connection,
            newTx,
            creator.publicKey,
            [creator, mint],
            priorityFees,
            commitment
        );
        return createResults;
    }
    async buy(
        buyer,
        mint,
        buyAmountSol,
        isBump,
        jitoTip,
        slippageBasisPoints,
        priorityFees,
        commitment = DEFAULT_COMMITMENT
    ) {
        let newTx = new Transaction();
        let buyTx = await this.getBuyInstructionsBySolAmount(
            buyer.publicKey,
            mint,
            buyAmountSol,
            isBump,
            slippageBasisPoints,
            commitment
        );
        newTx.add(buyTx);
        const tipIxn = SystemProgram.transfer({
            fromPubkey: buyer.publicKey,
            toPubkey: this.getRandomTipAccount(),
            lamports: jitoTip,
        });
        newTx.add(tipIxn);
        let buyResults = await signTx(
            this.connection,
            newTx,
            buyer.publicKey,
            [buyer],
            priorityFees,
            commitment
        );
        return buyResults;
    }
    async buyMultiple(
        buyers,
        mint,
        buyAmountSol,
        isBump,
        jitoTip,
        slippageBasisPoints,
        priorityFees,
        commitment = DEFAULT_COMMITMENT
    ) {
        let newTx = new Transaction();
        for (const buyer of buyers) {
            let buyTx = await this.getBuyInstructionsBySolAmount(
                buyer.publicKey,
                mint,
                buyAmountSol,
                isBump,
                slippageBasisPoints,
                commitment
            );
            newTx.add(buyTx);
        }
        const tipIxn = SystemProgram.transfer({
            fromPubkey: buyers[0].publicKey,
            toPubkey: this.getRandomTipAccount(),
            lamports: jitoTip,
        });
        newTx.add(tipIxn);
        let buyResults = await signTx(
            this.connection,
            newTx,
            buyers[0].publicKey, // Using the first buyer as the payer
            buyers, // All buyers sign the transaction
            priorityFees,
            commitment
        );
        return buyResults;
    }
    async sell(
        seller,
        mint,
        sellTokenAmount,
        jitoTip,
        slippageBasisPoints,
        priorityFees,
        commitment = DEFAULT_COMMITMENT
    ) {
        let newTx = new Transaction();
        let sellTx = await this.getSellInstructionsByTokenAmount(
            seller.publicKey,
            mint,
            sellTokenAmount,
            slippageBasisPoints,
            commitment
        );
        newTx.add(sellTx);
        const tipIxn = SystemProgram.transfer({
            fromPubkey: seller.publicKey,
            toPubkey: this.getRandomTipAccount(),
            lamports: jitoTip,
        });
        newTx.add(tipIxn);
        let sellResults = await signTx(
            this.connection,
            newTx,
            seller.publicKey,
            [seller],
            priorityFees,
            commitment
        );
        return sellResults;
    }
    async sellMultiple(
        sellers,
        mint,
        jitoTip,
        slippageBasisPoints,
        priorityFees,
        commitment = DEFAULT_COMMITMENT
    ) {
        let newTx = new Transaction();
        for (const seller of sellers) {
            let sellTx = await this.getSellInstructionsByTokenAmount(
                seller.keypair.publicKey,
                mint,
                seller.sellTokenAmount,
                slippageBasisPoints,
                commitment
            );
            newTx.add(sellTx);
        }
        const tipIxn = SystemProgram.transfer({
            fromPubkey: sellers[0].keypair.publicKey,
            toPubkey: this.getRandomTipAccount(),
            lamports: jitoTip,
        });
        newTx.add(tipIxn);
        let sellResults = await signTx(
            this.connection,
            newTx,
            sellers[0].keypair.publicKey, // Using the first buyer as the payer
            sellers.map((s) => s.keypair), // All buyers sign the transaction
            priorityFees,
            commitment
        );
        return sellResults;
    }
    async closeTokenAccount(
        connection,
        owner,
        tokenAccountPubkey
    ) {
        let closeResult = "";
        try {
            closeResult = await closeAccount(
                connection,
                owner, // payer
                tokenAccountPubkey, // token account to close
                owner.publicKey, // destination for remaining funds
                owner // authority
            );
            closeResult = "Sig: " + closeResult;
        } catch (error) {
            closeResult = `Error closing token account: ${error.message}`;
        }
        return closeResult;
    }

    //create token instructions
    async getCreateInstructions(creator, name, symbol, uri, mint) {
        const mplTokenMetadata = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID);
        const [metadataPDA] = PublicKey.findProgramAddressSync(
            [
                Buffer.from(METADATA_SEED),
                mplTokenMetadata.toBuffer(),
                mint.publicKey.toBuffer(),
            ],
            mplTokenMetadata
        );
        const associatedBondingCurve = await getAssociatedTokenAddress(
            mint.publicKey,
            this.getBondingCurvePDA(mint.publicKey),
            true
        );
        return this.program.methods
            .create(name, symbol, uri)
            .accounts({
                mint: mint.publicKey,
                associatedBondingCurve: associatedBondingCurve,
                metadata: metadataPDA,
                user: creator,
            })
            .signers([mint])
            .transaction();
    }

    async getBuyInstructionsBySolAmountWBC(
        buyer,
        mint,
        buyAmountSol,
        slippageBasisPoints,
        commitment = DEFAULT_COMMITMENT
    ) {
        let globalAccount = await this.getGlobalAccount(commitment);
        let buyAmount = globalAccount.getInitialBuyPrice(buyAmountSol);
        let buyAmountWithSlippage = calculateWithSlippageBuy(
            buyAmountSol,
            slippageBasisPoints
        );
        return await this.getBuyInstructions(
            buyer,
            mint,
            globalAccount.feeRecipient,
            buyAmount,
            buyAmountWithSlippage
        );
    }

    async getBuyInstructionsBySolAmount(
        buyer,
        mint,
        buyAmountSol,
        isBump,
        slippageBasisPoints,
        commitment = DEFAULT_COMMITMENT
    ) {
        let bondingCurveAccount = await this.getBondingCurveAccount(
            mint,
            commitment
        );
        if (!bondingCurveAccount) {
            throw new Error(`Bonding curve account not found: ${mint.toBase58()}`);
        }

        let buyAmount = bondingCurveAccount.getBuyPrice(buyAmountSol, isBump);

        let buyAmountWithSlippage = calculateWithSlippageBuy(
            buyAmountSol,
            slippageBasisPoints * 10n
        );

        let globalAccount = await this.getGlobalAccount(commitment);
        return await this.getBuyInstructions(
            buyer,
            mint,
            globalAccount.feeRecipient,
            buyAmount,
            buyAmountWithSlippage
        );
    }
    //buy
    async getBuyInstructions(
        buyer,
        mint,
        feeRecipient,
        amount,
        solAmount,
        commitment = DEFAULT_COMMITMENT
    ) {
        const associatedBondingCurve = await getAssociatedTokenAddress(
            mint,
            this.getBondingCurvePDA(mint),
            true
        );
        const associatedUser = await getAssociatedTokenAddress(mint, buyer, false);
        let transaction = new Transaction();
        try {
            await getAccount(this.connection, associatedUser, commitment);
        } catch (e) {
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    buyer,
                    associatedUser,
                    buyer,
                    mint
                )
            );
        }
        transaction.add(
            await this.program.methods
                .buy(new BN(amount.toString()), new BN(solAmount.toString()))
                .accounts({
                    feeRecipient: feeRecipient,
                    mint: mint,
                    associatedBondingCurve: associatedBondingCurve,
                    associatedUser: associatedUser,
                    user: buyer,
                })
                .transaction()
        );
        return transaction;
    }

    //sell
    async getSellInstructionsByTokenAmount(
        seller,
        mint,
        sellTokenAmount,
        slippageBasisPoints,
        commitment = DEFAULT_COMMITMENT
    ) {
        let bondingCurveAccount = await this.getBondingCurveAccount(
            mint,
            commitment
        );
        if (!bondingCurveAccount) {
            throw new Error(`Bonding curve account not found: ${mint.toBase58()}`);
        }
        let globalAccount = await this.getGlobalAccount(commitment);
        let minSolOutput = bondingCurveAccount.getSellPrice(
            sellTokenAmount,
            globalAccount.feeBasisPoints
        );
        let sellAmountWithSlippage = calculateWithSlippageSell(
            minSolOutput,
            slippageBasisPoints * 10n
        );
        console.log("sellTokenAmount", sellTokenAmount);
        console.log("minSolOutput", minSolOutput);
        console.log("sellAmountWithSlippage", sellAmountWithSlippage);
        return await this.getSellInstructions(
            seller,
            mint,
            globalAccount.feeRecipient,
            sellTokenAmount,
            sellAmountWithSlippage
        );
    }
    async getSellInstructions(seller, mint, feeRecipient, amount, minSolOutput) {
        const associatedBondingCurve = await getAssociatedTokenAddress(
            mint,
            this.getBondingCurvePDA(mint),
            true
        );
        const associatedUser = await getAssociatedTokenAddress(mint, seller, false);
        let transaction = new Transaction();
        transaction.add(
            await this.program.methods
                .sell(new BN(amount.toString()), new BN(minSolOutput.toString()))
                .accounts({
                    feeRecipient: feeRecipient,
                    mint: mint,
                    associatedBondingCurve: associatedBondingCurve,
                    associatedUser: associatedUser,
                    user: seller,
                })
                .transaction()
        );
        return transaction;
    }
    async getBondingCurveAccount(mint, commitment = DEFAULT_COMMITMENT) {
        const tokenAccount = await this.connection.getAccountInfo(
            this.getBondingCurvePDA(mint),
            commitment
        );
        if (!tokenAccount) {
            return null;
        }
        return BondingCurveAccount.fromBuffer(tokenAccount.data);
    }
    async isBondingCurveAccountCreated(mint, commitment = DEFAULT_COMMITMENT) {
        const tokenAccount = await this.connection.getAccountInfo(mint, commitment);
        if (!tokenAccount) {
            return null;
        }
        return true;
    }
    async getGlobalAccount(commitment = DEFAULT_COMMITMENT) {
        const [globalAccountPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from(GLOBAL_ACCOUNT_SEED)],
            new PublicKey(PROGRAM_ID)
        );
        const tokenAccount = await this.connection.getAccountInfo(
            globalAccountPDA,
            commitment
        );
        return GlobalAccount.fromBuffer(tokenAccount.data);
    }
    getBondingCurvePDA(mint) {
        return PublicKey.findProgramAddressSync(
            [Buffer.from(BONDING_CURVE_SEED), mint.toBuffer()],
            this.program.programId
        )[0];
    }
    async createTokenMetadata(create) {
        // Validate file
        if (!(create.file instanceof Blob)) {
            throw new Error("File must be a Blob or File object");
        }
        let formData = new FormData();
        formData.append("file", create.file, "image.png"); // Add filename
        formData.append("name", create.name);
        formData.append("symbol", create.symbol);
        formData.append("description", create.description);
        formData.append("twitter", create.twitter || "");
        formData.append("telegram", create.telegram || "");
        formData.append("website", create.website || "");
        formData.append("showName", "true");
        try {
            const request = await fetch("https://pump.fun/api/ipfs", {
                method: "POST",
                headers: {
                    Accept: "application/json",
                },
                body: formData,
                credentials: "same-origin",
            });
            if (request.status === 500) {
                // Try to get more error details
                const errorText = await request.text();
                throw new Error(
                    `Server error (500): ${errorText || "No error details available"}`
                );
            }
            if (!request.ok) {
                throw new Error(`HTTP error! status: ${request.status}`);
            }
            const responseText = await request.text();
            if (!responseText) {
                throw new Error("Empty response received from server");
            }
            try {
                return JSON.parse(responseText);
            } catch (e) {
                throw new Error(`Invalid JSON response: ${responseText}`);
            }
        } catch (error) {
            console.error("Error in createTokenMetadata:", error);
            throw error;
        }
    }
    //EVENTS
    addEventListener(eventType, callback) {
        return this.program.addEventListener(
            eventType,
            (event, slot, signature) => {
                let processedEvent;
                switch (eventType) {
                    case "createEvent":
                        processedEvent = toCreateEvent(event);
                        callback(processedEvent, slot, signature);
                        break;
                    case "tradeEvent":
                        processedEvent = toTradeEvent(event);
                        callback(processedEvent, slot, signature);
                        break;
                    case "completeEvent":
                        processedEvent = toCompleteEvent(event);
                        callback(processedEvent, slot, signature);
                        console.log("completeEvent", event, slot, signature);
                        break;
                    case "setParamsEvent":
                        processedEvent = toSetParamsEvent(event);
                        callback(processedEvent, slot, signature);
                        break;
                    default:
                        console.error("Unhandled event type:", eventType);
                }
            }
        );
    }
    removeEventListener(eventId) {
        this.program.removeEventListener(eventId);
    }
}

module.exports = {
    PumpFunSDK,
    GLOBAL_ACCOUNT_SEED,
    MINT_AUTHORITY_SEED,
    BONDING_CURVE_SEED,
    METADATA_SEED,
    DEFAULT_DECIMALS,
};
