import { prisma } from "@/config/prisma";
import { OrderStatus } from "@prisma/client";
import { entryOrderPurchase, entryOrderRefund, hasSufficientSpendableBalance } from "@/lib/wallet/walletServices";

/**
 * Check sufficient balsnce for external order
 */
export async function hasSufficientSpendableBalanceForExternalOrder(
    {
        userId,
        amount,
    } : {
        userId: string,
        amount: number,        
    }
) {
    return await prisma.$transaction(async (tx) => {

        // Check for sufficient spandable balance
        const hasSufficientBalance = await hasSufficientSpendableBalance({
            tx,
            userId: userId,
            amount: amount,
        });

        return hasSufficientBalance;
    });
}


/**
 * Create a new external order
 */
export async function createExternalOrder( data: {
    userId         : string;
    extOrderId     : string;
    extUserId      : string;
    amount         : number;
    coinAmount     : number;
    conversionRate : number;
    status         : OrderStatus;
}) {
    return await prisma.$transaction(async (tx) => {

        // Check for sufficient spandable balance
        const hasSufficientBalance = await hasSufficientSpendableBalance({
            tx,
            userId: data.userId,
            amount: data.coinAmount
        });

        if ( !hasSufficientBalance ) {
            throw new Error( 'Wallet has not sufficient balance' );
        }
        
        // Create a new transection entry
        const externalOrder = await tx.externalOrder.create({ data });

        // Debit from wallet for this external order
        await entryOrderPurchase({
            tx,
            userId    : externalOrder.userId,
            extOrderId: externalOrder.id,
            amount    : externalOrder.coinAmount,
        });

        return externalOrder;

    });
}

/**
 * Cancel a existing external order
 */
export async function cancelExternalOrder(orderId: string) {

    // Find the external order
    const externalOrder = await prisma.externalOrder.findUnique({
        where: {id: orderId}
    });

    // Check the external order
    if ( externalOrder == null ) {
        throw new Error( 'External order does not exist.');
    }

    // Check the status
    if ( externalOrder.status != 'PROCESSING' ) {
        throw new Error( 'Unable to cancle the order. Order status is not Processing' );
    }

    // Hnadle cancel order in one transection
    await prisma.$transaction(async (tx) => {
        
        // Update the order status
        await tx.externalOrder.update({
            where: {id: externalOrder.id},
            data: { status: OrderStatus.CANCELLED }
        });

        // Credit from wallet for this external order cancle
        await entryOrderRefund({
            tx,
            userId    : externalOrder.userId,
            extOrderId: externalOrder.id,
            amount    : externalOrder.coinAmount,
        });

    });

    return true;
}

/**
 * Refund a existing external order
 */
export async function refundExternalOrder(orderId: string) {

    // Find the external order
    const externalOrder = await prisma.externalOrder.findUnique({
        where: {id: orderId}
    });

    // Check the external order
    if ( externalOrder == null ) {
        throw new Error( 'External order does not exist.');
    }

    // Check the status
    if ( externalOrder.status != 'PROCESSING' ) {
        throw new Error( 'Unable to refund the order. Order status is not Processing' );
    }

    // Hnadle refund order in one transection
    await prisma.$transaction(async (tx) => {
        
        // Update the order status
        await tx.externalOrder.update({
            where: {id: externalOrder.id},
            data: { status: OrderStatus.REFUNDED }
        });

        // Credit from wallet for this external order cancle
        await entryOrderRefund({
            tx,
            userId    : externalOrder.userId,
            extOrderId: externalOrder.id,
            amount    : externalOrder.coinAmount,
        });

    });

    return true;
}

/**
 * Complete a existing external order
 */
export async function completeExternalOrder(orderId : string) {
    // Find the external order
    const externalOrder = await prisma.externalOrder.findUnique({
        where: {id: orderId}
    });

    // Check the external order
    if ( externalOrder == null ) {
        throw new Error( 'External order does not exist.');
    }

    // Check the status
    if ( externalOrder.status != 'PROCESSING' ) {
        throw new Error( 'Unable to complete the order. Order status is not Processing' );
    }

    await prisma.externalOrder.update({
        where: { id: orderId },
        data: { status: OrderStatus.COMPLETED }
    });

    return true;
}

/**
 * Get a external order by ID
 */
export async function getExternalOrder(id: string) {
    return await prisma.externalOrder.findUnique({
        where: { id },
    });
}