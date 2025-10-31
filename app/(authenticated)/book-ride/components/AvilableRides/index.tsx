import React, { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  Car,
  Clock,
  Coins,
  MapPin,
  Phone,
  User,
  Users,
} from "lucide-react";
import { bookRide, getAvialableRides } from "./actions";
import { PublicAvialableRides } from "./types";
import { utcIsoToLocalTime12 } from "@/utils/time";
import { useRouter } from "next/navigation";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { UserImageModal } from "@/app/_components/modals/UserImageModal";

const AvailableRides = ({
  onSuccess,
  onError,
}: {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}) => {
  const router = useRouter();
  // State to track pending status for each ride
  const [pendingRides, setPendingRides] = useState<{ [key: string]: boolean }>({});
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedUserImage, setSelectedUserImage] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string>("");

  // Hook for fetching available rides
  const {
    data: availableRides = [],
    isLoading: isAvailableRidesFetching,
    isError: isAvailableRidesFetchingError,
    error: AaailableRidesFetchingError,
    refetch: refechAvailableRides,
    isRefetching: isAvailableRidesRefetching,
    isRefetchError: isAvailableRidesRefetchingError,
  } = useQuery({
    queryKey: ["avilableRides"],
    queryFn: getAvialableRides,
  });

  if (isAvailableRidesFetchingError || isAvailableRidesRefetchingError) {
    console.error(AaailableRidesFetchingError);
  }

  // Hook for booking rides
  const mutation = useMutation({
    mutationFn: (rideId: string) => bookRide(rideId),
    onSuccess: async (result, rideId) => {
      if (result.success) {
        toast.success("Ride booked and confirmed successfully");
        onSuccess?.("Ride booked and confirmed successfully");
        setPendingRides((prev) => ({ ...prev, [rideId]: false }));
        router.push("/dashboard?tab=booked");
        refechAvailableRides();
      } else {
        toast.error(result.error);
        setPendingRides((prev) => ({ ...prev, [rideId]: false }));
      }
    },
    onError: (error: Error, rideId) => {
      console.error(error.message);
      setPendingRides((prev) => ({ ...prev, [rideId]: false }));
      onError?.(error.message);
    },
  });

  // Calculate carbon points required for a ride based on vehicle type
  const calculateRequiredPoints = (ride: PublicAvialableRides): number => {
    if (ride.vehicleType === "Wheeler2") {
      console.log("COST_TWO_WHEELER ", process.env.NEXT_PUBLIC_CARBON_COST_TWO_WHEELER)
      return Number(process.env.NEXT_PUBLIC_CARBON_COST_TWO_WHEELER || 2);
    }
    if (ride.vehicleType === "Wheeler4") {
      console.log("COST_FOUR_WHEELER", process.env.NEXT_PUBLIC_CARBON_COST_FOUR_WHEELER)
      return Number(process.env.NEXT_PUBLIC_CARBON_COST_FOUR_WHEELER || 2);
    }
    return 0;
  };

  // Handle ride booking
  const handleBookRide = async (rideId: string) => {
    setPendingRides((prev) => ({ ...prev, [rideId]: true }));
    await mutation.mutateAsync(rideId);
  };

  /**
   * Handle open user image modal
   */
  const handleOpenImageModal = (imageUrl: string | null, userName: string) => {
    setSelectedUserImage(imageUrl);
    setSelectedUserName(userName);
    setIsImageModalOpen(true);
  };

  /**
   * Handle close user image modal
   */
  const handleCloseImageModal = () => {
    setSelectedUserImage(null);
    setSelectedUserName("");
    setIsImageModalOpen(false);
  };

  if (isAvailableRidesFetching || isAvailableRidesRefetching) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
              <Skeleton className="h-6 w-3/4 bg-white/10 rounded-md" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton className="h-4 w-1/2 bg-white/10 rounded-md" />
                <Skeleton className="h-4 w-1/3 bg-white/10 rounded-md" />
                <Skeleton className="h-4 w-2/5 bg-white/10 rounded-md" />
                <Skeleton className="h-9 w-28 bg-white/10 rounded-md mt-2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Refresh Available Rides Button */}
      <Button
        onClick={() => refechAvailableRides()}
        disabled={isAvailableRidesRefetching}
        className="mb-4 bg-[#2E7D32] hover:bg-emerald-800 cursor-pointer"
      >
        {isAvailableRidesRefetching ? (
          <span className="flex items-center">
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Refreshing...
          </span>
        ) : (
          "Refresh Available Rides"
        )}
      </Button>

      <div className="space-y-4">
        {availableRides.length > 0 ? (
          availableRides.map((ride) => {
            const hasSeats = ride.availableSets > 0;
            const requiredPoints = calculateRequiredPoints(ride);

            return (
              <Card
                key={ride.id}
                className="bg-gradient-to-br from-[#1A3C34] to-[#2C5046] text-white border-none shadow-xl hover:shadow-2xl transition-all overflow-hidden"
              >
                <CardHeader className="pb-2 border-b border-white/10">
                  <div className="flex flex-col gap-2">
                    <CardTitle className="text-base sm:text-lg font-medium flex items-center">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 w-full">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 text-emerald-400 mr-1 flex-shrink-0" />
                          <span className="text-white/90 truncate">
                            {ride.startingLocationName}
                          </span>
                        </div>
                        <span className="hidden sm:inline mx-1">→</span>
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 text-red-400 mr-1 flex-shrink-0" />
                          <span className="text-white/90 truncate">
                            {ride.destinationLocationName}
                          </span>
                        </div>
                      </div>
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    <div className="flex items-center text-sm">
                      <Clock className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                      <span>{utcIsoToLocalTime12(ride.startingTime)}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Users className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                      <span>
                        <strong>Seats:</strong> {ride.availableSets} available
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <User className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                      <div className="flex items-center gap-2">
                        <Avatar
                          className="h-6 w-6 cursor-pointer"
                          onClick={() =>
                            handleOpenImageModal(
                              ride.driverImageUrl,
                              ride.driverName || ride.driverEmail || "Champion"
                            )
                          }
                        >
                          <AvatarImage
                            src={ride.driverImageUrl ?? undefined}
                            alt={ride.driverName || ride.driverEmail || "Champion"}
                          />
                          <AvatarFallback className="bg-emerald-800 text-white text-xs">
                            {ride.driverName?.[0] || ride.driverEmail?.[0] || "C"}
                          </AvatarFallback>
                        </Avatar>
                        <span>
                          <strong>Champion:</strong>{" "}
                          {ride.driverName || ride.driverEmail}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center text-sm">
                      <Phone className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                      <span>
                        <strong>Phone:</strong>{" "}
                        {ride.driverPhone || "Not provided"}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Car className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                      <span>
                        <strong>Vehicle:</strong> {ride.vehicleNumber} (
                        {ride.vehicleName
                          ? `${ride.vehicleName}, ${ride.vehicleType}`
                          : ride.vehicleType}
                        )
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Coins className="h-4 w-4 text-amber-400 mr-2 flex-shrink-0" />
                      <span>
                        Cost:{" "}
                        <span className="font-medium text-amber-400">
                          {requiredPoints}
                        </span>{" "}
                        carbon points
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleBookRide(ride.id)}
                    disabled={!hasSeats || pendingRides[ride.id]}
                    variant="default"
                    size="sm"
                    className={`w-full justify-center cursor-pointer ${!hasSeats
                      ? "bg-red-700/50 hover:bg-red-700/60"
                      : "bg-[#2E7D32]"
                      }`}
                  >
                    {pendingRides[ride.id] ? (
                      <span className="flex items-center">
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Processing...
                      </span>
                    ) : !hasSeats ? (
                      "No seats available"
                    ) : (
                      "Book Ride"
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="bg-white/5 backdrop-blur-sm border-white/10 text-white">
            <CardContent className="flex flex-col items-center justify-center p-8">
              <div className="rounded-full bg-[#1A3C34] p-3 mb-4">
                <AlertCircle className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium mb-2">No rides available</h3>
              <p className="text-gray-400 text-center">
                There are currently no available rides after the current time.
                Please check back later or raise a ride request from Ride
                Requests Tab!
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* User Image Modal */}
      {isImageModalOpen && (
        <UserImageModal
          isOpen={isImageModalOpen}
          onClose={handleCloseImageModal}
          imageUrl={selectedUserImage}
          userName={selectedUserName}
        />
      )}
    </>
  );
};

export default AvailableRides;