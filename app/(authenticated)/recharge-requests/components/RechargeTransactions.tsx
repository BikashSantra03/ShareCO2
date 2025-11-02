"use client";

import React, { useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, ArrowUp, Clock, RefreshCw } from "lucide-react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { utcIsoToLocalDate, utcIsoToLocalTime12 } from "@/utils/time";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PublicWalletTransaction } from "../../wallet/types";
import { getWalletRechargeTransactions } from "../../wallet/actions";

// Shimmer Component for Loading State
const ShimmerTransactionCard = () => (
    <div className="p-3 bg-white/5 rounded-lg border border-white/10 animate-pulse">
        <div className="flex justify-between items-center">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <div className="h-4 w-4 bg-gray-600/50 rounded-full" />
                    <div className="h-4 w-32 bg-gray-600/50 rounded" />
                </div>
                <div className="h-4 w-48 bg-gray-600/50 rounded mt-1" />
                <div className="flex gap-2 mt-1">
                    <div className="flex items-center">
                        <div className="h-3 w-3 bg-gray-600/50 rounded-full mr-1" />
                        <div className="h-4 w-24 bg-gray-600/50 rounded" />
                    </div>
                </div>
            </div>
            <div className="h-6 w-20 bg-gray-600/50 rounded" />
        </div>
    </div>
);

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
        case "ORDER_PURCHASE":
            return "Mart Recharge";
        case "ORDER_REFUND":
            return "Mart Refund";
        default:
            return "Unknown Transaction";
    }
};

const RechargeTransactions = () => {
    const router = useRouter();
    const queryClient = useQueryClient();
    const scrollRef = useRef<HTMLDivElement>(null);

    // Fetching recharge transactions only
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
        error,
    } = useInfiniteQuery({
        queryKey: ["recharge-transactions"], // Unique key for recharge-specific cache
        queryFn: ({ pageParam = 1 }) =>
            getWalletRechargeTransactions({ page: pageParam, limit: 10 }),
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages, lastPageParam) => {
            if (lastPage.transactions.length < 10) {
                return undefined;
            }
            return lastPageParam + 1;
        },
    });

    const flatTransactions =
        data?.pages.flatMap((page) => page.transactions) || [];

    // Scroll handler for infinite loading
    useEffect(() => {
        const scrollElement = scrollRef.current;
        if (!scrollElement) return;

        const handleScroll = () => {
            if (
                scrollElement.scrollTop + scrollElement.clientHeight >=
                    scrollElement.scrollHeight - 5 &&
                hasNextPage &&
                !isFetchingNextPage
            ) {
                fetchNextPage();
            }
        };

        scrollElement.addEventListener("scroll", handleScroll);
        return () => scrollElement.removeEventListener("scroll", handleScroll);
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    // Handle manual refetch
    const handleRefresh = async () => {
        try {
            await queryClient.invalidateQueries({
                queryKey: ["recharge-transactions"],
            });
            toast.success("Recharge history refreshed");
        } catch (error) {
            toast.error("Failed to refresh recharge history");
            console.log(error);
        }
    };

    if (isLoading) {
        return (
            <Card className="bg-white/5 backdrop-blur-sm border-white/10">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div className="h-5 w-32 bg-gray-600/50 rounded" />
                        <div className="h-8 w-24 bg-gray-600/50 rounded" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-[400px] w-full overflow-y-auto">
                        <div className="space-y-3">
                            {Array.from({ length: 3 }).map((_, index) => (
                                <ShimmerTransactionCard key={index} />
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (isError) {
        console.error(error);
        return <div>Error loading recharge history</div>;
    }

    return (
        <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg font-semibold text-white">
                        Recharge History
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
                <div
                    ref={scrollRef}
                    className="h-[400px] w-full overflow-y-auto hide-scrollbar"
                >
                    {flatTransactions.length > 0 ? (
                        <div className="space-y-3">
                            {flatTransactions.map((txn) => (
                                <div
                                    key={txn.id}
                                    className="p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-all"
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                {
                                                    getTransactionStyle(
                                                        txn.direction
                                                    ).icon
                                                }
                                                <p
                                                    className={`font-medium ${
                                                        getTransactionStyle(
                                                            txn.direction
                                                        ).color
                                                    }`}
                                                >
                                                    {getPurposeLabel(
                                                        txn.purpose
                                                    )}
                                                </p>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1 truncate hidden sm:block">
                                                {txn.description ||
                                                    `No description for ${getPurposeLabel(
                                                        txn.purpose
                                                    )}`}
                                            </p>
                                            <div className="flex gap-2 mt-1 text-xs text-gray-300">
                                                <div className="flex items-center">
                                                    <Clock className="h-3 w-3 mr-1 opacity-70" />
                                                    {utcIsoToLocalDate(
                                                        txn.createdAt
                                                    )}{" "}
                                                    {utcIsoToLocalTime12(
                                                        txn.createdAt
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <Badge
                                                className={`text-sm ${
                                                    getTransactionStyle(
                                                        txn.direction
                                                    ).color
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
                                            {txn.externalOrderId && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        router.push(
                                                            `/shoppingOrderDetails/${txn.externalOrderId}`
                                                        )
                                                    }
                                                    className="text-white hover:bg-white/10 cursor-pointer text-xs px-2 py-0 h-6"
                                                >
                                                    Order Details
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {isFetchingNextPage && (
                                <div className="p-3 text-center">
                                    <p className="text-sm text-gray-400">
                                        Loading more...
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full py-10 text-center">
                            <p className="text-gray-400 mt-2">
                                No recharge requests found
                            </p>
                            <p className="text-xs text-gray-500">
                                Your recharge transactions will appear here
                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default RechargeTransactions;
