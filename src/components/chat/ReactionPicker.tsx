import { useState } from "react";
import { Smile, Plus } from "lucide-react";
import EmojiPicker, { Theme, EmojiClickData } from "emoji-picker-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

interface ReactionPickerProps {
  onReact: (emoji: string) => void;
  className?: string;
}

export function ReactionPicker({ onReact, className }: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const { theme } = useTheme();

  const handleQuickReaction = (emoji: string) => {
    onReact(emoji);
    setIsOpen(false);
    setShowFullPicker(false);
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onReact(emojiData.emoji);
    setIsOpen(false);
    setShowFullPicker(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) setShowFullPicker(false);
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity", className)}
        >
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0" 
        side="top" 
        align="start"
        sideOffset={5}
      >
        {!showFullPicker ? (
          <div className="flex items-center gap-1 p-2">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleQuickReaction(emoji)}
                className="h-8 w-8 flex items-center justify-center text-lg hover:bg-muted rounded transition-colors"
              >
                {emoji}
              </button>
            ))}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowFullPicker(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme={theme === "dark" ? Theme.DARK : Theme.LIGHT}
            width={320}
            height={400}
            searchPlaceholder="Search emoji..."
            previewConfig={{ showPreview: false }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
