import { NextResponse } from "next/server";
import jwt from "jsonwebtoken"
import logger from "@/config/logger";
import { auth } from "@/lib/auth/auth";
import { carbonPointsToRupees, getConversionRate } from "@/utils/carbonPointsConversion";
import { createExternalOrder, hahasSufficientSpendableBalanceForExternalOrder } from "@/lib/externalOrder/externalOrderServices";
import { OrderStatus } from "@prisma/client";

const MART_SECRET_KEY = process.env.MART_SECRET_KEY;
const MART_SERVER_URL = process.env.MART_SERVER_URL;

export async function POST(req: Request) {
    try {
        // Authentication check
        const session = await auth();
        if (!session?.user?.id || !session?.user?.email) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 500 }
            );
        }

        // Get the order information from request body
        const { carboncoin } = await req.json();

        // Varify param
        if (!carboncoin) {
            return NextResponse.json(
                { error: "Missing carboncoin parameter" },
                { status: 400 }
            );
        }

        // Get the amount
        const amount = carbonPointsToRupees(carboncoin);
        // Get the conversion rate
        const conversionRate = getConversionRate();

        // Check the wallet has sufficient balance or not
        const hasSufficientBalance = hahasSufficientSpendableBalanceForExternalOrder({
            userId: session.user.id,
            amount: carboncoin,
        })

        if ( !hasSufficientBalance ) {
            return NextResponse.json(
                { error: 'Wallet has not sufficient balance' },
                { status: 500 }
            );
        }

        // Varify secret key
        if (!MART_SECRET_KEY) {
            return NextResponse.json(
                { error: 'Unable to generate secret token' },
                { status: 500 }
            );
        }

        // Get user information
        const user = {
            id   : session.user.id,
            email: session.user.email,
            name : session.user.name ?? "",
        };

        // Generate short lived JWT token
        const token = jwt.sign(
            {
                sub: user.id,
                email: user.email,
                name: user.name,
            },
            MART_SECRET_KEY,
            { expiresIn: "60s" }
        );

        // Make request to external API
        const response = await fetch(`${MART_SERVER_URL}/wp-json/shareco2mart/recharge`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                token : token,
                amount: amount,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error(`External API error: ${errorText}`);
            return NextResponse.json(
                { error: "External server error" },
                { status: response.status }
            );
        }

        // Parse the data
        const data = await response.json();

        // Check for error
        if (!data.success) {
            return NextResponse.json(
                { error: data.error },
                { status: 501 }
            );
        }

        // Get the external order id
        const externalOrderId = String(data.orderid);
        const externalUserId  = String(data.userid);

        // Insert external order in database
        const externalOrder = await createExternalOrder({
            userId        : user.id,
            extOrderId    : externalOrderId,
            extUserId     : externalUserId,
            amount        : amount,
            coinAmount    : carboncoin,
            conversionRate: conversionRate,
            status        : OrderStatus.COMPLETED,
        });

        if (!externalOrder) {
            return NextResponse.json(
                { error: 'Unable to create order' },
                { status: 500 }
            );
        }

        // Return the response
        return NextResponse.json(
            { success: true, orderid: externalOrder.id },
            { status: 200 }
        );

    } catch (error) {
        logger.error('GET /api/mart/recharge error:', error);
        return NextResponse.json(
            { error: 'Unable to create recharge' },
            { status: 500 }
        );
    }
}
