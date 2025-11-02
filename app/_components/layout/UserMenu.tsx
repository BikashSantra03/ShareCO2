"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LogOut,
  User,
  History,
  Wallet,
  CreditCard,
  HelpCircle,
  Leaf,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getUserProfile } from "@/app/(authenticated)/profile/components/ProfileManager/actions";

// Add types for user with isAdmin and cePoints
interface ExtendedUser {
  id: string;
  email: string;
  isAdmin?: boolean;
  name?: string;
  imageUrl?: string;
  cePoints?: number; // Added cePoints to the interface
}

export function UserMenu() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch user profile using useQuery
  const {
    data: userData,
    isLoading: isUserDataFetching,
    isError: isUserDataError,
  } = useQuery({
    queryKey: ["userProfile"],
    queryFn: getUserProfile,
    enabled: !!session?.user?.id, // Only fetch if user is logged in
  });

  if (!session?.user) return null;

  // Use userData from useQuery, fallback to session if needed
  const user = userData as ExtendedUser | undefined;

  const handleNavigate = (path: string) => {
    setIsOpen(false);
    router.push(path);
  };

  const handleSignOut = async () => {
    try {
      await signOut({ redirect: false });
      localStorage.removeItem("isProfileCompleted");
      toast.success("Logged out successfully");

      // Add a small delay before redirecting
      setTimeout(() => {
        router.push("/");
      }, 100);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to log out";
      toast.error("Error", {
        description: errorMessage,
      });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" className="rounded-full p-0 w-10 h-10">
          {isUserDataFetching ? (
            <div className="h-10 w-10 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-emerald-600"></div>
            </div>
          ) : isUserDataError ? (
            <Avatar className="h-10 w-10 border-2 border-emerald-600">
              <AvatarImage src="/default-avatar.png" alt="Error" />
              <AvatarFallback className="bg-emerald-800 text-white text-2xl">
                {session?.user?.name?.[0] || session?.user?.email?.[0] || ""}
              </AvatarFallback>
            </Avatar>
          ) : (
            <Avatar className="h-10 w-10 border-2 border-emerald-600">
              <AvatarImage
                src={user?.imageUrl || "/default-avatar.png"}
                alt={session.user.email || ""}
              />
              <AvatarFallback className="bg-emerald-800 text-white text-2xl">
                {session?.user?.name?.[0] || session?.user?.email?.[0] || ""}
              </AvatarFallback>
            </Avatar>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="bg-[#1A3C34] text-white border-none [&>button]:cursor-pointer">
        <SheetHeader>
          <SheetTitle className="text-white flex items-center gap-2">
            {isUserDataFetching ? (
              <div className="h-10 w-10 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-emerald-600"></div>
              </div>
            ) : isUserDataError ? (
              <Avatar className="h-10 w-10">
                <AvatarImage src="/default-avatar.png" alt="Error" />
                <AvatarFallback className="bg-emerald-800 text-white text-2xl">
                  {session?.user?.name?.[0] || session?.user?.email?.[0] || ""}
                </AvatarFallback>
              </Avatar>
            ) : (
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={user?.imageUrl || "/default-avatar.png"}
                  alt={session.user.email || ""}
                />
                <AvatarFallback className="bg-emerald-800 text-white text-2xl">
                  {session?.user?.name?.[0] || session?.user?.email?.[0] || ""}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="flex flex-col items-start">
              {isUserDataFetching ? (
                <span className="font-medium">Loading...</span>
              ) : isUserDataError ? (
                <span className="font-medium text-red-400">
                  Error loading profile
                </span>
              ) : (
                <>
                  <span className="font-medium">
                    {user?.name || user?.email?.split("@")[0] || "User"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {user?.email || session.user.email}
                  </span>
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <Leaf className="h-4 w-4" />
                    Lifetime Carbon Saved: {user?.cePoints?.toFixed(2) || 0} grams
                  </span>
                </>
              )}
            </div>
          </SheetTitle>
        </SheetHeader>
        <div className="mt-8 space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start text-white hover:bg-white/10 cursor-pointer"
            onClick={() => handleNavigate("/profile")}
          >
            <User className="mr-2 h-5 w-5" />
            My Profile
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-white hover:bg-white/10 cursor-pointer"
            onClick={() => handleNavigate("/ride-history")}
          >
            <History className="mr-2 h-5 w-5" />
            Ride History
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-white hover:bg-white/10 cursor-pointer"
            onClick={() => handleNavigate("/wallet")}
          >
            <Wallet className="mr-2 h-5 w-5" /> Wallet
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-white hover:bg-white/10 cursor-pointer"
            onClick={() => handleNavigate("/support")}
          >
            <HelpCircle className="mr-2 h-5 w-5" /> Support
          </Button>

          {/* Admin-only menu items */}
          {user?.isAdmin && (
            <>
              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:bg-white/10 cursor-pointer"
                onClick={() => handleNavigate("/recharge-requests")}
              >
                <CreditCard className="mr-2 h-5 w-5" />
                Recharge Requests
              </Button>
              <a href="/api/mart/sso" target="_blank">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-white hover:bg-white/10 hover:text-red-400 cursor-pointer"
                >
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  Shopping
                </Button>
              </a>
            </>
          )}

          <hr className="border-white/10 my-4" />
          <Button
            variant="ghost"
            className="w-full justify-start text-white hover:bg-white/10 hover:text-red-400 cursor-pointer"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-5 w-5" />
            Log Out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}