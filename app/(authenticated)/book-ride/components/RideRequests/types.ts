import { RideRequestStatus } from "@prisma/client";

export interface PublicLocation {
    id: string;
    name: string;
    distanceFromOrg: number;
}

export type PublicRideRequestStatus = RideRequestStatus;

export interface PublicRideRequest {
    id: string;
    status: RideRequestStatus;
    startingLocationId: string | null;
    destinationLocationId: string | null;
    startingTime: Date;
    createdAt: Date;
    userId: string;
    fulfilled: boolean;
    user: {
        name: string | null;
        email: string | null;
    },
    startingLocation: {
        id: string;
        name: string;
    } | null;
    destinationLocation: {
        id: string;
        name: string;
    } | null;
}