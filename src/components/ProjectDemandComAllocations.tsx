import { useState, useMemo } from "react";
import { useProjectDemandComAllocations } from "@/hooks/useProjectDemandComAllocations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Users, Target, Database, TrendingUp } from "lucide-react";

interface ProjectDemandComAllocationsProps {
  projectId: string | undefined;
  numberOfAttendees: number;
}

export function ProjectDemandComAllocations({
  projectId,
  numberOfAttendees,
}: ProjectDemandComAllocationsProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("all");
  const [editingValues, setEditingValues] = useState<Record<string, { registration: string; data: string }>>({});

  const {
    allocations,
    availableUsers,
    teams,
    totals,
    isLoading,
    isAdding,
    addAllAllocations,
    updateAllocation,
    removeAllocation,
  } = useProjectDemandComAllocations(projectId);

  const gap = numberOfAttendees - totals.registrationTarget;

  // Filter users by selected team
  const filteredUsers = useMemo(() => {
    if (selectedTeamFilter === "all") {
      return availableUsers;
    }
    return availableUsers.filter((user) => user.team_id === selectedTeamFilter);
  }, [availableUsers, selectedTeamFilter]);

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleToggleAll = () => {
    if (selectedUserIds.size === filteredUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredUsers.map((u) => u.id)));
    }
  };

  const handleAddUsers = () => {
    if (selectedUserIds.size > 0) {
      addAllAllocations(Array.from(selectedUserIds));
      setSelectedUserIds(new Set());
      setIsAddDialogOpen(false);
    }
  };

  const handleInputChange = (allocationId: string, field: 'registration' | 'data', value: string) => {
    setEditingValues(prev => ({
      ...prev,
      [allocationId]: {
        ...prev[allocationId],
        [field]: value,
      },
    }));
  };

  const handleInputBlur = (allocationId: string, field: 'registration' | 'data') => {
    const currentValue = editingValues[allocationId]?.[field];
    if (currentValue !== undefined) {
      const numValue = parseInt(currentValue, 10) || 0;
      updateAllocation({
        allocationId,
        data: field === 'registration' 
          ? { registration_target: numValue }
          : { data_allocation: numValue },
      });
    }
  };

  const getInputValue = (allocationId: string, field: 'registration' | 'data', defaultValue: number) => {
    return editingValues[allocationId]?.[field] ?? defaultValue.toString();
  };

  // Reset user selection when team filter changes
  const handleTeamFilterChange = (value: string) => {
    setSelectedTeamFilter(value);
    setSelectedUserIds(new Set());
  };

  if (!projectId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Save the project first to manage DemandCom allocations.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Required Attendees - Prominent Display */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-3">
            <Target className="h-8 w-8 text-primary" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground font-medium">Required Attendees</p>
              <p className="text-4xl font-bold text-primary">{numberOfAttendees || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Total Registration Target
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totals.registrationTarget}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4 text-purple-500" />
              Total Data required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totals.dataAllocation}</p>
          </CardContent>
        </Card>

        <Card className={gap > 0 ? "border-destructive/50" : "border-green-500/50"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className={`h-4 w-4 ${gap > 0 ? "text-destructive" : "text-green-500"}`} />
              Gap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${gap > 0 ? "text-destructive" : "text-green-500"}`}>
              {gap > 0 ? `-${gap}` : gap === 0 ? "0" : `+${Math.abs(gap)}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Add User Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Resource Allocations</h3>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={availableUsers.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Team Filter */}
              <div className="space-y-2">
                <Label>Filter by Team</Label>
                <Select value={selectedTeamFilter} onValueChange={handleTeamFilterChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Teams" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* User Selection with Checkboxes */}
              <div className="space-y-2">
                <Label>Select Users ({filteredUsers.length} available)</Label>
                
                {filteredUsers.length === 0 ? (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground border rounded-md">
                    No available users in this team
                  </div>
                ) : (
                  <>
                    {/* Select All */}
                    <div className="flex items-center space-x-2 p-2 border-b">
                      <Checkbox
                        id="select-all"
                        checked={selectedUserIds.size === filteredUsers.length && filteredUsers.length > 0}
                        onCheckedChange={handleToggleAll}
                      />
                      <label
                        htmlFor="select-all"
                        className="text-sm font-medium cursor-pointer flex-1"
                      >
                        Select All ({filteredUsers.length})
                      </label>
                    </div>

                    {/* User List */}
                    <ScrollArea className="h-[200px] border rounded-md">
                      <div className="p-2 space-y-1">
                        {filteredUsers.map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-md cursor-pointer"
                            onClick={() => handleToggleUser(user.id)}
                          >
                            <Checkbox
                              checked={selectedUserIds.has(user.id)}
                              className="pointer-events-none"
                            />
                            <span className="text-sm flex-1">
                              {user.full_name || "Unknown User"}
                              <span className="text-muted-foreground ml-2">({user.team_name})</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </>
                )}
              </div>

              <Button 
                onClick={handleAddUsers} 
                disabled={selectedUserIds.size === 0 || isAdding}
                className="w-full"
              >
                Add {selectedUserIds.size} User{selectedUserIds.size !== 1 ? "s" : ""}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Allocations Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-bold">TOTALS</TableHead>
              <TableHead className="text-center font-bold">{totals.registrationTarget}</TableHead>
              <TableHead className="text-center font-bold">{totals.dataAllocation}</TableHead>
              <TableHead></TableHead>
            </TableRow>
            <TableRow>
              <TableHead>User Name</TableHead>
              <TableHead className="text-center">Registration Target</TableHead>
              <TableHead className="text-center">Data required</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No team members added yet. Click "Add User" to get started.
                </TableCell>
              </TableRow>
            ) : (
              allocations.map((allocation) => (
                <TableRow key={allocation.id}>
                  <TableCell className="font-medium">
                    {allocation.user?.full_name || "Unknown User"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      min="0"
                      className="w-24 mx-auto text-center"
                      value={getInputValue(allocation.id, 'registration', allocation.registration_target)}
                      onChange={(e) => handleInputChange(allocation.id, 'registration', e.target.value)}
                      onBlur={() => handleInputBlur(allocation.id, 'registration')}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      min="0"
                      className="w-24 mx-auto text-center"
                      value={getInputValue(allocation.id, 'data', allocation.data_allocation)}
                      onChange={(e) => handleInputChange(allocation.id, 'data', e.target.value)}
                      onBlur={() => handleInputBlur(allocation.id, 'data')}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAllocation(allocation.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
