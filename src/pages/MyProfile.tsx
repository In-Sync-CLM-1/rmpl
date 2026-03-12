import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { User, Lock, Phone, Mail, Briefcase, Users as UsersIcon, Heart, Home, Shield } from "lucide-react";
import { getRoleDisplayName, getRoleVariant } from "@/lib/rolePermissions";
import { DocumentUploadSection } from "@/components/profile/DocumentUploadSection";
import { useEmployeePersonalDetails } from "@/hooks/useEmployeePersonalDetails";
import { OutlookConnectionManager } from "@/components/OutlookConnectionManager";

interface ProfileData {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  reports_to: string | null;
}

interface UserRole {
  role: string;
}

interface UserDesignation {
  designations: {
    title: string;
    level: number | null;
  };
}

interface UserTeam {
  teams: {
    name: string;
  };
}

export default function MyProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [designation, setDesignation] = useState<UserDesignation | null>(null);
  const [team, setTeam] = useState<UserTeam | null>(null);
  const [manager, setManager] = useState<ProfileData | null>(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
  });
  
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  // Personal details hook
  const { personalDetails, savePersonalDetails, isLoading: personalDetailsLoading } = useEmployeePersonalDetails(profile?.id);
  
  const [personalFormData, setPersonalFormData] = useState({
    date_of_birth: "",
    marital_status: "",
    aadhar_number: "",
    father_name: "",
    mother_name: "",
    emergency_contact_number: "",
    personal_email: "",
    present_address: "",
    permanent_address: "",
    blood_group: "",
  });

  // Update personal form data when loaded
  useEffect(() => {
    if (personalDetails) {
      setPersonalFormData({
        date_of_birth: personalDetails.date_of_birth || "",
        marital_status: personalDetails.marital_status || "",
        aadhar_number: personalDetails.aadhar_number || "",
        father_name: personalDetails.father_name || "",
        mother_name: personalDetails.mother_name || "",
        emergency_contact_number: personalDetails.emergency_contact_number || "",
        personal_email: personalDetails.personal_email || "",
        present_address: personalDetails.present_address || "",
        permanent_address: personalDetails.permanent_address || "",
        blood_group: personalDetails.blood_group || "",
      });
    }
  }, [personalDetails]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);
      setFormData({
        full_name: profileData.full_name || "",
        phone: profileData.phone || "",
      });

      // Fetch roles
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      setRoles(rolesData?.map(r => r.role) || []);

      // Fetch designation
      const { data: designationData } = await supabase
        .from("user_designations")
        .select("designations(title, level)")
        .eq("user_id", session.user.id)
        .eq("is_current", true)
        .maybeSingle();
      setDesignation(designationData);

      // Fetch team
      const { data: teamData } = await supabase
        .from("team_members")
        .select("teams(name)")
        .eq("user_id", session.user.id)
        .eq("is_active", true)
        .maybeSingle();
      setTeam(teamData);

      // Fetch manager
      if (profileData.reports_to) {
        const { data: managerData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", profileData.reports_to)
          .single();
        setManager(managerData);
      }
    } catch (error: any) {
      toast.error("Failed to load profile");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      if (!profile) throw new Error("No profile loaded");

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
        })
        .eq("id", profile.id);

      if (error) throw error;
      toast.success("Profile updated successfully");
      await fetchProfile();
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;
      
      toast.success("Password changed successfully");
      setPasswordData({ newPassword: "", confirmPassword: "" });
      setShowPasswordChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePersonalDetails = async () => {
    if (!profile) return;
    
    savePersonalDetails.mutate({
      user_id: profile.id,
      ...personalFormData,
      date_of_birth: personalFormData.date_of_birth || null,
      marital_status: personalFormData.marital_status || null,
      blood_group: personalFormData.blood_group || null,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-1">My Profile</h2>
        <p className="text-sm text-muted-foreground">View and manage your account information</p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {/* Profile Information Card */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    value={profile?.email || ""}
                    disabled
                    className="pl-10 bg-muted"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Contact an administrator to change your email</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Update Profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Role & Access Card */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Role & Access</CardTitle>
            <CardDescription>Your roles and organizational information (read-only)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="flex flex-wrap gap-2">
                {roles.length > 0 ? (
                  roles.map(role => (
                    <Badge key={role} variant={getRoleVariant(role)}>
                      {getRoleDisplayName(role)}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No roles assigned</span>
                )}
              </div>
            </div>

            {designation?.designations && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Designation
                </Label>
                <Badge variant="outline">
                  {designation.designations.title}
                  {designation.designations.level && ` (Level ${designation.designations.level})`}
                </Badge>
              </div>
            )}

            {team?.teams && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <UsersIcon className="h-4 w-4" />
                  Team
                </Label>
                <Badge variant="outline">{team.teams.name}</Badge>
              </div>
            )}

            {manager && (
              <div className="space-y-2">
                <Label>Reports To</Label>
                <p className="text-sm">{manager.full_name || manager.email}</p>
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-4">
              Contact an administrator to update your role, designation, team, or reporting structure
            </p>
          </CardContent>
        </Card>

        {/* Outlook Integration Card */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Integration
            </CardTitle>
            <CardDescription>Connect your Microsoft Outlook account to send emails</CardDescription>
          </CardHeader>
          <CardContent>
            <OutlookConnectionManager />
          </CardContent>
        </Card>

        {/* Password Change Card */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Change your password</CardDescription>
          </CardHeader>
          <CardContent>
            {!showPasswordChange ? (
              <Button 
                variant="outline" 
                onClick={() => setShowPasswordChange(true)}
                className="w-full sm:w-auto"
              >
                <Lock className="h-4 w-4 mr-2" />
                Change Password
              </Button>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new_password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <PasswordInput
                      id="new_password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      className="pl-10"
                      required
                      minLength={6}
                      placeholder="Enter new password"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm_password">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <PasswordInput
                      id="confirm_password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      className="pl-10"
                      required
                      minLength={6}
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Changing..." : "Change Password"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowPasswordChange(false);
                      setPasswordData({ newPassword: "", confirmPassword: "" });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Personal Details Card */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Personal Details
            </CardTitle>
            <CardDescription>Your personal information for HR records</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={personalFormData.date_of_birth}
                  onChange={(e) => setPersonalFormData({ ...personalFormData, date_of_birth: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="marital_status">Marital Status</Label>
                <Select
                  value={personalFormData.marital_status}
                  onValueChange={(value) => setPersonalFormData({ ...personalFormData, marital_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="married">Married</SelectItem>
                    <SelectItem value="divorced">Divorced</SelectItem>
                    <SelectItem value="widowed">Widowed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="blood_group">Blood Group</Label>
                <Select
                  value={personalFormData.blood_group}
                  onValueChange={(value) => setPersonalFormData({ ...personalFormData, blood_group: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select blood group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A+">A+</SelectItem>
                    <SelectItem value="A-">A-</SelectItem>
                    <SelectItem value="B+">B+</SelectItem>
                    <SelectItem value="B-">B-</SelectItem>
                    <SelectItem value="AB+">AB+</SelectItem>
                    <SelectItem value="AB-">AB-</SelectItem>
                    <SelectItem value="O+">O+</SelectItem>
                    <SelectItem value="O-">O-</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="aadhar_number">
                  <Shield className="inline h-3.5 w-3.5 mr-1" />
                  Aadhar Number
                </Label>
                <Input
                  id="aadhar_number"
                  value={personalFormData.aadhar_number}
                  onChange={(e) => setPersonalFormData({ ...personalFormData, aadhar_number: e.target.value })}
                  placeholder="Enter Aadhar number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="father_name">Father's Name</Label>
                <Input
                  id="father_name"
                  value={personalFormData.father_name}
                  onChange={(e) => setPersonalFormData({ ...personalFormData, father_name: e.target.value })}
                  placeholder="Enter father's name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mother_name">Mother's Name</Label>
                <Input
                  id="mother_name"
                  value={personalFormData.mother_name}
                  onChange={(e) => setPersonalFormData({ ...personalFormData, mother_name: e.target.value })}
                  placeholder="Enter mother's name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emergency_contact">
                  <Phone className="inline h-3.5 w-3.5 mr-1" />
                  Emergency Contact No.
                </Label>
                <Input
                  id="emergency_contact"
                  type="tel"
                  value={personalFormData.emergency_contact_number}
                  onChange={(e) => setPersonalFormData({ ...personalFormData, emergency_contact_number: e.target.value })}
                  placeholder="Enter emergency contact"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="personal_email">
                  <Mail className="inline h-3.5 w-3.5 mr-1" />
                  Personal Email
                </Label>
                <Input
                  id="personal_email"
                  type="email"
                  value={personalFormData.personal_email}
                  onChange={(e) => setPersonalFormData({ ...personalFormData, personal_email: e.target.value })}
                  placeholder="Enter personal email"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="present_address">
                  <Home className="inline h-3.5 w-3.5 mr-1" />
                  Present Address
                </Label>
                <Textarea
                  id="present_address"
                  value={personalFormData.present_address}
                  onChange={(e) => setPersonalFormData({ ...personalFormData, present_address: e.target.value })}
                  placeholder="Enter your present address"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="permanent_address">
                  <Home className="inline h-3.5 w-3.5 mr-1" />
                  Permanent Address
                </Label>
                <Textarea
                  id="permanent_address"
                  value={personalFormData.permanent_address}
                  onChange={(e) => setPersonalFormData({ ...personalFormData, permanent_address: e.target.value })}
                  placeholder="Enter your permanent address"
                  rows={2}
                />
              </div>
            </div>

            <Button 
              onClick={handleSavePersonalDetails} 
              disabled={savePersonalDetails.isPending}
            >
              {savePersonalDetails.isPending ? "Saving..." : "Save Personal Details"}
            </Button>
          </CardContent>
        </Card>

        {/* Documents Section */}
        <DocumentUploadSection />
      </div>
    </div>
  );
}
