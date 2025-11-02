"use server";

import { auth } from "@/lib/auth/auth";
import {
    getRechargeTransactions,
    getWalletByUserId,
    getWalletTransactions,
} from "@/lib/wallet/walletServices";
import { PublicWallet, PublicWalletTransaction } from "./types";

/**
 * Fetch the wallet for the authenticated user
 */
export async function getWallet(): Promise<PublicWallet> {
    const session = await auth();

    if (!session?.user?.id) {
        throw new Error("You must be signed in to view your wallet");
    }

    const wallet = await getWalletByUserId(session.user.id);

    return {
        id: wallet.id,
        spendableBalance: wallet.spendableBalance,
        reservedBalance: wallet.reservedBalance,
        totalBalance: wallet.spendableBalance + wallet.reservedBalance,
    };
}

/**
 * Fetch wallet transactions for the authenticated user
 */
export async function getTransactions({
    page = 1,
    limit = 10,
}: {
    page?: number;
    limit?: number;
}): Promise<{ transactions: PublicWalletTransaction[]; total: number }> {
    const session = await auth();

    if (!session?.user?.id) {
        throw new Error("Not authenticated");
    }

    const { transactions, total } = await getWalletTransactions({
        userId: session.user.id,
        page,
        limit,
    });

    return {
        transactions: transactions.map((txn) => ({
            id: txn.id,
            amount: txn.amount,
            direction: txn.direction,
            purpose: txn.purpose,
            description: txn.description || "",
            createdAt: txn.createdAt,
            rideId: txn.rideId,
            paymentId: txn.transaction?.payment?.id || null,
            externalOrderId: txn.externalOrder?.extOrderId || null,
        })),
        total,
    };
}

/**
 * Fetch recharge-specific wallet transactions for the authenticated user
 */
export async function getWalletRechargeTransactions({
    page = 1,
    limit = 10,
}: {
    page?: number;
    limit?: number;
}): Promise<{ transactions: PublicWalletTransaction[]; total: number }> {
    const session = await auth();

    if (!session?.user?.id) {
        throw new Error("Not authenticated");
    }

    const { transactions, total } = await getRechargeTransactions({
        userId: session.user.id,
        page,
        limit,
    });

    return {
        transactions: transactions.map((txn) => ({
            id: txn.id,
            amount: txn.amount,
            direction: txn.direction,
            purpose: txn.purpose,
            description: txn.description || "",
            createdAt: txn.createdAt,
            rideId: txn.rideId,
            paymentId: txn.transaction?.payment?.id || null,
            externalOrderId: txn.externalOrder?.extOrderId || null,
        })),
        total,
    };
}
