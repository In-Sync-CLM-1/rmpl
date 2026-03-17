import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Edit, Trash2, Plus, Upload, Filter, X, Eye, UserX, UserCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { getRoleVariant, getRoleDisplayName } from "@/lib/rolePermissions";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  reports_to: string | null;
  roles?: string[];
  is_active?: boolean;
  exit_date?: string | null;
  exit_reason?: string | null;
}

interface RoleMetadata {
  role: string;
  display_name: string;
  description: string;
  can_be_assigned_by: string[];
}

interface Designation {
  id: string;
  title: string;
  level: number | null;
}

interface UserDesignation {
  designation_id: string;
  designations: Designation;
}

interface UserTeam {
  team_id: string;
  teams: {
    id: string;
    name: string;
  };
}

interface Team {
  id: string;
  name: string;
}

export default function Users() {
  const navigate = useNavigate();
  const { permissions } = useUserPermissions();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [userDesignations, setUserDesignations] = useState<Record<string, UserDesignation[]>>({});
  const [userTeams, setUserTeams] = useState<Record<string, UserTeam[]>>({});
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [userRoles, setUserRoles] = useState<Record<string, string[]>>({});
  const [availableRoles, setAvailableRoles] = useState<RoleMetadata[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [adminPasswordForVerification, setAdminPasswordForVerification] = useState("");
  const [isVerifyingAdmin, setIsVerifyingAdmin] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedReportsTo, setSelectedReportsTo] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showExitedUsers, setShowExitedUsers] = useState(false);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [exitingUser, setExitingUser] = useState<User | null>(null);
  const [exitReason, setExitReason] = useState("");

  // Fallback roles in case role_metadata table query fails
  const getFallbackRoles = (userRole: string): RoleMetadata[] => {
    const allRoles: RoleMetadata[] = [
      { role: 'admin_administration', display_name: 'Administration Admin', description: 'Manages users, teams, HR', can_be_assigned_by: ['platform_admin', 'super_admin'] },
      { role: 'admin_tech', display_name: 'Tech Admin', description: 'Manages system config, integrations', can_be_assigned_by: ['platform_admin', 'super_admin'] },
      { role: 'admin', display_name: 'Admin', description: 'General administrative access', can_be_assigned_by: ['platform_admin', 'super_admin', 'admin_tech'] },
      { role: 'manager', display_name: 'Manager', description: 'Team lead, manages clients and jobs', can_be_assigned_by: ['platform_admin', 'super_admin', 'admin_administration', 'admin_tech'] },
      { role: 'agent', display_name: 'Agent', description: 'Regular user, handles participants', can_be_assigned_by: ['platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'manager'] },
      { role: 'user', display_name: 'User', description: 'Basic access (legacy)', can_be_assigned_by: ['platform_admin', 'super_admin', 'admin_administration', 'admin_tech'] },
    ];
    
    return allRoles.filter(r => r.can_be_assigned_by.includes(userRole));
  };
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    designation_id: "",
    reports_to: "",
    team_id: "",
    role: "",
  });

  useEffect(() => {
    checkAuthAndFetchUsers();
  }, [currentPage, itemsPerPage]);

  const checkAuthAndFetchUsers = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setSession(session);
    
    // Get current user's highest role
    const { data: myRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);
    
    // Determine highest privilege role
    const roleHierarchy = ['platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'admin', 'manager', 'agent', 'user'];
    const myHighestRole = myRoles?.find(r => roleHierarchy.includes(r.role))?.role || 'user';
    setCurrentUserRole(myHighestRole);
    
    // Check if user has admin privileges
    const adminRoles = ['platform_admin', 'super_admin', 'admin_administration', 'admin_tech'];
    const hasAdminAccess = myRoles?.some(r => adminRoles.includes(r.role)) || false;
    setIsAdmin(hasAdminAccess);
    
    // Fetch role metadata to determine what roles can be assigned
    const { data: roleMetadata, error: roleError } = await supabase
      .from("role_metadata" as any)
      .select("*")
      .eq("is_visible_in_ui", true)
      .order("hierarchy_level", { ascending: true });
    
    if (roleError) {
      console.error("Error fetching role metadata:", roleError);
      toast.error("Using fallback roles");
    }
    
    if (roleMetadata && roleMetadata.length > 0) {
      const assignableRoles = (roleMetadata as any)?.filter((rm: any) => 
        rm.can_be_assigned_by?.includes(myHighestRole)
      ) || [];
      
      // If no roles found from metadata, use fallback
      if (assignableRoles.length === 0 && myHighestRole) {
        const fallbackRoles = getFallbackRoles(myHighestRole);
        setAvailableRoles(fallbackRoles);
      } else {
        setAvailableRoles(assignableRoles as RoleMetadata[]);
      }
    } else if (myHighestRole) {
      // Use fallback roles if metadata fetch failed or returned empty
      const fallbackRoles = getFallbackRoles(myHighestRole);
      setAvailableRoles(fallbackRoles);
    }
    
    await fetchUsers();
  };

  const fetchUsers = async () => {
    try {
      // If team filter is active, get user IDs from team_members first
      let teamFilteredUserIds: string[] | null = null;
      if (selectedTeams.length > 0) {
        const { data: teamMembersData } = await supabase
          .from("team_members")
          .select("user_id")
          .in("team_id", selectedTeams)
          .eq("is_active", true);
        
        teamFilteredUserIds = teamMembersData?.map(tm => tm.user_id) || [];
        
        // If no users found in selected teams, return early
        if (teamFilteredUserIds.length === 0) {
          setUsers([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
      }

      // When searching, show all results; otherwise paginate
      const from = isSearchActive ? 0 : (currentPage - 1) * itemsPerPage;
      const to = isSearchActive ? 999 : from + itemsPerPage - 1;

      // Build the base query
      let countQuery = supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .neq("email", "a@in-sync.co.in")
        .eq("is_active", !showExitedUsers);
      
      let dataQuery = supabase
        .from("profiles")
        .select("*")
        .neq("email", "a@in-sync.co.in")
        .eq("is_active", !showExitedUsers);

      // Apply team filter at database level
      if (teamFilteredUserIds) {
        countQuery = countQuery.in("id", teamFilteredUserIds);
        dataQuery = dataQuery.in("id", teamFilteredUserIds);
      }

      // Apply search filter if searchQuery exists
      if (searchQuery.trim()) {
        const searchFilter = `full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`;
        countQuery = countQuery.or(searchFilter);
        dataQuery = dataQuery.or(searchFilter);
      }

      // Apply reports_to filter if selected
      if (selectedReportsTo.length > 0) {
        countQuery = countQuery.in("reports_to", selectedReportsTo);
        dataQuery = dataQuery.in("reports_to", selectedReportsTo);
      }

      // Get count with all filters applied
      const { count } = await countQuery;

      // Get data with search filter, ordering, and pagination
      const { data, error } = await dataQuery
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      
      setUsers(data || []);
      setTotalCount(count || 0);
      
      // Fetch user roles
      const userIds = data?.map(u => u.id) || [];
      if (userIds.length > 0) {
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds);
        
        const rolesMap: Record<string, string[]> = {};
        rolesData?.forEach(r => {
          if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
          rolesMap[r.user_id].push(r.role);
        });
        setUserRoles(rolesMap);
      }
      
      // Fetch designations
      const { data: designationsData } = await supabase
        .from("designations")
        .select("id, title, level")
        .eq("is_active", true)
        .order("level", { ascending: false });
      setDesignations(designationsData || []);
      
      // Fetch user designations
      const { data: userDesData } = await supabase
        .from("user_designations")
        .select("user_id, designation_id, designations(id, title, level)")
        .eq("is_current", true);
      
      const userDesMap: Record<string, UserDesignation[]> = {};
      userDesData?.forEach((ud: any) => {
        if (!userDesMap[ud.user_id]) {
          userDesMap[ud.user_id] = [];
        }
        userDesMap[ud.user_id].push(ud);
      });
      setUserDesignations(userDesMap);
      
      // Fetch user teams for display (not filtering)
      const { data: userTeamsData } = await supabase
        .from("team_members")
        .select(`
          team_id,
          user_id,
          teams:team_id (
            id,
            name
          )
        `)
        .eq("is_active", true);

      const userTeamsMap: Record<string, UserTeam[]> = {};
      userTeamsData?.forEach((ut: any) => {
        if (!userTeamsMap[ut.user_id]) {
          userTeamsMap[ut.user_id] = [];
        }
        userTeamsMap[ut.user_id].push({
          team_id: ut.team_id,
          teams: ut.teams
        });
      });
      setUserTeams(userTeamsMap);

      // Fetch all users for reporting hierarchy dropdown (exclude platform admin)
      const { data: allUsersData } = await supabase
        .from("profiles")
        .select("*")
        .neq("email", "a@in-sync.co.in")
        .order("full_name");
      setAllUsers(allUsersData || []);
      
      // Fetch all teams
      const { data: teamsData } = await supabase
        .from("teams")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      setTeams(teamsData || []);
    } catch (error: any) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const isSearching = searchQuery.trim().length > 0;
    const isFiltering = selectedTeams.length > 0 || selectedReportsTo.length > 0;
    setIsSearchActive(isSearching || isFiltering);
    if (isSearching || isFiltering) {
      // When searching or filtering, show all results
      fetchUsers();
    } else {
      // When not searching, reset to page 1
      setCurrentPage(1);
    }
  }, [searchQuery, selectedTeams, selectedReportsTo]);

  useEffect(() => {
    fetchUsers();
  }, [showExitedUsers]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  /**
   * Verify admin's identity by checking their current password
   * Returns true if authentication successful, false otherwise
   */
  const verifyAdminPassword = async (password: string): Promise<boolean> => {
    try {
      setIsVerifyingAdmin(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.email) {
        toast.error("No active session found");
        return false;
      }

      // Re-authenticate by attempting to sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: password,
      });

      if (error || !data.user) {
        toast.error("Invalid password. Please try again.");
        return false;
      }

      return true;
    } catch (error) {
      console.error("Admin verification error:", error);
      toast.error("Failed to verify admin credentials");
      return false;
    } finally {
      setIsVerifyingAdmin(false);
    }
  };

  /**
   * Log password reset action to audit table
   */
  const logPasswordReset = async (
    targetUserId: string,
    targetEmail: string,
    targetFullName: string,
    status: 'success' | 'failed',
    failureReason?: string
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', session.user.id)
        .maybeSingle();

      await supabase.from('password_reset_logs').insert({
        admin_user_id: session.user.id,
        target_user_id: targetUserId,
        admin_email: adminProfile?.email || session.user.email || 'unknown',
        target_email: targetEmail,
        admin_full_name: adminProfile?.full_name || 'Unknown Admin',
        target_full_name: targetFullName,
        action_status: status,
        failure_reason: failureReason || null,
      });
    } catch (error) {
      console.error("Failed to log password reset:", error);
      // Don't block the operation if logging fails
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      // Validate required fields
      if (!formData.full_name) {
        toast.error("Full Name is required");
        return;
      }
      
      if (!formData.email) {
        toast.error("Email is required");
        return;
      }
      
      if (!formData.phone) {
        toast.error("Phone is required");
        return;
      }
      
      // Reports To is optional for admin roles, required for others
      const adminRoles = ['platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'admin'];
      const isAdminRole = adminRoles.includes(formData.role);

      if (!formData.reports_to && !isAdminRole) {
        toast.error("Reports To is required for non-admin roles");
        return;
      }
      
      if (!formData.role) {
        toast.error("Role is required");
        return;
      }
      
      if (isCreating) {
        // Create new user
        if (!formData.password) {
          toast.error("Password is required");
          return;
        }

        const { data: createData, error: createError } = await supabase.functions.invoke(
          'admin-create-user',
          {
            body: {
              email: formData.email,
              password: formData.password,
              full_name: formData.full_name,
              role: formData.role,
              designation_id: formData.designation_id || null,
              reports_to: formData.reports_to || null,
              team_id: formData.team_id || null,
              phone: formData.phone || null
            }
          }
        );

        if (createError || !createData?.success) {
          const errorMsg = createError?.message || createData?.error || 'Unknown error';
          console.error("User creation error:", errorMsg);
          throw new Error(errorMsg);
        }
        
        toast.success("User created successfully");
      } else {
        // Update existing user
        if (!selectedUser) {
          toast.error("Please select a user to edit");
          return;
        }

        // ===== PASSWORD RESET WITH RE-AUTHENTICATION =====
        const isEditingSelf = selectedUser.id === session?.user?.id;
        
        if (showPasswordReset && formData.password) {
          // Validate password length
          if (formData.password.length < 6) {
            toast.error("Password must be at least 6 characters");
            if (!isEditingSelf) {
              await logPasswordReset(
                selectedUser.id,
                selectedUser.email,
                selectedUser.full_name || 'Unknown',
                'failed',
                'Password too short (< 6 characters)'
              );
            }
            return;
          }

          if (isEditingSelf) {
            // Self-service password change - use direct Supabase Auth update
            const { error: passwordError } = await supabase.auth.updateUser({
              password: formData.password
            });

            if (passwordError) {
              console.error("Password update error:", passwordError);
              toast.error("Failed to update password: " + passwordError.message);
              return;
            }

            toast.success("Your password has been updated successfully");
          } else {
            // Admin resetting another user's password - requires verification
            
            // Verify admin password
            if (!adminPasswordForVerification) {
              toast.error("Please enter your admin password to confirm");
              return;
            }

            const isVerified = await verifyAdminPassword(adminPasswordForVerification);
            
            if (!isVerified) {
              await logPasswordReset(
                selectedUser.id,
                selectedUser.email,
                selectedUser.full_name || 'Unknown',
                'failed',
                'Admin password verification failed'
              );
              return;
            }

            // Update the target user's password via edge function
            const { data: resetData, error: resetError } = await supabase.functions.invoke(
              'admin-reset-password',
              {
                body: {
                  targetUserId: selectedUser.id,
                  newPassword: formData.password,
                  adminPassword: adminPasswordForVerification
                }
              }
            );

            if (resetError || !resetData?.success) {
              const errorMsg = resetError?.message || resetData?.error || 'Unknown error';
              console.error("Password reset error:", errorMsg);
              toast.error("Failed to update password: " + errorMsg);
              return;
            }

            toast.success("Password updated successfully and logged");
            
            // Clear admin password field
            setAdminPasswordForVerification("");
          }
        }
        // ===== END PASSWORD RESET SECTION =====

        // Update email if changed
        if (formData.email !== selectedUser.email) {
          const { error: emailError } = await supabase.auth.admin.updateUserById(
            selectedUser.id,
            { email: formData.email }
          );
          if (emailError) throw emailError;
        }

        const { error } = await supabase
          .from("profiles")
          .update({
            email: formData.email,
            full_name: formData.full_name,
            phone: formData.phone,
            reports_to: formData.reports_to,
          })
          .eq("id", selectedUser.id);

        if (error) throw error;
        
        // Update user role
        const currentRole = userRoles[selectedUser.id]?.[0];
        if (formData.role && formData.role !== currentRole) {
          // Delete all existing roles
          await supabase
            .from("user_roles")
            .delete()
            .eq("user_id", selectedUser.id);
          
          // Insert new role
          await supabase
            .from("user_roles")
            .insert({
              user_id: selectedUser.id,
              role: formData.role as any
            });
        }
        
        // Use edge function to update designation and team with service role permissions
        const { data: updateData, error: updateError } = await supabase.functions.invoke('update-user-profile', {
          body: {
            user_id: selectedUser.id,
            full_name: formData.full_name,
            email: formData.email,
            phone: formData.phone,
            reports_to: formData.reports_to || null,
            designation_id: formData.designation_id || null,
            team_id: formData.team_id || null,
          }
        });

        if (updateError) {
          console.error('Error updating user profile:', updateError);
          throw new Error(updateError.message || 'Failed to update user profile');
        }
        
        if (!updateData?.success) {
          throw new Error('Failed to update user profile');
        }
        
        toast.success("User updated successfully");
      }
      
      // Close dialog and reset state immediately
      setDialogOpen(false);
      setFormData({ email: "", password: "", full_name: "", phone: "", designation_id: "", reports_to: "", team_id: "", role: "" });
      setSelectedUser(null);
      setIsCreating(false);
      
      // Then refresh data
      await fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to save user");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async (user: User) => {
    setSelectedUser(user);
    setIsCreating(false);
    setShowPasswordReset(false);
    setAdminPasswordForVerification("");
    
    // Query fresh designation and team data from database
    const { data: currentDesignationData } = await supabase
      .from("user_designations")
      .select("designation_id")
      .eq("user_id", user.id)
      .eq("is_current", true)
      .maybeSingle();
    
    const { data: currentTeamData } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    
    const currentDesignation = currentDesignationData?.designation_id || "";
    const currentTeam = currentTeamData?.team_id || "";
    
    // Get the highest priority role to display in the edit form
    const userRolesList = userRoles[user.id] || [];
    const roleHierarchy = ['platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'admin', 'manager', 'agent', 'user', 'client'];
    const currentRole = userRolesList.find(r => roleHierarchy.includes(r)) || userRolesList[0] || "";
    
    setFormData({
      email: user.email,
      password: "",
      full_name: user.full_name || "",
      phone: user.phone || "",
      designation_id: currentDesignation,
      reports_to: user.reports_to || "",
      team_id: currentTeam,
      role: currentRole,
    });
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedUser(null);
    setIsCreating(true);
    setFormData({
      email: "",
      password: "",
      full_name: "",
      phone: "",
      designation_id: "",
      reports_to: "",
      team_id: "",
      role: "agent",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-delete-users', {
        body: { userIds: [id] }
      });

      if (error) throw error;

      if (data?.successCount > 0) {
        toast.success("User deleted successfully");
        fetchUsers();
      } else if (data?.errors?.length > 0) {
        toast.error(data.errors[0].error || "Failed to delete user");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to delete user");
    }
  };

  const handleExitEmployee = async () => {
    if (!exitingUser) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_active: false,
          exit_date: new Date().toISOString(),
          exit_reason: exitReason || null
        })
        .eq("id", exitingUser.id);

      if (error) throw error;

      toast.success(`${exitingUser.full_name || exitingUser.email} has been marked as exited`);
      setExitDialogOpen(false);
      setExitingUser(null);
      setExitReason("");
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to mark employee as exited");
    }
  };

  const handleReactivateEmployee = async (user: User) => {
    if (!confirm(`Are you sure you want to reactivate ${user.full_name || user.email}?`)) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_active: true,
          exit_date: null,
          exit_reason: null
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success(`${user.full_name || user.email} has been reactivated`);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to reactivate employee");
    }
  };


  // Search is handled in the database query, no need for client-side filtering
  const filteredUsers = users;

  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-1">{isAdmin ? 'Users' : 'My Team'}</h2>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? 'Manage user accounts and permissions' : 'View team members you have access to'}
        </p>
      </div>
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{isAdmin ? 'User Management' : 'Team Members'}</CardTitle>
              <CardDescription>
                {isAdmin ? 'View and manage all users' : 'Users within your reporting hierarchy'}
              </CardDescription>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Button 
                  variant={showExitedUsers ? "secondary" : "outline"} 
                  size="sm"
                  onClick={() => setShowExitedUsers(!showExitedUsers)}
                >
                  {showExitedUsers ? (
                    <>
                      <UserCheck className="h-4 w-4 mr-2" />
                      Show Active
                    </>
                  ) : (
                    <>
                      <UserX className="h-4 w-4 mr-2" />
                      Show Exited
                    </>
                  )}
                </Button>
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="max-w-sm" />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <MultiSelectFilter
                options={teams.map(t => t.name)}
                selected={selectedTeams.map(id => teams.find(t => t.id === id)?.name || "")}
                onChange={(names) => {
                  const ids = names.map(name => teams.find(t => t.name === name)?.id).filter(Boolean) as string[];
                  setSelectedTeams(ids);
                }}
                placeholder="Search teams..."
                triggerLabel="Team"
              />
              <MultiSelectFilter
                options={allUsers.map(u => u.full_name || u.email)}
                selected={selectedReportsTo.map(id => {
                  const user = allUsers.find(u => u.id === id);
                  return user?.full_name || user?.email || "";
                })}
                onChange={(names) => {
                  const ids = names.map(name => {
                    const user = allUsers.find(u => u.full_name === name || u.email === name);
                    return user?.id;
                  }).filter(Boolean) as string[];
                  setSelectedReportsTo(ids);
                }}
                placeholder="Search users..."
                triggerLabel="Reports To"
              />
            </div>
          </div>
          {isSearchActive && totalCount > 0 && (
            <div className="mb-4 text-sm text-muted-foreground">
              Found {totalCount} user{totalCount !== 1 ? 's' : ''} 
              {searchQuery.trim() && ` matching "${searchQuery}"`}
              {(selectedTeams.length > 0 || selectedReportsTo.length > 0) && " with filters applied"}
            </div>
          )}
          {/* Bulk Selection Bar */}
          {selectedUserIds.length > 0 && (
            <div className="mb-4 p-3 bg-muted/50 rounded-lg border flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{selectedUserIds.length} user(s) selected</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedUserIds([])}
                  className="h-7"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const userIdsParam = encodeURIComponent(selectedUserIds.join(','));
                    navigate(`/view-controller?users=${userIdsParam}`);
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Manage Permissions
                </Button>
                {permissions.canDeleteUsers && (
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={async () => {
                      if (!confirm(`Are you sure you want to delete ${selectedUserIds.length} user(s)? This action cannot be undone.`)) return;
                      try {
                        const { data, error } = await supabase.functions.invoke('admin-delete-users', {
                          body: { userIds: selectedUserIds }
                        });
                        if (error) throw error;
                        if (data?.successCount > 0) {
                          toast.success(`${data.successCount} user(s) deleted successfully`);
                          setSelectedUserIds([]);
                          fetchUsers();
                        }
                        if (data?.errors?.length > 0) {
                          toast.error(`${data.errors.length} deletion(s) failed`);
                        }
                      } catch (error: any) {
                        toast.error(error.message || "Failed to delete users");
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected
                  </Button>
                )}
              </div>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedUserIds(filteredUsers.map(u => u.id));
                        } else {
                          setSelectedUserIds([]);
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Reports To</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>{showExitedUsers ? "Exit Date" : "Joined"}</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const designation = userDesignations[user.id]?.[0]?.designations;
                  const manager = allUsers.find(u => u.id === user.reports_to);
                  return (
                    <TableRow 
                      key={user.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleEdit(user)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox 
                          checked={selectedUserIds.includes(user.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedUserIds([...selectedUserIds, user.id]);
                            } else {
                              setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {user.full_name || "—"}
                          {showExitedUsers && user.exit_reason && (
                            <Badge variant="outline" className="text-xs">
                              {user.exit_reason}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {userRoles[user.id]?.map(role => (
                            <Badge key={role} variant={getRoleVariant(role)}>
                              {getRoleDisplayName(role)}
                            </Badge>
                          )) || <span className="text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {designation ? (
                          <Badge variant="outline">
                            {designation.title} {designation.level && `(L${designation.level})`}
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{userTeams[user.id]?.[0]?.teams?.name || "—"}</TableCell>
                      <TableCell>{manager?.full_name || manager?.email || "—"}</TableCell>
                      <TableCell>{user.phone || "—"}</TableCell>
                      <TableCell>
                        {showExitedUsers 
                          ? (user.exit_date ? new Date(user.exit_date).toLocaleDateString() : "—")
                          : new Date(user.created_at).toLocaleDateString()
                        }
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          {!showExitedUsers && permissions.canEditUsers && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(user)}
                              title="Edit user"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {!showExitedUsers && permissions.canDeleteUsers && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setExitingUser(user);
                                setExitReason("");
                                setExitDialogOpen(true);
                              }}
                              title="Mark as exited"
                              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          )}
                          {showExitedUsers && permissions.canDeleteUsers && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReactivateEmployee(user)}
                              title="Reactivate employee"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <UserCheck className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {!isSearchActive && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={Math.ceil(totalCount / itemsPerPage)}
          totalItems={totalCount}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
        />
      )}

      {isSearchActive && totalCount > 0 && (
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Showing all {totalCount} search results
        </div>
      )}

      {/* Edit User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{isCreating ? "Create User" : "Edit User"}</DialogTitle>
              <DialogDescription>
                {isCreating ? "Create a new user account" : "Update user profile information"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!isCreating}
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              {isCreating && (
                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              )}
              <div>
                <Label htmlFor="role">Role *</Label>
                <Select 
                  value={formData.role || ""}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles
                      .filter(r => r.role !== 'super_admin' && r.role !== 'platform_admin')
                      .map((roleInfo) => (
                        <SelectItem key={roleInfo.role} value={roleInfo.role}>
                          {roleInfo.display_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="designation">Designation</Label>
                <Select 
                  value={formData.designation_id || ""}
                  onValueChange={(value) => setFormData({ ...formData, designation_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select designation (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {designations.map((des) => (
                      <SelectItem key={des.id} value={des.id}>
                        {des.title} {des.level && `(Level ${des.level})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="reports_to">
                  Reports To {!['platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'admin'].includes(formData.role) && '*'}
                  {['platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'admin'].includes(formData.role) && (
                    <span className="text-xs text-muted-foreground ml-2">(Optional for admin roles)</span>
                  )}
                </Label>
                <Select 
                  value={formData.reports_to || ""}
                  onValueChange={(value) => setFormData({ ...formData, reports_to: value })}
                  required={!['platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'admin'].includes(formData.role)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      ['platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'admin'].includes(formData.role)
                        ? "Select manager (optional)"
                        : "Select manager"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers
                      .filter(u => u.id !== selectedUser?.id)
                      .map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.email}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="team">Team Assignment</Label>
                <Select 
                  value={formData.team_id || ""}
                  onValueChange={(value) => setFormData({ ...formData, team_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                   ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {!isCreating && (() => {
            const isEditingSelf = selectedUser?.id === session?.user?.id;
            return (
              <div className="space-y-4 border-t pt-4 mt-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="reset-password"
                    checked={showPasswordReset}
                    onCheckedChange={(checked) => {
                      setShowPasswordReset(checked as boolean);
                      if (!checked) {
                        setFormData({...formData, password: ""});
                        setAdminPasswordForVerification("");
                      }
                    }}
                  />
                  <Label htmlFor="reset-password" className="font-semibold">
                    {isEditingSelf ? 'Change Your Password' : 'Reset User Password'}
                  </Label>
                </div>
                
                {showPasswordReset && (
                  <div className="space-y-4 pl-6 border-l-2 border-yellow-400">
                    {!isEditingSelf && (
                      <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-md">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                          ⚠️ Security Verification Required
                        </p>
                        <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                          You must enter your admin password to confirm this action. All password resets are logged for security auditing.
                        </p>
                      </div>
                    )}
                    
                    {isEditingSelf && (
                      <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md">
                        <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                          🔑 Change Your Password
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                          You can update your password directly. No admin verification required.
                        </p>
                      </div>
                    )}
                    
                    {/* New password for target user */}
                    <div className="space-y-2">
                      <Label htmlFor="new-password">
                        {isEditingSelf ? 'New Password *' : `New Password for ${selectedUser?.full_name || 'User'} *`}
                      </Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        placeholder="Enter new password (min 6 characters)"
                        autoComplete="new-password"
                      />
                    </div>
                    
                    {/* Admin verification password - only for admin resetting others */}
                    {!isEditingSelf && (
                      <div className="space-y-2">
                        <Label htmlFor="admin-password" className="text-red-700 dark:text-red-400">
                          Your Admin Password (for verification) *
                        </Label>
                        <Input
                          id="admin-password"
                          type="password"
                          value={adminPasswordForVerification}
                          onChange={(e) => setAdminPasswordForVerification(e.target.value)}
                          placeholder="Enter your current password"
                          autoComplete="current-password"
                          disabled={isVerifyingAdmin}
                        />
                        <p className="text-xs text-muted-foreground">
                          This will not change your password, only verify your identity
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          
          <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : isCreating ? "Create" : "Update"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Exit Employee Dialog */}
      <Dialog open={exitDialogOpen} onOpenChange={setExitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Employee as Exited</DialogTitle>
            <DialogDescription>
              This will mark {exitingUser?.full_name || exitingUser?.email} as exited. Their data will be preserved but they will be hidden from the active users list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="exit_reason">Exit Reason (Optional)</Label>
              <Input
                id="exit_reason"
                value={exitReason}
                onChange={(e) => setExitReason(e.target.value)}
                placeholder="e.g., Resignation, Termination, End of Contract"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExitDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleExitEmployee}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <UserX className="h-4 w-4 mr-2" />
              Confirm Exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
