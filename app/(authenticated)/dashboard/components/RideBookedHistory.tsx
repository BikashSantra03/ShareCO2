import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  MapPin,
  MessageCircle,
  Users,
  Car,
} from "lucide-react";
import React, { useState } from "react";
import {
  activateRideBooking,
  cancleRideBooking,
  getUserRideBookings,
} from "../actions";
import { PublicRideBookingStatus, PublicRideStatus } from "../types";
import { utcIsoToLocalDate, utcIsoToLocalTime12 } from "@/utils/time";
import { toast } from "sonner";
import { RideChatModal } from "@/app/_components/modals/RideChatModal/RideChatModal";
import { CancelRideModal } from "@/app/_components/modals/CancelRideModal";

const getStatusColor = (status: PublicRideStatus) => {
  switch (status) {
    case "Active":
      return "text-emerald-400";
    case "Pending":
      return "text-amber-400";
    case "Completed":
      return "text-blue-400";
    case "Cancelled":
      return "text-red-400";
    default:
      return "";
  }
};

const getBookingStatusColor = (status: PublicRideBookingStatus) => {
  switch (status) {
    case "Confirmed":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "Active":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "Denied":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
};

/**
 * Check if threshold time for cancellation has passed
 */
const isThresholdTimePassed = (startTime: string): boolean => {
  const rideThresholdMinutes =
    Number(process.env.NEXT_PUBLIC_RIDE_THRESHOLD_TIME) || 30;
  const startDate = new Date(startTime);
  const currentDate = new Date();
  const diffInMinutes =
    (startDate.getTime() - currentDate.getTime()) / (1000 * 60);
  return diffInMinutes <= rideThresholdMinutes;
};

const RideBookedHistory = () => {
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [expandedRideId, setExpandedRideId] = useState<string | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Cancellation charge constant
  const CANCELLATION_CHARGE = Number(
    process.env.NEXT_PUBLIC_RIDE_CANCELLATION_CHARGE_RIDER
  );

  // Fetch user's ride bookings
  const {
    data: rideBookings = [],
    isLoading: isRideBookingsFetching,
    isError: isRideBookingsFetchingError,
    error: rideBookingsFetchingError,
    isRefetching: isRideBookingsRefetching,
    isRefetchError: isRideBookingsRefetchingError,
    refetch: refetchRideBookings,
  } = useQuery({
    queryKey: ["ride-bookings"],
    queryFn: getUserRideBookings,
  });

  if (isRideBookingsFetchingError || isRideBookingsRefetchingError) {
    console.error(rideBookingsFetchingError);
  }

  // Hook for confirm reach
  const { mutateAsync: mutateConfirmReach, isPending: isConfirmReachPending } =
    useMutation({
      mutationFn: (bookingId: string) => activateRideBooking(bookingId),
      onSuccess: async () => {
        toast.success("Ride booking activated");
        await refetchRideBookings();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });

  // Hook for cancel booking
  const {
    mutateAsync: mutateCancleBooking,
    isPending: isCancleBookingPending,
  } = useMutation({
    mutationFn: (bookingId: string) => cancleRideBooking(bookingId),
    onSuccess: async () => {
      toast.success("Ride booking canceled successfully");
      await refetchRideBookings();
      await queryClient.invalidateQueries({ queryKey: ["carbonpoint"] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleConfirmReach = async (bookingId: string) => {
    if (isConfirmReachPending) return true;
    await mutateConfirmReach(bookingId);
  };

  /**
   * Handle cancel booking
   */
  const handleCancelBooking = (bookingId: string) => {
    setBookingToCancel(bookingId);
    setIsCancelModalOpen(true);
  };

  /**
   * Confirm cancel booking
   */
  const confirmCancelBooking = async () => {
    if (!bookingToCancel) return;

    await mutateCancleBooking(bookingToCancel);
    setIsCancelModalOpen(false);
    setBookingToCancel(null);
  };

  const handleOpenChat = (rideId: string) => {
    setSelectedRideId(rideId);
    setIsChatOpen(true);
  };

  const handleCloseChat = () => {
    setSelectedRideId(null);
    setIsChatOpen(false);
  };

  const toggleDetails = (rideId: string) => {
    setExpandedRideId(expandedRideId === rideId ? null : rideId);
  };

  if (isRideBookingsFetching || isRideBookingsRefetching) {
    return (
      <ScrollArea className="h-[500px] w-full px-4 pb-4">
        <div className="space-y-3">
          {[...Array(3)].map((_, index) => (
            <div
              key={index}
              className="p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10"
            >
              <div className="flex flex-col gap-3">
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 text-gray-400 mr-1" />
                      <div className="h-4 w-24 bg-gray-600/50 rounded animate-pulse" />
                    </div>
                    <span className="hidden sm:inline mx-1">→</span>
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 text-gray-400 mr-1" />
                      <div className="h-4 w-24 bg-gray-600/50 rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="h-6 w-20 bg-gray-600/50 rounded-3xl animate-pulse" />
                    <div className="h-6 w-20 bg-gray-600/50 rounded-3xl animate-pulse" />
                    <div className="h-6 w-24 bg-gray-600/50 rounded-3xl animate-pulse" />
                    <div className="h-6 w-24 bg-gray-600/50 rounded-3xl animate-pulse" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-24 bg-gray-600/50 rounded animate-pulse" />
                  <div className="h-8 w-24 bg-gray-600/50 rounded animate-pulse" />
                  <div className="h-8 w-16 bg-gray-600/50 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  }

  return (
    <>
      <ScrollArea className="h-[500px] w-full px-4 pb-4">
        <div className="space-y-3">
          {rideBookings.length > 0 ? (
            rideBookings.map((rideBooking) => (
              <div
                key={rideBooking.id}
                className="p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:border-white/20 transition-all"
              >
                <div className="flex flex-col gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 text-emerald-400 mr-1" />
                        <p className="font-medium">
                          {rideBooking.ride.startingLocation?.name || "N/A"}
                        </p>
                      </div>
                      <span className="hidden sm:inline mx-1">→</span>
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 text-red-400 mr-1" />
                        <p className="font-medium">
                          {rideBooking.ride.destinationLocation?.name || "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-300">
                      <div className="flex items-center bg-white/10 rounded-3xl px-2 py-1">
                        <Calendar className="h-3 w-3 mr-1 opacity-70" />
                        {utcIsoToLocalDate(
                          rideBooking.ride.startingTime.toISOString()
                        )}
                      </div>
                      <div className="flex items-center bg-white/10 rounded-3xl px-2 py-1">
                        <Clock className="h-3 w-3 mr-1 opacity-70" />
                        {utcIsoToLocalTime12(
                          rideBooking.ride.startingTime.toISOString()
                        )}
                      </div>
                      <div
                        className={`flex items-center bg-white/10 rounded-3xl px-2 py-1 ${getBookingStatusColor(
                          rideBooking.status
                        )}`}
                      >
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {rideBooking.status}
                      </div>
                      {rideBooking.ride.status && (
                        <div
                          className={`flex items-center bg-white/10 rounded-3xl px-2 py-1 ${getStatusColor(
                            rideBooking.ride.status
                          )}`}
                        >
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Ride: {rideBooking.ride.status}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-emerald-300 hover:text-emerald-100 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 rounded-md cursor-pointer transition-all duration-200"
                      onClick={() => toggleDetails(rideBooking.id)}
                    >
                      {expandedRideId === rideBooking.id
                        ? "Hide Details"
                        : "Show Details"}
                    </Button>
                    {expandedRideId === rideBooking.id && (
                      <div className="mt-2 text-sm text-gray-300 space-y-2">
                        <div className="border-t border-white/10 pt-2">
                          <h4 className="text-xs font-semibold text-white flex items-center">
                            <Car className="h-4 w-4 mr-1" />
                            Champion Details
                          </h4>
                          <p>Name: {rideBooking.ride.driver.name || "N/A"}</p>
                          <p>Phone: {rideBooking.ride.driver.phone || "N/A"}</p>
                          <p>
                            Car details:{" "}
                            {rideBooking.ride.vehicle
                              ? `${rideBooking.ride.vehicle.model || "N/A"} (${
                                  rideBooking.ride.vehicle.vehicleNumber ||
                                  "N/A"
                                })`
                              : "N/A"}
                          </p>
                        </div>
                        <div className="border-t border-white/10 pt-2">
                          <h4 className="text-xs font-semibold text-white flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            Co-Passengers
                          </h4>
                          {rideBooking.ride.bookings.length > 0 ? (
                            <ul className="list-disc list-inside">
                              {rideBooking.ride.bookings
                                .filter((b) => b.user.id !== rideBooking.userId)
                                .map((b) => (
                                  <li key={b.id}>
                                    {b.user.name || "Unnamed User"}
                                  </li>
                                ))}
                            </ul>
                          ) : (
                            <p>No other passengers</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {rideBooking.status === "Confirmed" && (
                      <Button
                        onClick={() => handleConfirmReach(rideBooking.id)}
                        className="px-3 py-1 h-8 text-xs bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/40 border border-emerald-500/30 cursor-pointer"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Found Car
                      </Button>
                    )}
                    {rideBooking.status === "Confirmed" && (
                      <Button
                        onClick={() => handleCancelBooking(rideBooking.id)}
                        className="px-3 py-1 h-8 text-xs bg-red-500/20 text-red-300 hover:bg-red-500/40 border border-red-500/30 cursor-pointer"
                      >
                        Cancel Booking
                      </Button>
                    )}
                    {(rideBooking.status === "Active" ||
                      rideBooking.status === "Completed" ||
                      rideBooking.status === "Confirmed") && (
                      <Button
                        onClick={() => handleOpenChat(rideBooking.ride.id)}
                        className="px-3 py-1 h-8 text-xs bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 border border-blue-500/30 cursor-pointer"
                      >
                        <MessageCircle className="h-3 w-3 mr-1" />
                        Chat
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-gray-400 mt-2">
                No booked rides in the past 7 days
              </p>
              <p className="text-xs text-gray-500">
                Your recent booked rides will appear here
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
      {isChatOpen && (
        <RideChatModal
          isOpen={isChatOpen}
          onClose={handleCloseChat}
          rideId={selectedRideId as string}
          isActive={true}
        />
      )}

      {isCancelModalOpen && (
        <CancelRideModal
          isOpen={isCancelModalOpen}
          onClose={() => {
            setIsCancelModalOpen(false);
            setBookingToCancel(null);
          }}
          onConfirm={confirmCancelBooking}
          isPending={isCancleBookingPending}
          amount={CANCELLATION_CHARGE}
          isThresholdPassed={
            bookingToCancel
              ? isThresholdTimePassed(
                  rideBookings
                    .find((booking) => booking.id === bookingToCancel)
                    ?.ride.startingTime?.toISOString() ||
                    new Date().toISOString()
                )
              : false
          }
        />
      )}
    </>
  );
};

export default RideBookedHistory;
