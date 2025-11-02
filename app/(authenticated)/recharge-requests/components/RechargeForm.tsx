"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { carbonPointsToRupees } from "@/utils/carbonPointsConversion";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { getWallet } from "../../wallet/actions";
import axios, { AxiosError } from "axios";
import { useRouter } from "next/navigation";

// Expected error response structure
interface ErrorResponse {
    error?: string;
}

const RechargeForm = () => {
    const [carbonPoints, setCarbonPoints] = useState("");
    const queryClient = useQueryClient();
    const router = useRouter();

    // Fetch wallet data
    const {
        data: wallet,
        isLoading: walletLoading,
        isError: walletError,
    } = useQuery({
        queryKey: ["wallet"],
        queryFn: getWallet,
    });

    const spendable = wallet?.spendableBalance || 0;
    const amount = carbonPoints
        ? carbonPointsToRupees(parseFloat(carbonPoints)).toFixed(2)
        : "";

    const mutation = useMutation({
        mutationFn: async (submitData: { carboncoin: number }) => {
            const response = await axios.post("/api/mart/recharge", submitData);
            return response.data;
        },
        onSuccess: (data) => {
            if (!data.success) {
                throw new Error(data.error || "Failed to process recharge");
            }
            toast.success(
                `Recharged ₹${amount} successfully! Order ID: ${data.orderid}`,
                {
                    action: {
                        label: "View Transactions",
                        onClick: () => router.push("/wallet"),
                    },
                }
            );
            setCarbonPoints("");
            queryClient.invalidateQueries({ queryKey: ["wallet"] });
            queryClient.invalidateQueries({
                queryKey: ["wallet-transactions"],
            });
            // queryClient.invalidateQueries({
            //     queryKey: ["recharge-transactions"],
            // });
        },
        onError: (error: AxiosError<ErrorResponse>) => {
            const errorMessage =
                error.response?.data?.error ||
                error.message ||
                "An unexpected error occurred. Please try again.";
            toast.error("Error", {
                description: errorMessage,
            });
            console.log("recharge error: ", error);
        },
    });

    // Shimmer for loading
    if (walletLoading) {
        return (
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg animate-pulse">
                <div className="p-6">
                    <div className="flex items-center">
                        <div className="h-5 w-5 bg-gray-600/50 rounded-full mr-2" />
                        <div className="h-5 w-32 bg-gray-600/50 rounded" />
                    </div>
                    <div className="space-y-4 mt-6">
                        <div className="text-center">
                            <div className="h-8 w-24 mx-auto bg-gray-600/50 rounded" />
                            <div className="flex justify-center gap-4 mt-2">
                                <div className="h-4 w-20 bg-gray-600/50 rounded" />
                            </div>
                        </div>
                        <div className="flex justify-center">
                            <div className="h-10 w-24 bg-gray-600/50 rounded" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (walletError) {
        return <div>Error loading wallet balance</div>;
    }

    const handleSubmit = () => {
        const cp = parseFloat(carbonPoints);
        if (!cp || cp <= 0) {
            toast.error("Invalid amount");
            return;
        }
        if (cp > spendable) {
            toast.error("Insufficient spendable balance");
            return;
        }

        mutation.mutate({ carboncoin: cp });
    };

    return (
        <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
                <CardTitle className="text-lg font-semibold text-white flex items-center">
                    Recharge Mart Wallet
                </CardTitle>
                <p className="text-sm text-gray-400">
                    Conversion Rate: 1 CP = ₹
                    {process.env.NEXT_PUBLIC_RUPEES_PER_CARBON_POINT || "18"}
                </p>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="carbonPoints" className="text-white ">
                        Carbon Points (CP) to Spend
                    </Label>
                    <Input
                        id="carbonPoints"
                        type="number"
                        placeholder="Enter carbon points"
                        value={carbonPoints}
                        onChange={(e) => setCarbonPoints(e.target.value)}
                        className="bg-black/30 border-gray-700 text-white"
                        min="0"
                        step="1"
                    />
                    <p className="text-sm text-gray-400">
                        Available: {spendable.toFixed(2)} CP
                    </p>
                </div>

                <div className="text-sm text-emerald-400 bg-emerald-500/10 p-2 rounded">
                    {carbonPoints && parseFloat(carbonPoints) > 0
                        ? `${carbonPoints} CP → ₹${amount}`
                        : "Enter CP to see conversion"}
                </div>

                <Button
                    className="bg-emerald-600 hover:bg-emerald-700 cursor-pointer w-full"
                    onClick={handleSubmit}
                    disabled={
                        mutation.isPending ||
                        !carbonPoints ||
                        parseFloat(carbonPoints) <= 0 ||
                        walletLoading
                    }
                >
                    {mutation.isPending ? "Processing..." : "Recharge"}
                </Button>
            </CardContent>
        </Card>
    );
};

export default RechargeForm;