import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button"; // Added for Refresh button
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowDown, ArrowUp, Clock, RefreshCw } from "lucide-react"; // Added RefreshCw icon
import { useQuery } from "@tanstack/react-query";
import { getTransactions } from "../actions";
import { PublicWalletTransaction } from "../types";
import { utcIsoToLocalDate, utcIsoToLocalTime12 } from "@/utils/time";
import { toast } from "sonner"; // Added for toast notification

// Helper to get transaction color and icon
const getTransactionStyle = (
  direction: PublicWalletTransaction["direction"]
) => {
  switch (direction) {
    case "CREDIT":
      return {
        color: "text-emerald-400",
        icon: <ArrowUp className="h-4 w-4 mr-1" />,
      };
    case "DEBIT":
      return {
        color: "text-red-400",
        icon: <ArrowDown className="h-4 w-4 mr-1" />,
      };
    case "NEUTRAL":
      return {
        color: "text-gray-400",
        icon: null,
      };
  }
};

// Helper to get purpose label
const getPurposeLabel = (purpose: PublicWalletTransaction["purpose"]) => {
  switch (purpose) {
    case "TOPUP":
      return "Top Up";
    case "BOOKING_RESERVE":
      return "Ride Booking Reserved";
    case "BOOKING_RELEASE":
      return "Ride Booking Released";
    case "BOOKING_SETTLE":
      return "Ride Booking Settled";
    case "PAYOUT":
      return "Champion Payout";
    case "REFUND":
      return "Refund";
    case "FINE_CHARGE":
      return "Fine Charged";
    case "PROMOTION":
      return "Promotion Bonus";
    case "ADJUSTMENT":
      return "Balance Adjustment";
    default:
      return "Unknown Transaction";
  }
};

const WalletTransactions = () => {
  const {
    data: { transactions = [] } = {},
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["wallet-transactions"],
    queryFn: () => getTransactions({ page: 1, limit: 10 }),
  });

  // Handle manual refetch
  const handleRefresh = async () => {
    try {
      await refetch();
      toast.success("Transactions refreshed");
    } catch (error) {
      toast.error("Failed to refresh transactions");
      console.log(error)
    }
  };

  if (isLoading) {
    return <div>Loading transactions...</div>;
  }

  if (isError) {
    console.error(error);
    return <div>Error loading transactions</div>;
  }

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-white/10">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-semibold text-white">
            Transaction History
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="text-white hover:bg-white/10 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] w-full">
          {transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((txn) => (
                <div
                  key={txn.id}
                  className="p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-all"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {getTransactionStyle(txn.direction).icon}
                        <p
                          className={`font-medium ${
                            getTransactionStyle(txn.direction).color
                          }`}
                        >
                          {getPurposeLabel(txn.purpose)}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        {txn.description ||
                          `No description for ${getPurposeLabel(txn.purpose)}`}
                      </p>
                      <div className="flex gap-2 mt-1 text-xs text-gray-300">
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1 opacity-70" />
                          {utcIsoToLocalDate(txn.createdAt)}{" "}
                          {utcIsoToLocalTime12(txn.createdAt)}
                        </div>
                      </div>
                    </div>
                    <Badge
                      className={`text-xs ${
                        getTransactionStyle(txn.direction).color
                      }`}
                      variant="outline"
                    >
                      {txn.direction === "CREDIT"
                        ? "+"
                        : txn.direction === "DEBIT"
                        ? "-"
                        : ""}
                      {txn.amount.toFixed(2)} CP
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-gray-400 mt-2">No transactions found</p>
              <p className="text-xs text-gray-500">
                Your wallet transactions will appear here
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default WalletTransactions;
