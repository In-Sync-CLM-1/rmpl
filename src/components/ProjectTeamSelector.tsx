import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

interface ProjectTeamSelectorProps {
  value: Array<{ user_id: string; role_in_project: string }>;
  onChange: (value: Array<{ user_id: string; role_in_project: string }>) => void;
}

export const ProjectTeamSelector = ({ value, onChange }: ProjectTeamSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("all");

  // Fetch teams
  const { data: teams } = useQuery({
    queryKey: ["teams-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch users with their team information
  const { data: users } = useQuery({
    queryKey: ["users-for-team"],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .neq("email", "a@in-sync.co.in")
        .order("full_name");
      
      if (profilesError) throw profilesError;

      // Get team memberships
      const { data: teamMemberships, error: teamError } = await supabase
        .from("team_members")
        .select(`
          user_id,
          team_id,
          teams(id, name)
        `)
        .eq("is_active", true);
      
      if (teamError) throw teamError;

      // Combine profiles with their teams
      return profiles?.map(profile => ({
        ...profile,
        teams: teamMemberships?.filter(tm => tm.user_id === profile.id) || []
      })) || [];
    },
  });

  const filteredUsers = users?.filter((user) => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTeam = selectedTeamId === "all" || 
      (user.teams as any)?.some((tm: any) => tm.team_id === selectedTeamId);
    
    return matchesSearch && matchesTeam;
  });

  const isSelected = (userId: string) => {
    return value.some((member) => member.user_id === userId);
  };

  const getMemberRole = (userId: string) => {
    return value.find((member) => member.user_id === userId)?.role_in_project || "member";
  };

  const toggleUser = (userId: string) => {
    if (isSelected(userId)) {
      onChange(value.filter((member) => member.user_id !== userId));
    } else {
      onChange([...value, { user_id: userId, role_in_project: "member" }]);
    }
  };

  const updateRole = (userId: string, role: string) => {
    onChange(
      value.map((member) =>
        member.user_id === userId ? { ...member, role_in_project: role } : member
      )
    );
  };

  return (
    <div className="space-y-4">
      {/* Selected Team Members Display */}
      {value.length > 0 && (
        <div className="border rounded-lg p-4 bg-muted/30">
          <Label className="text-base font-semibold mb-3 block">Selected Team Members ({value.length})</Label>
          <div className="flex flex-wrap gap-2">
            {value.map((member) => {
              const user = users?.find(u => u.id === member.user_id);
              return (
                <div key={member.user_id} className="flex items-center gap-2 bg-background border rounded-lg px-3 py-2 shadow-sm">
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{user?.full_name || "Unknown"}</span>
                    <span className="text-xs text-muted-foreground capitalize">{member.role_in_project}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleUser(member.user_id)}
                    className="ml-2 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Filter by Team</Label>
          <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
            <SelectTrigger>
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams?.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Search Team Members</Label>
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      <div className="max-h-80 overflow-y-auto space-y-2 border rounded-lg p-4">
        {filteredUsers?.map((user) => {
          const isAssigned = isSelected(user.id);
          return (
            <div 
              key={user.id} 
              className={`flex items-center justify-between gap-4 p-2 rounded-lg transition-colors ${
                isAssigned 
                  ? "bg-primary/10 border border-primary/20" 
                  : "hover:bg-accent"
              }`}
            >
              <div className="flex items-center gap-3 flex-1">
                <Checkbox
                  checked={isAssigned}
                  onCheckedChange={() => toggleUser(user.id)}
                />
                <div className="flex-1">
                  <p className="font-medium">{user.full_name || "No Name"}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>
              {isAssigned && (
                <Select
                  value={getMemberRole(user.id)}
                  onValueChange={(role) => updateRole(user.id, role)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="consultant">Consultant</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
