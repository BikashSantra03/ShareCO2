"use server";

import { auth } from "@/lib/auth/auth";
import {
    activateRide,
    getUserRides as getUserRidesDb,
} from "@/lib/ride/rideServices";
import {
    cancleRideBookingByDriverOnPurpose,
    activateRideBooking as activateRideBookingDb,
    cancleRideBookingByUser,
    getUserRideBookings as getUserRideBookingsDb,
    activateRideBookingByChampionService,
} from "@/lib/rideBook/rideBookServices";
import { cancelRide as cancelRideDb } from "@/lib/ride/rideServices";
import { completeRide as completeRideDb } from "@/lib/ride/rideServices";
import { PublicUserRides } from "./types";

import { getWalletByUserId } from "@/lib/wallet/walletServices";
import { getUserById } from "@/lib/user/userServices";

/**
 * Get created rides
 */
export async function getUserRides(): Promise<PublicUserRides[]> {
    const session = await auth();

    if (!session?.user?.id) {
        throw new Error("User not authenticated");
    }

    const userRides = await getUserRidesDb(session.user.id);

    return userRides;
}

/**
 * Get user ride bookings
 */
export async function getUserRideBookings() {
    const session = await auth();

    if (!session?.user?.id) {
        throw new Error("User not authenticated");
    }

    const userRides = await getUserRideBookingsDb(session.user.id);

    return userRides;
}

/**
 * Cancel a ride
 */
export async function cancelRide(rideId: string) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            throw new Error("User not authenticated");
        }

        const success = await cancelRideDb({
            userId: session.user.id,
            rideId: rideId,
        });

        return {
            success: success,
            error: null,
        };
    } catch (error) {
        return {
            success: false,
            error: (error as Error).message,
        };
    }
}

/**
 * Start a ride
 */
export async function startRide(rideId: string) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            throw new Error("User not authenticated");
        }

        const success = await activateRide({
            userId: session.user.id,
            rideId: rideId,
        });

        return {
            success: success,
            error: null,
        };
    } catch (error) {
        return {
            success: false,
            error: (error as Error).message,
        };
    }
}

/**
 * Complete a ride
 */
export async function completeRide(rideId: string) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            throw new Error("User not authenticated");
        }

        const response = await completeRideDb({
            userId: session.user.id,
            rideId: rideId,
        });

        return {
            success: response.success,
            championCePoints: response.championCePoints || null,
            error: null,
        };
    } catch (error) {
        return {
            success: false,
            championCePoints: null,
            error: (error as Error).message,
        };
    }
}

/**
 * Cancel a ridebooking by champion
 */
export async function denyRideBooking(bookingId: string) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            throw new Error("User not authenticated");
        }

        const success = await cancleRideBookingByDriverOnPurpose({
            driverId: session.user.id,
            bookingId: bookingId,
        });

        return {
            success: success,
            error: null,
        };
    } catch (error) {
        return {
            success: false,
            error: (error as Error).message,
        };
    }
}

/**
 * Activate a ridebooking by rider
 */
export async function activateRideBooking(bookingId: string) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            throw new Error("User not authenticated");
        }

        const success = await activateRideBookingDb({
            userId: session.user.id,
            bookingId: bookingId,
        });

        return {
            success: success,
            error: null,
        };
    } catch (error) {
        return {
            success: false,
            error: (error as Error).message,
        };
    }
}

/**
 * Activate a ride booking by champion (driver)
 */
export async function activateRideBookingByChampion(bookingId: string) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            throw new Error("User not authenticated");
        }

        const success = await activateRideBookingByChampionService({
            userId: session.user.id,
            bookingId: bookingId,
        });

        return {
            success: success,
            error: null,
        };
    } catch (error) {
        return {
            success: false,
            error: (error as Error).message,
        };
    }
}

/**
 * Cancle a ridebooking by rider
 */
export async function cancleRideBooking(bookingId: string) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            throw new Error("User not authenticated");
        }

        const success = await cancleRideBookingByUser({
            // Changed to 'cancel' (optional)
            userId: session.user.id,
            bookingId: bookingId,
        });

        return {
            success: success,
            error: null,
        };
    } catch (error) {
        return {
            success: false,
            error: (error as Error).message,
        };
    }
}

/**
 * Get the carbon point of the user
 * @returns
 */
export async function getCarbonPoint(): Promise<number> {
    // Get authenticated user
    const session = await auth();

    if (!session?.user?.id) {
        throw new Error("You must be signed in to view your carbon point");
    }

    // Get user's data
    const wallet = await getWalletByUserId(session.user.id);

    //console.log(user)

    return wallet.spendableBalance + wallet.reservedBalance;
}

/**
 * Get user Profile completion Status
 * @returns
 */
export async function getUserProfileStatus() {
    const session = await auth();

    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    try {
        const user = await getUserById(session.user.id);
        return { isProfileCompleted: user.isProfileCompleted };
    } catch (error) {
        console.error("Error fetching user profile status:", error);
        throw new Error("Failed to fetch user profile status");
    }
}
