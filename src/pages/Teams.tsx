import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit, Trash2, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PaginationControls } from "@/components/ui/pagination-controls";

interface Team {
  id: string;
  name: string;
  description: string | null;
  team_lead_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface TeamMember {
  id: string;
  user_id: string;
  role_in_team: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

export default function Teams() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    team_lead_id: "",
  });

  useEffect(() => {
    checkAuthAndFetchTeams();
  }, [currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage, searchQuery]);

  const checkAuthAndFetchTeams = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    await fetchTeams();
  };

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { count } = await supabase
        .from("teams")
        .select("*", { count: "exact", head: true });

      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      setTeams(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      toast.error(error.message || "Failed to load teams");
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async (teamId: string) => {
    try {
      const { data, error } = await supabase
        .from("team_members")
        .select("*")
        .eq("team_id", teamId)
        .eq("is_active", true);

      if (error) throw error;
      
      // Fetch profiles separately
      if (data && data.length > 0) {
        const userIds = data.map(m => m.user_id);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .neq("email", "a@in-sync.co.in")
          .in("id", userIds);
        
        const membersWithProfiles = data.map(member => ({
          ...member,
          profiles: profilesData?.find(p => p.id === member.user_id) || { full_name: "", email: "" }
        }));
        
        setTeamMembers(membersWithProfiles);
      } else {
        setTeamMembers([]);
      }
      
      setMembersDialogOpen(true);
    } catch (error: any) {
      toast.error("Failed to load team members");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const dataToSave = {
        ...formData,
        team_lead_id: formData.team_lead_id || null
      };

      if (selectedTeam) {
        const { error } = await supabase
          .from("teams")
          .update(dataToSave)
          .eq("id", selectedTeam.id);

        if (error) throw error;
        toast.success("Team updated successfully");
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from("teams")
          .insert([{ ...dataToSave, created_by: user?.id }]);

        if (error) throw error;
        toast.success("Team created successfully");
      }

      setDialogOpen(false);
      setFormData({ name: "", description: "", team_lead_id: "" });
      setSelectedTeam(null);
      fetchTeams();
    } catch (error: any) {
      toast.error(error.message || "Failed to save team");
    }
  };

  const handleEdit = (team: Team) => {
    setSelectedTeam(team);
    setFormData({
      name: team.name,
      description: team.description || "",
      team_lead_id: team.team_lead_id || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this team?")) return;

    try {
      const { error } = await supabase
        .from("teams")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Team deleted successfully");
      fetchTeams();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete team");
    }
  };

  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-1">Teams</h2>
        <p className="text-sm text-muted-foreground">Organize users into collaborative teams</p>
      </div>

      <Card className="glass-card mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Management</CardTitle>
              <CardDescription>Create and manage organizational teams</CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setSelectedTeam(null);
                  setFormData({ name: "", description: "", team_lead_id: "" });
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Team
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>{selectedTeam ? "Edit Team" : "Create New Team"}</DialogTitle>
                    <DialogDescription>
                      {selectedTeam ? "Update team information" : "Add a new team to your organization"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="name">Team Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {selectedTeam ? "Update" : "Create"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search teams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No teams found</p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Team
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell>{team.description || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={team.is_active ? "default" : "secondary"}>
                        {team.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(team.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => fetchTeamMembers(team.id)}
                        >
                          <UsersIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(team)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(team.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {filteredTeams.length > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={Math.ceil(totalCount / itemsPerPage)}
              totalItems={totalCount}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          )}
        </CardContent>
      </Card>

      {/* Team Members Dialog */}
      <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Team Members</DialogTitle>
            <DialogDescription>View team member list</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {teamMembers.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No members in this team</p>
            ) : (
              teamMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <p className="font-medium">{member.profiles?.full_name || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">{member.profiles?.email}</p>
                  </div>
                  <Badge variant="outline">{member.role_in_team}</Badge>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
