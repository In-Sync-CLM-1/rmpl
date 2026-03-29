import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useCSBDTargetManagement, CSBDTargetWithUser } from "@/hooks/useCSBDTargetManagement";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Save, Target, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EditableTarget {
  id: string;
  user_id: string;
  fiscal_year: number;
  existing_business_target_inr_lacs: number;
  new_business_target_inr_lacs: number;
  has_subordinates: boolean;
  is_active: boolean;
  isDirty: boolean;
}

const CSBDTargets = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [editableTargets, setEditableTargets] = useState<Map<string, EditableTarget>>(new Map());
  

  const { targetsWithUsers, isLoading, upsertTarget, totalTarget, totalExistingTarget, totalNewTarget, activeMembers } = useCSBDTargetManagement(selectedYear);
  
  // Track if we've initialized for the current year
  const initializedYearRef = useRef<number | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isCSBDOnly, setIsCSBDOnly] = useState(false);

  // Check user access
  useEffect(() => {
    const checkAccess = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setHasAccess(false);
        return;
      }

      setCurrentUserId(userData.user.id);

      // Fetch roles and team memberships in parallel
      const [rolesResult, teamsResult] = await Promise.all([
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userData.user.id),
        supabase
          .from('team_members')
          .select('teams:team_id(name)')
          .eq('user_id', userData.user.id)
          .eq('is_active', true)
      ]);

      const userRoles = rolesResult.data?.map((r) => r.role) || [];
      const teamNames = teamsResult.data?.map((tm: any) => tm.teams?.name).filter(Boolean) || [];
      const adminRoles = ['admin_administration', 'admin', 'super_admin', 'platform_admin', 'admin_tech'];
      const hasAdminPermission = userRoles.some((role) => adminRoles.includes(role));
      const hasCSBDRole = userRoles.includes('csbd') || teamNames.some((name: string) => name.toUpperCase().includes('CSBD'));

      // Allow access if admin OR csbd role/team membership
      setHasAccess(hasAdminPermission || hasCSBDRole);
      // Track if user is CSBD-only (not admin) - they can only manage their own target
      setIsCSBDOnly(hasCSBDRole && !hasAdminPermission);
    };

    checkAccess();
  }, []);

  // Initialize editable targets only once when data loads for a specific year
  useEffect(() => {
    // Only initialize if year changed or we haven't initialized yet
    if (targetsWithUsers.length > 0 && initializedYearRef.current !== selectedYear) {
      const newMap = new Map<string, EditableTarget>();
      targetsWithUsers.forEach((target) => {
        newMap.set(target.user_id, {
          id: target.id,
          user_id: target.user_id,
          fiscal_year: target.fiscal_year,
          existing_business_target_inr_lacs: target.existing_business_target_inr_lacs ?? 0,
          new_business_target_inr_lacs: target.new_business_target_inr_lacs ?? 0,
          has_subordinates: target.has_subordinates,
          is_active: target.is_active,
          isDirty: false,
        });
      });
      setEditableTargets(newMap);
      initializedYearRef.current = selectedYear;
    }
  }, [targetsWithUsers, selectedYear]);

  const handleTargetChange = (userId: string, field: keyof EditableTarget, value: number | boolean) => {
    setEditableTargets((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(userId);
      if (current) {
        newMap.set(userId, { ...current, [field]: value, isDirty: true });
      } else {
        // Initialize new entry with defaults
        newMap.set(userId, {
          id: '',
          user_id: userId,
          fiscal_year: selectedYear,
          existing_business_target_inr_lacs: field === 'existing_business_target_inr_lacs' ? value as number : 0,
          new_business_target_inr_lacs: field === 'new_business_target_inr_lacs' ? value as number : 0,
          has_subordinates: field === 'has_subordinates' ? value as boolean : false,
          is_active: field === 'is_active' ? value as boolean : true,
          isDirty: true,
        });
      }
      return newMap;
    });
  };

  const handleSaveTarget = async (userId: string) => {
    const target = editableTargets.get(userId);
    if (!target) return;

    await upsertTarget.mutateAsync({
      id: target.id || undefined,
      user_id: target.user_id,
      fiscal_year: selectedYear,
      existing_business_target_inr_lacs: target.existing_business_target_inr_lacs,
      new_business_target_inr_lacs: target.new_business_target_inr_lacs,
      has_subordinates: target.has_subordinates,
      is_active: target.is_active,
    });

    setEditableTargets((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(userId);
      if (current) {
        newMap.set(userId, { ...current, isDirty: false });
      }
      return newMap;
    });
  };

  const handleSaveAll = async () => {
    const dirtyTargets = Array.from(editableTargets.values()).filter((t) => t.isDirty);
    if (dirtyTargets.length === 0) {
      toast.info('No changes to save');
      return;
    }

    for (const target of dirtyTargets) {
      await upsertTarget.mutateAsync({
        id: target.id || undefined,
        user_id: target.user_id,
        fiscal_year: selectedYear,
        existing_business_target_inr_lacs: target.existing_business_target_inr_lacs,
        new_business_target_inr_lacs: target.new_business_target_inr_lacs,
        has_subordinates: target.has_subordinates,
        is_active: target.is_active,
      });
    }

    setEditableTargets((prev) => {
      const newMap = new Map(prev);
      newMap.forEach((target, key) => {
        newMap.set(key, { ...target, isDirty: false });
      });
      return newMap;
    });

    toast.success(`Saved ${dirtyTargets.length} target(s)`);
  };



  if (hasAccess === null || isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (hasAccess === false) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              You don't have permission to access this page.
            </p>
            <div className="flex justify-center mt-4">
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  const hasDirtyChanges = Array.from(editableTargets.values()).some((t) => t.isDirty);

  // Filter targets based on user role - CSBD-only users can only see/edit their own
  const filteredTargets = isCSBDOnly 
    ? targetsWithUsers.filter(t => t.user_id === currentUserId)
    : targetsWithUsers;

  // Calculate totals from editable targets
  const editableExistingTotal = Array.from(editableTargets.values())
    .filter((t) => t.is_active)
    .reduce((sum, t) => sum + (t.existing_business_target_inr_lacs || 0), 0);

  const editableNewTotal = Array.from(editableTargets.values())
    .filter((t) => t.is_active)
    .reduce((sum, t) => sum + (t.new_business_target_inr_lacs || 0), 0);

  const editableTotal = editableExistingTotal + editableNewTotal;


  const renderTargetRow = (target: CSBDTargetWithUser) => {
    const editable = editableTargets.get(target.user_id);
    const isDirty = editable?.isDirty || false;

    const existingBiz = editable?.existing_business_target_inr_lacs ?? target.existing_business_target_inr_lacs ?? 0;
    const newBiz = editable?.new_business_target_inr_lacs ?? target.new_business_target_inr_lacs ?? 0;
    const rowTotal = existingBiz + newBiz;

    return (
      <TableRow 
        key={target.user_id} 
        className={cn(isDirty && 'bg-yellow-50 dark:bg-yellow-900/10')}
      >
        <TableCell className="font-medium">
          <span>{target.user.full_name || 'Unknown'}</span>
        </TableCell>
        <TableCell className="text-muted-foreground">{target.user.email}</TableCell>
        <TableCell className="text-right">
          <Input
            type="number"
            step="0.01"
            className="w-24 text-right ml-auto"
            value={existingBiz}
            onChange={(e) => {
              const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
              handleTargetChange(target.user_id, 'existing_business_target_inr_lacs', isNaN(val) ? 0 : val);
            }}
          />
        </TableCell>
        <TableCell className="text-right">
          <Input
            type="number"
            step="0.01"
            className="w-24 text-right ml-auto"
            value={newBiz}
            onChange={(e) => {
              const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
              handleTargetChange(target.user_id, 'new_business_target_inr_lacs', isNaN(val) ? 0 : val);
            }}
          />
        </TableCell>
        <TableCell className="text-right font-medium">
          <span className="text-foreground">₹{rowTotal.toFixed(2)}L</span>
        </TableCell>
        <TableCell className="text-center">
          <Switch
            checked={editable?.is_active ?? true}
            onCheckedChange={(checked) => handleTargetChange(target.user_id, 'is_active', checked)}
          />
        </TableCell>
        <TableCell className="text-center">
          <Button
            size="sm"
            variant={isDirty ? 'default' : 'ghost'}
            onClick={() => handleSaveTarget(target.user_id)}
            disabled={!isDirty || upsertTarget.isPending}
          >
            <Save className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/executive-dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">CSBD Target Management</h1>
            <p className="text-muted-foreground">Assign and manage annual targets for CSBD team members</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSaveAll} disabled={!hasDirtyChanges || upsertTarget.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Save All Changes
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Existing Business
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{editableExistingTotal.toFixed(2)}L</div>
            <p className="text-xs text-muted-foreground mt-1">Total for {selectedYear}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              New Business
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{editableNewTotal.toFixed(2)}L</div>
            <p className="text-xs text-muted-foreground mt-1">Total for {selectedYear}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Total Target
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{editableTotal.toFixed(2)}L</div>
            <p className="text-xs text-muted-foreground mt-1">Combined for {selectedYear}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.from(editableTargets.values()).filter((t) => t.is_active && (t.existing_business_target_inr_lacs > 0 || t.new_business_target_inr_lacs > 0)).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">With active targets</p>
          </CardContent>
        </Card>
      </div>

      {/* All CSBD Members - Flat List */}
      <Card>
        <CardHeader>
          <CardTitle>CSBD Team Members - {selectedYear}</CardTitle>
          <CardDescription>All members from teams containing 'CSBD' in the name.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Existing (₹L)</TableHead>
                <TableHead className="text-right">New (₹L)</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTargets.map((target) => renderTargetRow(target))}
              {filteredTargets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No CSBD team members found. Add users to teams containing 'CSBD' in the name.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default CSBDTargets;
