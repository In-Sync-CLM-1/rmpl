import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { UserPlus, X } from "lucide-react";

interface Participant {
  user_id: string;
  is_admin: boolean | null;
  profile: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface GroupParticipantsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participants: Participant[];
  creatorId: string | null;
  currentUserId: string;
  canManage: boolean;
  onRemove: (userId: string) => void;
  onAddMembers: () => void;
  isRemoving: boolean;
}

export function GroupParticipantsSheet({
  open,
  onOpenChange,
  participants,
  creatorId,
  currentUserId,
  canManage,
  onRemove,
  onAddMembers,
  isRemoving,
}: GroupParticipantsSheetProps) {
  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Group Participants</SheetTitle>
          <SheetDescription>
            {participants.length} member{participants.length !== 1 ? "s" : ""} in this group
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-200px)] mt-4">
          <div className="space-y-2">
            {participants.map((p) => (
              <div
                key={p.user_id}
                className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {p.profile?.avatar_url && (
                      <AvatarImage src={p.profile.avatar_url} />
                    )}
                    <AvatarFallback>
                      {getInitials(p.profile?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">
                      {p.profile?.full_name || "Unknown User"}
                      {p.user_id === currentUserId && (
                        <span className="text-muted-foreground ml-1">(You)</span>
                      )}
                    </p>
                    <div className="flex gap-1 mt-0.5">
                      {p.user_id === creatorId && (
                        <Badge variant="secondary" className="text-xs">
                          Creator
                        </Badge>
                      )}
                      {p.is_admin && p.user_id !== creatorId && (
                        <Badge variant="outline" className="text-xs">
                          Admin
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {canManage && p.user_id !== currentUserId && p.user_id !== creatorId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemove(p.user_id)}
                    disabled={isRemoving}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {canManage && (
          <SheetFooter className="mt-4">
            <Button onClick={onAddMembers} className="w-full">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Members
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
