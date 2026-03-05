import { useState } from "react";
import { Conversation } from "@/hooks/useConversations";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, Users, MoreVertical, UserPlus, LogOut } from "lucide-react";
import { GroupParticipantsSheet } from "./GroupParticipantsSheet";
import { AddParticipantsDialog } from "./AddParticipantsDialog";
import { useGroupParticipants } from "@/hooks/useGroupParticipants";

interface ChatHeaderProps {
  conversation: Conversation | null;
  currentUserId: string;
  onBack?: () => void;
  showBackButton?: boolean;
  onLeaveGroup?: () => void;
}

export function ChatHeader({
  conversation,
  currentUserId,
  onBack,
  showBackButton,
  onLeaveGroup,
}: ChatHeaderProps) {
  const [showParticipants, setShowParticipants] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);

  const { addParticipants, removeParticipant, leaveGroup } = useGroupParticipants(
    conversation?.id || null
  );

  if (!conversation) {
    return (
      <div className="h-16 border-b flex items-center px-4">
        <span className="text-muted-foreground">Select a conversation</span>
      </div>
    );
  }

  const isCreator = conversation.created_by === currentUserId;
  const currentParticipant = conversation.participants?.find(
    (p) => p.user_id === currentUserId
  );
  const isAdmin = currentParticipant?.is_admin || false;
  const canManage = isCreator || isAdmin;
  const isGroup = conversation.conversation_type === "group";

  const getConversationName = () => {
    if (conversation.name) return conversation.name;

    const otherParticipants =
      conversation.participants?.filter((p) => p.user_id !== currentUserId) || [];

    if (otherParticipants.length === 0) return "No participants";

    return otherParticipants
      .map((p) => p.profile?.full_name || "Unknown")
      .join(", ");
  };

  const getConversationAvatar = () => {
    if (conversation.conversation_type === "group") {
      return null;
    }

    const otherParticipant = conversation.participants?.find(
      (p) => p.user_id !== currentUserId
    );
    return otherParticipant?.profile?.avatar_url;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getParticipantCount = () => {
    return conversation.participants?.length || 0;
  };

  const handleLeaveGroup = async () => {
    await leaveGroup.mutateAsync();
    onLeaveGroup?.();
  };

  const handleRemoveParticipant = async (userId: string) => {
    await removeParticipant.mutateAsync(userId);
  };

  const handleAddParticipants = async (userIds: string[]) => {
    await addParticipants.mutateAsync(userIds);
    setShowAddMembers(false);
  };

  const existingParticipantIds =
    conversation.participants?.map((p) => p.user_id) || [];

  const name = getConversationName();
  const avatarUrl = getConversationAvatar();

  return (
    <>
      <div className="h-16 border-b flex items-center justify-between px-4 bg-background">
        <div className="flex items-center gap-3">
          {showBackButton && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}

          <Avatar className="h-10 w-10">
            {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
            <AvatarFallback>
              {conversation.conversation_type === "group" ? (
                <Users className="h-5 w-5" />
              ) : (
                getInitials(name)
              )}
            </AvatarFallback>
          </Avatar>

          <div>
            <h3 className="font-semibold">{name}</h3>
            {isGroup && (
              <p className="text-xs text-muted-foreground">
                {getParticipantCount()} members
              </p>
            )}
          </div>
        </div>

        {isGroup && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowParticipants(true)}>
                <Users className="h-4 w-4 mr-2" />
                View Participants
              </DropdownMenuItem>
              {canManage && (
                <DropdownMenuItem onClick={() => setShowAddMembers(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Members
                </DropdownMenuItem>
              )}
              {!isCreator && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={handleLeaveGroup}
                    disabled={leaveGroup.isPending}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Leave Group
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <GroupParticipantsSheet
        open={showParticipants}
        onOpenChange={setShowParticipants}
        participants={conversation.participants || []}
        creatorId={conversation.created_by}
        currentUserId={currentUserId}
        canManage={canManage}
        onRemove={handleRemoveParticipant}
        onAddMembers={() => {
          setShowParticipants(false);
          setShowAddMembers(true);
        }}
        isRemoving={removeParticipant.isPending}
      />

      <AddParticipantsDialog
        open={showAddMembers}
        onOpenChange={setShowAddMembers}
        existingParticipantIds={existingParticipantIds}
        onAdd={handleAddParticipants}
        isAdding={addParticipants.isPending}
      />
    </>
  );
}
