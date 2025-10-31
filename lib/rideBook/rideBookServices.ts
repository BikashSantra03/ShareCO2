import logger from "@/config/logger";
import { prisma } from "@/config/prisma";
import {
    RideBookingStatus,
    RideRequestStatus,
    RideStatus,
    VehicleType,
} from "@prisma/client";
import {
    applyFineChargeRidebooking,
    creditDriverPayout,
    hasSufficientSpendableBalance,
    holdRideCost,
    settleRideCost,
    unholdRideCost,
} from "@/lib/wallet/walletServices";
import { hasPassedNMinutes, isMoreThanNMinutesLeft } from "@/utils/time";
import { sendPushNotification } from "@/services/ably";
import { getProfileImageUrl } from "../aws/aws-s3-utils";

// Book Ride by Rider
export async function bookRide({
    userId,
    rideId,
}: {
    userId: string;
    rideId: string;
}) {
    try {
        // Check if user profile is complete
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { isProfileCompleted: true, name: true },
        });

        if (!user || !user.isProfileCompleted) {
            throw new Error(
                "Please complete your profile before creating a ride request."
            );
        }

        // Check if the ride exists and is available
        const ride = await prisma.ride.findUnique({
            where: { id: rideId },
            include: { bookings: true },
        });

        if (!ride) {
            throw new Error("Ride not found");
        }

        const now = new Date();
        if (ride.status !== RideStatus.Pending || ride.startingTime <= now) {
            throw new Error("Ride is not available for booking");
        }

        // Check confirmed bookings for seat availability
        const confirmedBookings = ride.bookings.filter(
            (booking) => booking.status === RideBookingStatus.Confirmed
        ).length;
        if (confirmedBookings >= ride.maxPassengers) {
            throw new Error("Ride has reached maximum passenger capacity");
        }

        // Check if the user has already booked this ride
        const existingBooking = await prisma.rideBooking.findUnique({
            where: { rideId_userId: { rideId, userId } },
        });

        if (existingBooking) {
            throw new Error("You have already booked this ride");
        }

        // Check if user has any active ride
        const activeBookings = await prisma.rideBooking.findMany({
            where: {
                userId,
                status: {
                    in: [RideBookingStatus.Confirmed, RideBookingStatus.Active],
                },
                ride: {
                    status: RideStatus.Active,
                },
            },
        });

        if (activeBookings.length > 0) {
            throw new Error(
                "You have an active ride. Please complete it before booking a new one."
            );
        }

        // Create booking inside transaction
        await prisma.$transaction(async (tx) => {
            // Recheck ride availability inside transaction
            const currentRide = await tx.ride.findUnique({
                where: { id: rideId },
                include: {
                    bookings: {
                        where: {
                            status: {
                                in: [
                                    RideBookingStatus.Confirmed,
                                    RideBookingStatus.Active,
                                ],
                            },
                        },
                    },
                    vehicle: true,
                },
            });

            // console.log("currentride", currentRide);

            if (!currentRide) {
                throw new Error("Ride not found");
            }

            if (currentRide.bookings.length >= currentRide.maxPassengers) {
                throw new Error("Ride has reached maximum passenger capacity");
            }

            const amount =
                currentRide.vehicle?.type === VehicleType.Wheeler2
                    ? Number(process.env.NEXT_PUBLIC_CARBON_COST_TWO_WHEELER)
                    : Number(process.env.NEXT_PUBLIC_CARBON_COST_FOUR_WHEELER);

            if (
                !(await hasSufficientSpendableBalance({ tx, userId, amount }))
            ) {
                throw new Error("Wallet has not sufficient spendable balance");
            }

            // Create the booking
            const rideBook = await tx.rideBooking.create({
                data: {
                    rideId,
                    userId,
                    status: RideBookingStatus.Confirmed,
                    carbonCost: amount,
                },
            });

            // Hold cost
            await holdRideCost({
                tx,
                userId,
                rideId: rideBook.rideId,
                rideBookId: rideBook.id,
                amount,
            });

            // Send notification to the driver after successful booking
            await sendPushNotification({
                userId: currentRide.driverId, // Use driverId from currentRide
                title: "Ride Booked Successfully!",
                body: `${
                    user.name || "A passenger"
                } has booked your ride. Get ready for the journey!`,
                eventName: "booking_confirmation",
                redirectUrl: "/dashboard?tab=created",
            });

            // Fulfill matching pending ride requests
            if (
                currentRide.startingLocationId &&
                currentRide.destinationLocationId
            ) {
                const timeWindowMinutes =
                    Number(
                        process.env.NEXT_PUBLIC_RIDE_REQUEST_TIME_WINDOW_MINUTES
                    ) || 60; // Default to 60 minutes if not set
                const timeWindowMs = timeWindowMinutes * 60 * 1000; // Convert to milliseconds
                const startTimeMin = new Date(
                    currentRide.startingTime.getTime() - timeWindowMs / 2
                );
                const startTimeMax = new Date(
                    currentRide.startingTime.getTime() + timeWindowMs / 2
                );

                await tx.rideRequest.updateMany({
                    where: {
                        userId,
                        status: RideRequestStatus.Pending,
                        startingLocationId: currentRide.startingLocationId,
                        destinationLocationId:
                            currentRide.destinationLocationId,
                        startingTime: {
                            gte: startTimeMin,
                            lte: startTimeMax,
                        },
                    },
                    data: {
                        status: RideRequestStatus.Fulfilled,
                    },
                });
            }
        });

        return true;
    } catch (error) {
        logger.error(`Error booking ride: ${error}`);
        throw error;
    }
}

/**
 * Activate( Start ) the ride booking by user
 */
export async function activateRideBooking({
    userId,
    bookingId,
}: {
    userId: string;
    bookingId: string;
}) {
    // Find the booking and verify the driver is the ride owner
    const booking = await prisma.rideBooking.findUnique({
        where: { id: bookingId },
        include: { ride: true, user: true },
    });

    if (!booking) {
        throw new Error("Booking not found");
    }

    if (booking.userId !== userId) {
        throw new Error("Not authorized to manage this booking");
    }

    if (booking.status != RideBookingStatus.Confirmed) {
        throw new Error("RideBooking is not in Confirmed state for activate");
    }

    await prisma.rideBooking.update({
        where: { id: bookingId },
        data: { status: RideBookingStatus.Active },
    });

    // Send notification to the driver (champion)
    await sendPushNotification({
        userId: booking.ride.driverId,
        title: "🌟 Rider Arrived!",
        body: `${
            booking.user.name || "Rider"
        } is at the starting point! Time to kick off the journey! 🚀`,
        eventName: "ride_activated",
        redirectUrl: "/dashboard?tab=created",
    });

    return true;
}

/**
 * Activate (Start) the ride booking by champion (driver)
 */
export async function activateRideBookingByChampionService({
    userId,
    bookingId,
}: {
    userId: string;
    bookingId: string;
}) {
    // Find the booking and verify the user is the ride driver
    const booking = await prisma.rideBooking.findUnique({
        where: { id: bookingId },
        include: { ride: true },
    });

    if (!booking) {
        throw new Error("Booking not found");
    }

    if (booking.ride.driverId !== userId) {
        throw new Error("Not authorized to manage this booking");
    }

    if (booking.status !== RideBookingStatus.Confirmed) {
        throw new Error("RideBooking is not in Confirmed state for activation");
    }

    // Check if the ride's start time has passed
    const startTime = booking.ride.startingTime;
    const currentTime = new Date();
    if (currentTime < startTime) {
        throw new Error("Cannot activate booking before the ride start time");
    }

    await prisma.rideBooking.update({
        where: { id: bookingId },
        data: { status: RideBookingStatus.Active },
    });

    return true;
}

/**
 * Complete a ride booking
 */
export async function completeRideBooking({
    driverId,
    bookingId,
}: {
    driverId: string;
    bookingId: string;
}) {
    // Find the booking and verify the driver is the ride owner
    const booking = await prisma.rideBooking.findUnique({
        where: { id: bookingId },
        include: {
            ride: {
                include: {
                    startingLocation: true,
                    destinationLocation: true,
                },
            },
        },
    });

    if (!booking) {
        throw new Error("Booking not found");
    }

    if (booking.ride.driverId !== driverId) {
        throw new Error("Not authorized to manage this booking");
    }

    // Calculate distance for CE Points
    if (!booking.ride.startingLocation || !booking.ride.destinationLocation) {
        throw new Error(
            "Invalid ride: Both starting and destination locations must be defined"
        );
    }
    // Since one location is guaranteed non-organization, select its distanceFromOrg
    const distance = booking.ride.startingLocation.isOrganization
        ? booking.ride.destinationLocation.distanceFromOrg
        : booking.ride.startingLocation.distanceFromOrg;

    // Calculate rider CE Points
    const cePointsPerKm = parseFloat(process.env.CE_POINTS_PER_KM || "125");
    const riderCePoints = parseFloat((cePointsPerKm * distance).toFixed(2));

    await prisma.$transaction(async (tx) => {
        // Settle the ride cost from rider
        await settleRideCost({
            tx,
            userId: booking.userId,
            rideId: booking.rideId,
            rideBookId: booking.id,
            amount: booking.carbonCost,
        });

        // Credit driver payout
        await creditDriverPayout({
            tx,
            userId: driverId,
            rideId: booking.rideId,
            rideBookId: booking.id,
            amount: booking.carbonCost,
        });

        // Update the ride booking status and cePointsEarned
        await tx.rideBooking.update({
            where: { id: bookingId },
            data: {
                status: RideBookingStatus.Completed,
                cePointsEarned: riderCePoints,
            },
        });

        // Increment rider's cumulative cePoints
        await tx.user.update({
            where: { id: booking.userId },
            data: { cePoints: { increment: riderCePoints } },
        });
    });

    return true;
}

/**
 * Cancle ride booking by driver on purpose
 */
export async function cancleRideBookingByDriverOnPurpose({
    driverId,
    bookingId,
}: {
    driverId: string;
    bookingId: string;
}) {
    // Find the booking and verify the driver is the ride owner
    const booking = await prisma.rideBooking.findUnique({
        where: { id: bookingId },
        include: { ride: true },
    });

    if (!booking) {
        throw new Error("Booking not found");
    }

    if (booking.ride.driverId !== driverId) {
        throw new Error("Not authorized to manage this booking");
    }

    await prisma.$transaction(async (tx) => {
        // Check ride booking is getting cancled before ride threshold time
        const rideThresHoldMinuts = Number(
            process.env.NEXT_PUBLIC_RIDE_THRESHOLD_TIME
        );
        if (
            !isMoreThanNMinutesLeft(
                booking.ride.startingTime,
                rideThresHoldMinuts
            )
        ) {
            // Charge fine for late cancellation to champion
            const rideCancellationCharge = Number(
                process.env.NEXT_PUBLIC_RIDE_CANCELLATION_CHARGE_CHAMPION
            );

            await applyFineChargeRidebooking({
                tx,
                userId: driverId,
                rideId: booking.rideId,
                rideBookId: booking.id,
                amount: rideCancellationCharge,
            });
        }

        // Unhold the amount from walet
        await unholdRideCost({
            tx,
            userId: booking.userId,
            rideId: booking.rideId,
            rideBookId: booking.id,
            amount: booking.carbonCost,
        });

        // Update the ride booking status
        await tx.rideBooking.update({
            where: { id: bookingId },
            data: { status: RideBookingStatus.CancelledDriver },
        });
    });

    return true;
}

/**
 * Cancle ride booking by driver on un reach
 */
export async function cancleRideBookingByDriverOnUnreach({
    driverId,
    bookingId,
}: {
    driverId: string;
    bookingId: string;
}) {
    // Find the booking and verify the driver is the ride owner
    const booking = await prisma.rideBooking.findUnique({
        where: { id: bookingId },
        include: { ride: true },
    });

    if (!booking) {
        throw new Error("Booking not found");
    }

    if (booking.ride.driverId !== driverId) {
        throw new Error("Not authorized to manage this booking");
    }

    await prisma.$transaction(async (tx) => {
        // Check ride starting time is passed the threshold waiting time
        const rideThresHoldWatingMinuts = Number(
            process.env.NEXT_PUBLIC_RIDE_THRESHOLD_WATING_TIME
        );

        if (
            !hasPassedNMinutes(
                booking.ride.startingTime,
                rideThresHoldWatingMinuts
            )
        ) {
            throw new Error(
                "Unable to cancell due to sufficient cancellation time left"
            );
        } else {
            // Unlock the rider's ride booking amount
            await unholdRideCost({
                tx,
                rideBookId: booking.id,
                rideId: booking.rideId,
                userId: booking.userId,
                amount: booking.carbonCost,
            });

            // Charge fine the user for unreach the ride
            const rideCancellationCharge = Number(
                process.env.NEXT_PUBLIC_RIDE_CANCELLATION_CHARGE_RIDER
            );

            await applyFineChargeRidebooking({
                tx,
                userId: driverId,
                rideId: booking.rideId,
                rideBookId: booking.id,
                amount: rideCancellationCharge,
            });
        }

        // Update the ride booking status
        await tx.rideBooking.update({
            where: { id: bookingId },
            data: { status: RideBookingStatus.CancelledDriver },
        });
    });

    return true;
}

/**
 * Cancle the ride booking by driver
 */
export async function cancleRideBookingByDriverOnRideCancle({
    driverId,
    bookingId,
}: {
    driverId: string;
    bookingId: string;
}) {
    // Find the booking and verify the driver is the ride owner
    const booking = await prisma.rideBooking.findUnique({
        where: { id: bookingId },
        include: { ride: true },
    });

    if (!booking) {
        throw new Error("Booking not found");
    }

    if (booking.ride.driverId !== driverId) {
        throw new Error("Not authorized to manage this booking");
    }

    await prisma.$transaction(async (tx) => {
        // Unhold the amount from walet

        await unholdRideCost({
            tx,
            userId: booking.userId,
            rideId: booking.rideId,
            rideBookId: booking.id,
            amount: booking.carbonCost,
        });

        // Update the ridebooking status
        await tx.rideBooking.update({
            where: { id: bookingId },
            data: { status: RideBookingStatus.CancelledDriver },
        });
    });

    return true;
}

/**
 * cancel the ride booking by user
 */
export async function cancleRideBookingByUser({
    userId,
    bookingId,
}: {
    userId: string;
    bookingId: string;
}) {
    // Find the booking and verify the driver is the ride owner
    const booking = await prisma.rideBooking.findUnique({
        where: { id: bookingId, userId: userId },
        include: { ride: true, user: true },
    });

    if (!booking) {
        throw new Error("Booking not found");
    }

    await prisma.$transaction(async (tx) => {
        // Unhold the amount from walet
        await unholdRideCost({
            tx,
            userId: booking.userId,
            rideId: booking.rideId,
            rideBookId: booking.id,
            amount: booking.carbonCost,
        });

        // Check ride booking is getting cancled before ride threshold time
        const rideThresHoldMinuts = Number(
            process.env.NEXT_PUBLIC_RIDE_THRESHOLD_TIME
        );
        if (
            !isMoreThanNMinutesLeft(
                booking.ride.startingTime,
                rideThresHoldMinuts
            )
        ) {
            // Charge fine for late cancellation to rider
            const rideCancellationCharge = Number(
                process.env.NEXT_PUBLIC_RIDE_CANCELLATION_CHARGE_RIDER
            );

            await applyFineChargeRidebooking({
                tx,
                userId: booking.userId,
                rideId: booking.rideId,
                rideBookId: booking.id,
                amount: rideCancellationCharge,
            });
        }

        // Update the ridebooking status
        await tx.rideBooking.update({
            where: { id: bookingId },
            data: { status: RideBookingStatus.CancelledUser },
        });
    });

    // Send notification to the driver (champion)
    await sendPushNotification({
        userId: booking.ride.driverId,
        title: "🚗 Booking Cancelled",
        body: `${
            booking.user.name || "A rider"
        } has cancelled their booking. Check your ride details! 🌟`,
        eventName: "booking_cancelled",
        redirectUrl: "/dashboard?tab=created",
    });

    return true;
}

/**
 * Get all ride bookings of a user from the database
 */
export async function getUserRideBookings(userId: string, limit: number = 20) {
    try {
        const rideBookings = await prisma.rideBooking.findMany({
            where: { userId: userId },
            select: {
                id: true,
                status: true,
                userId: true,
                cePointsEarned: true,
                ride: {
                    select: {
                        id: true,
                        status: true,
                        startingTime: true,
                        driverId: true, // Added to use in driver update
                        startingLocation: {
                            select: { id: true, name: true },
                        },
                        destinationLocation: {
                            select: { id: true, name: true },
                        },
                        driver: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                phone: true,
                                imageKey: true,
                                imageUrl: true,
                                imageUrlExpiresAt: true,
                            },
                        },
                        vehicle: {
                            select: {
                                id: true,
                                vehicleNumber: true,
                                model: true,
                                type: true,
                            },
                        },
                        bookings: {
                            select: {
                                id: true,
                                user: {
                                    select: {
                                        id: true,
                                        name: true,
                                        email: true,
                                        phone: true,
                                        imageKey: true,
                                        imageUrl: true,
                                        imageUrlExpiresAt: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        });

        // Map ride bookings to include pre-signed image URLs for driver and users in bookings
        const rideBookingsWithImageUrls = await Promise.all(
            rideBookings.map(async (booking) => {
                // Handle driver image URL
                let driverImageUrl: string | null = null;
                if (booking.ride.driver.imageKey) {
                    const now = new Date();
                    // Check if stored driver URL is valid and not expired
                    if (
                        booking.ride.driver.imageUrl &&
                        booking.ride.driver.imageUrlExpiresAt &&
                        now < booking.ride.driver.imageUrlExpiresAt
                    ) {
                        driverImageUrl = booking.ride.driver.imageUrl;
                    } else {
                        // Generate new pre-signed URL for driver if expired or missing
                        driverImageUrl = await getProfileImageUrl(
                            booking.ride.driver.imageKey
                        );
                        const imageUrlExpiresAt = new Date(
                            Date.now() + 604800 * 1000
                        );
                        // Update driver's record with new URL and expiration
                        await prisma.user.update({
                            where: { id: booking.ride.driverId },
                            data: {
                                imageUrl: driverImageUrl,
                                imageUrlExpiresAt,
                            },
                        });
                    }
                }

                // Handle user image URLs in bookings
                const bookingsWithImageUrls = await Promise.all(
                    booking.ride.bookings.map(async (rideBooking) => {
                        let userImageUrl: string | null = null;
                        if (rideBooking.user.imageKey) {
                            const now = new Date();
                            // Check if stored user URL is valid and not expired
                            if (
                                rideBooking.user.imageUrl &&
                                rideBooking.user.imageUrlExpiresAt &&
                                now < rideBooking.user.imageUrlExpiresAt
                            ) {
                                userImageUrl = rideBooking.user.imageUrl;
                            } else {
                                // Generate new pre-signed URL for user if expired or missing
                                userImageUrl = await getProfileImageUrl(
                                    rideBooking.user.imageKey
                                );
                                const imageUrlExpiresAt = new Date(
                                    Date.now() + 604800 * 1000
                                );
                                // Update user's record with new URL and expiration
                                await prisma.user.update({
                                    where: { id: rideBooking.user.id },
                                    data: {
                                        imageUrl: userImageUrl,
                                        imageUrlExpiresAt,
                                    },
                                });
                            }
                        }

                        return {
                            ...rideBooking,
                            user: {
                                ...rideBooking.user,
                                imageUrl: userImageUrl,
                            },
                        };
                    })
                );

                return {
                    ...booking,
                    ride: {
                        ...booking.ride,
                        driver: {
                            ...booking.ride.driver,
                            imageUrl: driverImageUrl,
                        },
                        bookings: bookingsWithImageUrls,
                    },
                };
            })
        );

        return rideBookingsWithImageUrls;
    } catch (error) {
        logger.error(`Error on fetching user ride bookings: ${error}`);
        throw error;
    }
}
