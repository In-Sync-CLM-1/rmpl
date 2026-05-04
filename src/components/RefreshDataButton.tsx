import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

interface RefreshDataButtonProps {
  queryKeys: QueryKey[];
  lastUpdated?: Date | string | number | null;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function RefreshDataButton({
  queryKeys,
  lastUpdated,
  label = "Refresh data",
  variant = "outline",
  size = "sm",
  className,
}: RefreshDataButtonProps) {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all(
        queryKeys.map((key) =>
          queryClient.invalidateQueries({ queryKey: key, refetchType: "active" })
        )
      );
      toast.success("Data refreshed");
    } catch (e: any) {
      toast.error("Refresh failed: " + (e?.message || "unknown error"));
    } finally {
      setIsRefreshing(false);
    }
  };

  const formattedLastUpdated = lastUpdated
    ? format(new Date(lastUpdated), "dd MMM, hh:mm a")
    : null;

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      {formattedLastUpdated && (
        <span className="text-xs text-muted-foreground hidden sm:inline">
          Last updated: {formattedLastUpdated}
        </span>
      )}
      <Button
        variant={variant}
        size={size}
        onClick={handleRefresh}
        disabled={isRefreshing}
      >
        <RefreshCw className={`h-4 w-4 ${size === "icon" ? "" : "mr-2"} ${isRefreshing ? "animate-spin" : ""}`} />
        {size !== "icon" && (isRefreshing ? "Refreshing..." : label)}
      </Button>
    </div>
  );
}
