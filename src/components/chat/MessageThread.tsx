import { useEffect, useRef, useCallback } from "react";
import { useMessages, ChatMessage } from "@/hooks/useMessages";
import { useMessageReactions } from "@/hooks/useMessageReactions";
import { useReadReceipts } from "@/hooks/useReadReceipts";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Reply, Forward } from "lucide-react";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { TaskShareCard } from "./TaskShareCard";
import { FileAttachment } from "./FileAttachment";
import { MessageReactions } from "./MessageReactions";
import { ReactionPicker } from "./ReactionPicker";
import { ReadReceipts } from "./ReadReceipts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MessageThreadProps {
  conversationId: string | null;
  currentUserId: string;
  onReply?: (message: ChatMessage) => void;
  onForward?: (message: ChatMessage) => void;
}

export function MessageThread({ conversationId, currentUserId, onReply, onForward }: MessageThreadProps) {
  const { messages, isLoading, markAsRead, fetchOlderMessages, hasMore, isFetchingMore } = useMessages(conversationId);
  const { toggleReaction, getGroupedReactions } = useMessageReactions(conversationId);
  const { getMessageReadReceipts } = useReadReceipts(conversationId, currentUserId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const isInitialLoad = useRef(true);
  const prevMessageCount = useRef(0);

  // Scroll to bottom on initial load and new messages (but not when loading older)
  useEffect(() => {
    if (messages.length === 0) return;

    const wasLoadingOlder = messages.length > prevMessageCount.current &&
      prevMessageCount.current > 0 &&
      !isInitialLoad.current;

    // Only skip scroll-to-bottom if we loaded older messages (prepended)
    // Detect: message count grew but the last message didn't change
    const lastMsgChanged = prevMessageCount.current === 0 ||
      messages[messages.length - 1]?.id !== undefined; // always true, but we need better detection

    if (isInitialLoad.current) {
      // Initial load: scroll to bottom immediately
      bottomRef.current?.scrollIntoView();
      isInitialLoad.current = false;
    } else if (!isFetchingMore && messages.length > prevMessageCount.current) {
      // New message appended: smooth scroll to bottom
      // But not if older messages were prepended (fetchOlderMessages)
      const oldFirst = prevMessageCount.current > 0;
      if (oldFirst) {
        // Check if the new messages are at the end (new message) vs start (older loaded)
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }

    prevMessageCount.current = messages.length;
  }, [messages, isFetchingMore]);

  // Reset on conversation change
  useEffect(() => {
    isInitialLoad.current = true;
    prevMessageCount.current = 0;
  }, [conversationId]);

  // Mark as read when viewing
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      markAsRead();
    }
  }, [conversationId, messages.length, markAsRead]);

  const scrollToMessage = useCallback((messageId: string) => {
    const el = messageRefs.current.get(messageId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bg-accent/30");
      setTimeout(() => el.classList.remove("bg-accent/30"), 1500);
    }
  }, []);

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatMessageDate = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "MMMM d, yyyy");
  };

  const shouldShowDateDivider = (message: ChatMessage, index: number) => {
    if (index === 0) return true;
    const prevMessage = messages[index - 1];
    return !isSameDay(new Date(message.created_at), new Date(prevMessage.created_at));
  };

  const shouldShowAvatar = (message: ChatMessage, index: number) => {
    if (index === messages.length - 1) return true;
    const nextMessage = messages[index + 1];
    return nextMessage.sender_id !== message.sender_id;
  };

  const truncate = (text: string | null, len = 60) => {
    if (!text) return "";
    return text.length > len ? text.slice(0, len) + "…" : text;
  };

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">Select a conversation</p>
          <p className="text-sm">Choose a conversation to start messaging</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">No messages yet</p>
          <p className="text-sm">Send the first message to start the conversation</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 p-4" ref={scrollRef}>
      <div className="space-y-4">
        {/* Load older messages */}
        {hasMore && (
          <div className="flex justify-center py-2">
            <button
              onClick={fetchOlderMessages}
              disabled={isFetchingMore}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {isFetchingMore ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Load older messages"
              )}
            </button>
          </div>
        )}

        {messages.map((message, index) => {
          const isOwnMessage = message.sender_id === currentUserId;
          const showDateDivider = shouldShowDateDivider(message, index);
          const showAvatar = shouldShowAvatar(message, index);

          return (
            <div
              key={message.id}
              ref={(el) => {
                if (el) messageRefs.current.set(message.id, el);
              }}
              className="transition-colors duration-500 rounded-lg"
            >
              {showDateDivider && (
                <div className="flex items-center justify-center my-4">
                  <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                    {formatMessageDate(new Date(message.created_at))}
                  </div>
                </div>
              )}

              <div
                className={cn(
                  "flex gap-2 group",
                  isOwnMessage ? "flex-row-reverse" : "flex-row"
                )}
              >
                {!isOwnMessage && (
                  <div className="w-8">
                    {showAvatar && (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={message.sender?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(message.sender?.full_name || null)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                )}

                <div
                  className={cn(
                    "max-w-[70%] space-y-1",
                    isOwnMessage ? "items-end" : "items-start"
                  )}
                >
                  {!isOwnMessage && showAvatar && (
                    <span className="text-xs text-muted-foreground ml-1">
                      {message.sender?.full_name || "Unknown"}
                    </span>
                  )}

                  {/* Quoted reply block */}
                  {message.reply_to && !Array.isArray(message.reply_to) && (
                    <button
                      onClick={() => scrollToMessage(message.reply_to!.id)}
                      className={cn(
                        "w-full text-left rounded-t-xl px-3 py-1.5 border-l-2 border-primary/50 text-xs",
                        isOwnMessage ? "bg-primary/20 text-primary-foreground/70" : "bg-muted/80"
                      )}
                    >
                      <span className="font-medium block">
                        {message.reply_to.sender?.full_name || "Unknown"}
                      </span>
                      <span className="text-muted-foreground">
                        {message.reply_to.message_type === "file"
                          ? "📎 File"
                          : truncate(message.reply_to.content)}
                      </span>
                    </button>
                  )}

                  <div className="relative">
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2",
                        message.reply_to && "rounded-t-md",
                        isOwnMessage
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted rounded-bl-md"
                      )}
                    >
                      {message.message_type === "text" && (
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                      )}

                      {message.message_type === "task_share" && message.task && (
                        <TaskShareCard task={message.task} isOwnMessage={isOwnMessage} />
                      )}

                      {message.message_type === "task_share" && message.project_task && (
                        <TaskShareCard
                          task={message.project_task}
                          isOwnMessage={isOwnMessage}
                          projectName={message.project_task.project?.project_name}
                        />
                      )}

                      {message.message_type === "file" && (() => {
                        const ext = message.file_name?.split('.').pop()?.toLowerCase() || '';
                        const isMedia = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext);
                        if (isMedia) return null;
                        return (
                          <FileAttachment
                            fileName={message.file_name || "File"}
                            fileSize={message.file_size || 0}
                            fileUrl={message.file_url || ""}
                            isOwnMessage={isOwnMessage}
                          />
                        );
                      })()}
                    </div>

                    {/* Media attachments outside bubble */}
                    {message.message_type === "file" && (() => {
                      const ext = message.file_name?.split('.').pop()?.toLowerCase() || '';
                      const isMedia = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext);
                      if (!isMedia) return null;
                      return (
                        <FileAttachment
                          fileName={message.file_name || "File"}
                          fileSize={message.file_size || 0}
                          fileUrl={message.file_url || ""}
                          isOwnMessage={isOwnMessage}
                        />
                      );
                    })()}

                    {/* Action bar on hover: reaction, reply, forward */}
                    <div
                      className={cn(
                        "absolute top-0 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
                        isOwnMessage ? "left-0 -translate-x-full pr-1" : "right-0 translate-x-full pl-1"
                      )}
                    >
                      <TooltipProvider delayDuration={300}>
                        {onReply && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => onReply(message)}
                                className="p-1 rounded-full hover:bg-muted transition-colors"
                              >
                                <Reply className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">Reply</TooltipContent>
                          </Tooltip>
                        )}
                        {onForward && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => onForward(message)}
                                className="p-1 rounded-full hover:bg-muted transition-colors"
                              >
                                <Forward className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">Forward</TooltipContent>
                          </Tooltip>
                        )}
                      </TooltipProvider>
                      <ReactionPicker
                        onReact={(emoji) => toggleReaction(message.id, emoji, currentUserId)}
                      />
                    </div>
                  </div>

                  {/* Reactions display */}
                  <MessageReactions
                    reactions={getGroupedReactions(message.id, currentUserId)}
                    onToggleReaction={(emoji) => toggleReaction(message.id, emoji, currentUserId)}
                    isOwnMessage={isOwnMessage}
                  />

                  {/* Read receipts */}
                  <ReadReceipts
                    readByUsers={getMessageReadReceipts(
                      message.id,
                      message.created_at,
                      message.sender_id,
                      messages
                    )}
                    isOwnMessage={isOwnMessage}
                  />

                  <span
                    className={cn(
                      "text-[10px] text-muted-foreground",
                      isOwnMessage ? "text-right mr-1" : "ml-1"
                    )}
                  >
                    {format(new Date(message.created_at), "h:mm a")}
                    {message.is_edited && " • Edited"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
