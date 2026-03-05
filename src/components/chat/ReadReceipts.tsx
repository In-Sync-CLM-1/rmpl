import { Check, CheckCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ReadReceiptUser {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

interface ReadReceiptsProps {
  readByUsers: ReadReceiptUser[];
  isOwnMessage: boolean;
  isDelivered?: boolean;
}

export function ReadReceipts({ readByUsers, isOwnMessage, isDelivered = true }: ReadReceiptsProps) {
  // Only show on own messages
  if (!isOwnMessage) return null;

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // No one has read yet - show single check (delivered)
  if (readByUsers.length === 0) {
    return (
      <div className="flex items-center justify-end gap-1 mt-0.5">
        <Check className="h-3 w-3 text-muted-foreground" />
      </div>
    );
  }

  // In direct conversations (1 other person), show double check
  if (readByUsers.length === 1) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-end gap-1 mt-0.5">
              <CheckCheck className="h-3 w-3 text-primary" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            Seen by {readByUsers[0].name || "User"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // In group conversations, show avatars of who has read
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-end gap-0.5 mt-0.5">
            <div className="flex -space-x-1.5">
              {readByUsers.slice(0, 3).map((user) => (
                <Avatar key={user.id} className="h-4 w-4 border border-background">
                  <AvatarImage src={user.avatarUrl || undefined} />
                  <AvatarFallback className="text-[8px] bg-muted">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            {readByUsers.length > 3 && (
              <span className="text-[10px] text-muted-foreground ml-1">
                +{readByUsers.length - 3}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs max-w-[200px]">
          <p>
            Seen by{" "}
            {readByUsers
              .map((u) => u.name || "User")
              .slice(0, 5)
              .join(", ")}
            {readByUsers.length > 5 && ` +${readByUsers.length - 5} more`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
