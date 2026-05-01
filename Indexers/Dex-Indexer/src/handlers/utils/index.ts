import { BigDecimal, handlerContext, Transaction } from "generated";
import { ZERO_BD, ONE_BD, ZERO_BI } from "./constants";

export function isAddressInList(address: string, list: string[]): boolean {
    const lower = address.toLowerCase();
    return list.some(item => lower === item.toLowerCase());
}

export function exponentToBigDecimal(decimals: bigint): BigDecimal {
    let s = "1";
    for (let i = 0n; i < decimals; i++) s += "0";
    return new BigDecimal(s);
}

export function safeDiv(a: BigDecimal, b: BigDecimal): BigDecimal {
    return b.eq(ZERO_BD) ? ZERO_BD : a.div(b);
}

export function fastExponentiation(value: BigDecimal, power: bigint): BigDecimal {
    const res = parseFloat(value.toString()) ** parseInt(power.toString());
    return new BigDecimal(res.toString());
}

export function convertTokenToDecimal(amount: bigint, decimals: bigint): BigDecimal {
    const val = new BigDecimal(amount.toString());
    // No .dp() truncation — rounding to 4dp was silently zeroing tiny amounts
    return decimals === ZERO_BI ? val : val.div(exponentToBigDecimal(decimals));
}

export async function loadTransaction(
    txHash: string,
    blockNumber: number,
    timestamp: number,
    gasPrice: bigint,
    from: string,
    to: string,
    context: handlerContext
): Promise<Transaction> {
    const existing = await context.Transaction.get(txHash);
    const tx = existing ? { ...existing } : {
        id: txHash,
        blockNumber: 0,
        timestamp: 0,
        gasUsed: ZERO_BI,
        gasPrice: ZERO_BI,
        from: "",
        to: "",
    };
    tx.blockNumber = blockNumber;
    tx.timestamp = timestamp;
    tx.gasPrice = gasPrice;
    tx.gasUsed = ZERO_BI; // move to receipt when available
    tx.from = from.toLowerCase();
    tx.to = to.toLowerCase();
    context.Transaction.set(tx as Transaction);
    return tx as Transaction;
}
