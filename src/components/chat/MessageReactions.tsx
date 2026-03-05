import { cn } from "@/lib/utils";
import { GroupedReaction } from "@/hooks/useMessageReactions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MessageReactionsProps {
  reactions: GroupedReaction[];
  onToggleReaction: (emoji: string) => void;
  isOwnMessage: boolean;
}

export function MessageReactions({
  reactions,
  onToggleReaction,
  isOwnMessage,
}: MessageReactionsProps) {
  if (reactions.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1 mt-1",
        isOwnMessage ? "justify-end" : "justify-start"
      )}
    >
      <TooltipProvider>
        {reactions.map((reaction) => (
          <Tooltip key={reaction.emoji}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onToggleReaction(reaction.emoji)}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors",
                  "hover:bg-muted/80",
                  reaction.hasReacted
                    ? "bg-primary/20 border border-primary/40"
                    : "bg-muted border border-transparent"
                )}
              >
                <span>{reaction.emoji}</span>
                <span className="text-muted-foreground">{reaction.count}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px]">
              <p className="text-xs">
                {reaction.users
                  .map((u) => u.name || "Unknown")
                  .slice(0, 5)
                  .join(", ")}
                {reaction.users.length > 5 && ` +${reaction.users.length - 5} more`}
              </p>
            </TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  );
}
