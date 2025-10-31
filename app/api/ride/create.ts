import { NextResponse } from "next/server";
import { createRide } from "@/lib/ride/rideServices";
import logger from "@/config/logger";

export default async function handler(request: Request) {
    try {
        const body = await request.json();
        const {
            startingLocationId,
            destinationLocationId,
            startingTime,
            maxPassengers,
            vehicleId,
        } = body;

        // call into your DB logic
        const rideInfo = await createRide({
            userId: "",
            startingLocationId: startingLocationId as string,
            destinationLocationId: destinationLocationId as string,
            startingTime: startingTime as string,
            maxPassengers: Number(maxPassengers),
            vehicleId: vehicleId as string,
        });

        return NextResponse.json(rideInfo, { status: 201 });
    } catch (error) {
        logger.error("Error in /api/rides POST:", error);
        return NextResponse.json(
            {
                success: false,
                error:
                    (error instanceof Error && error.message) ||
                    "Unknown error",
            },
            { status: 500 }
        );
    }
}
