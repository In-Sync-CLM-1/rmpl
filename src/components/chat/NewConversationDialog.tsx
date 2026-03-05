import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConversations } from "@/hooks/useConversations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, User, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (id: string) => void;
}

export function NewConversationDialog({
  open,
  onOpenChange,
  onConversationCreated,
}: NewConversationDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [teamSearchQuery, setTeamSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [activeTab, setActiveTab] = useState("direct");
  const { createConversation } = useConversations();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users-for-chat", searchQuery],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .neq("id", user.id)
        .order("full_name");

      if (searchQuery) {
        query = query.ilike("full_name", `%${searchQuery}%`);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ["teams-for-broadcast"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select(`
          id,
          name,
          description,
          team_members!inner(user_id)
        `)
        .eq("is_active", true)
        .eq("team_members.is_active", true)
        .order("name");

      if (error) throw error;

      // Group by team and count unique members
      const teamMap = new Map<string, { id: string; name: string; description: string | null; memberCount: number }>();
      data.forEach(team => {
        if (!teamMap.has(team.id)) {
          teamMap.set(team.id, {
            id: team.id,
            name: team.name,
            description: team.description,
            memberCount: 0
          });
        }
        teamMap.get(team.id)!.memberCount++;
      });
      
      return Array.from(teamMap.values());
    },
    enabled: open && activeTab === "teams",
  });

  const filteredTeams = useMemo(() => 
    teams.filter(team => 
      team.name.toLowerCase().includes(teamSearchQuery.toLowerCase())
    ), [teams, teamSearchQuery]
  );

  const handleUserToggle = (userId: string) => {
    if (activeTab === "direct") {
      setSelectedUsers([userId]);
    } else {
      setSelectedUsers((prev) =>
        prev.includes(userId)
          ? prev.filter((id) => id !== userId)
          : [...prev, userId]
      );
    }
  };

  const handleTeamSelect = async (teamId: string, teamName: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: members, error } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", teamId)
        .eq("is_active", true);

      if (error) throw error;

      // Exclude current user (they'll be added as creator)
      const memberIds = members
        ?.map(m => m.user_id)
        .filter(id => id !== user?.id) || [];

      if (memberIds.length === 0) {
        toast.error("No other members in this team");
        return;
      }

      setSelectedUsers(memberIds);
      setGroupName(teamName);
      setActiveTab("group");
      toast.info(`Group populated with ${memberIds.length} members from "${teamName}"`);
    } catch (error) {
      console.error("Failed to fetch team members:", error);
      toast.error("Failed to load team members");
    }
  };

  const handleCreate = async () => {
    if (selectedUsers.length === 0) {
      toast.error("Please select at least one user");
      return;
    }

    if (activeTab === "group" && !groupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    try {
      const conversationId = await createConversation.mutateAsync({
        participantIds: selectedUsers,
        name: activeTab === "group" ? groupName : undefined,
        type: activeTab as "direct" | "group",
      });

      toast.success(
        activeTab === "direct"
          ? "Conversation started"
          : "Group created successfully"
      );
      onConversationCreated(conversationId);
      resetForm();
    } catch (error) {
      console.error("Failed to create conversation:", error);
      toast.error("Failed to create conversation");
    }
  };

  const resetForm = () => {
    setSearchQuery("");
    setTeamSearchQuery("");
    setSelectedUsers([]);
    setGroupName("");
    setActiveTab("direct");
  };

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="direct" className="gap-2">
              <User className="h-4 w-4" />
              Direct
            </TabsTrigger>
            <TabsTrigger value="group" className="gap-2">
              <Users className="h-4 w-4" />
              Group
            </TabsTrigger>
            <TabsTrigger value="teams" className="gap-2">
              <Users className="h-4 w-4" />
              Teams
            </TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-[300px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No users found
                </div>
              ) : (
                <div className="space-y-1">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleUserToggle(user.id)}
                      className={`w-full p-3 rounded-lg flex items-center gap-3 transition-colors ${
                        selectedUsers.includes(user.id)
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      }`}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback>
                          {getInitials(user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">
                        {user.full_name || "Unknown"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="group" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                placeholder="Enter group name..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-[250px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-1">
                  {users.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedUsers.includes(user.id)}
                        onCheckedChange={() => handleUserToggle(user.id)}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback>
                          {getInitials(user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">
                        {user.full_name || "Unknown"}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>

            {selectedUsers.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedUsers.length} user(s) selected
              </p>
            )}
          </TabsContent>

          <TabsContent value="teams" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search teams..."
                value={teamSearchQuery}
                onChange={(e) => setTeamSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-[300px]">
              {teamsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTeams.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No teams found
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTeams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => handleTeamSelect(team.id, team.name)}
                      className="w-full p-3 rounded-lg border hover:bg-muted transition-colors text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{team.name}</p>
                          {team.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {team.description}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary" className="ml-2 gap-1 shrink-0">
                          <Users className="h-3 w-3" />
                          {team.memberCount}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={
              selectedUsers.length === 0 ||
              (activeTab === "group" && !groupName.trim()) ||
              createConversation.isPending
            }
          >
            {createConversation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {activeTab === "direct" ? "Start Chat" : "Create Group"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
