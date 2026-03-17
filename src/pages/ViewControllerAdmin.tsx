import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Eye, EyeOff, Copy, CheckCircle, XCircle, Loader2, Settings, Users, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ExophoneSettings } from "@/components/ExophoneSettings";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface NavigationSection {
  id: string;
  section_key: string;
  section_label: string;
  display_order: number;
}

interface NavigationItem {
  id: string;
  section_id: string;
  item_key: string;
  item_title: string;
  item_url: string;
  icon_name: string;
  requires_auth_only: boolean;
  legacy_permission: string | null;
}

interface UserPermission {
  navigation_item_id: string;
  can_view: boolean;
}

const ViewControllerAdmin = () => {
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState<Profile[]>([]);
  const [sections, setSections] = useState<NavigationSection[]>([]);
  const [items, setItems] = useState<NavigationItem[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [copyFromUserId, setCopyFromUserId] = useState<string>("");
  const [userPermissions, setUserPermissions] = useState<Map<string, boolean>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  // Pre-select users from URL params
  useEffect(() => {
    const usersParam = searchParams.get('users');
    if (usersParam) {
      const userIds = usersParam.split(',').filter(Boolean);
      setSelectedUserIds(userIds);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          setCurrentUserId(session.user.id);
        }

        const [usersRes, sectionsRes, itemsRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name, email').order('full_name'),
          supabase.from('navigation_sections').select('*').eq('is_active', true).order('display_order'),
          supabase.from('navigation_items').select('*').eq('is_active', true).order('display_order')
        ]);

        if (usersRes.data) setUsers(usersRes.data);
        if (sectionsRes.data) setSections(sectionsRes.data);
        if (itemsRes.data) setItems(itemsRes.data as NavigationItem[]);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedUserIds.length === 0) {
      setUserPermissions(new Map());
      return;
    }

    // When multiple users selected, fetch permissions from the first user as template
    const fetchUserPermissions = async () => {
      try {
        const { data, error } = await supabase
          .from('user_view_permissions')
          .select('navigation_item_id, can_view')
          .eq('user_id', selectedUserIds[0]);

        if (error) throw error;

        const validItemIds = new Set(items.map(i => i.id));
        const permMap = new Map<string, boolean>();
        data?.forEach(p => {
          if (validItemIds.has(p.navigation_item_id)) {
            permMap.set(p.navigation_item_id, p.can_view);
          }
        });
        setUserPermissions(permMap);
      } catch (error) {
        console.error('Error fetching user permissions:', error);
        toast.error('Failed to load user permissions');
      }
    };

    fetchUserPermissions();
  }, [selectedUserIds]);

  const handleTogglePermission = (itemId: string, currentValue: boolean) => {
    const newPermissions = new Map(userPermissions);
    newPermissions.set(itemId, !currentValue);
    setUserPermissions(newPermissions);
  };

  const handleSavePermissions = async () => {
    if (selectedUserIds.length === 0) return;

    setIsSaving(true);
    try {
      // Save permissions for all selected users
      for (const userId of selectedUserIds) {
        // Delete existing permissions for this user
        await supabase
          .from('user_view_permissions')
          .delete()
          .eq('user_id', userId);

        // Insert new permissions (only for items that still exist in navigation_items)
        const validItemIds = new Set(items.map(i => i.id));
        const permissionsToInsert = Array.from(userPermissions.entries())
          .filter(([itemId]) => validItemIds.has(itemId))
          .map(([itemId, canView]) => ({
            user_id: userId,
            navigation_item_id: itemId,
            can_view: canView,
            granted_by: currentUserId
          }));

        if (permissionsToInsert.length > 0) {
          const { error } = await supabase
            .from('user_view_permissions')
            .insert(permissionsToInsert);

          if (error) throw error;
        }
      }

      toast.success(`Permissions saved for ${selectedUserIds.length} user(s)`);
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error('Failed to save permissions');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGrantAll = () => {
    const newPermissions = new Map<string, boolean>();
    items.forEach(item => newPermissions.set(item.id, true));
    setUserPermissions(newPermissions);
  };

  const handleRevokeAll = () => {
    const newPermissions = new Map<string, boolean>();
    items.forEach(item => newPermissions.set(item.id, false));
    setUserPermissions(newPermissions);
  };

  const handleCopyPermissions = async () => {
    if (!copyFromUserId) return;

    try {
      const { data, error } = await supabase
        .from('user_view_permissions')
        .select('navigation_item_id, can_view')
        .eq('user_id', copyFromUserId);

      if (error) throw error;

      const validItemIds = new Set(items.map(i => i.id));
      const permMap = new Map<string, boolean>();
      data?.forEach(p => {
        if (validItemIds.has(p.navigation_item_id)) {
          permMap.set(p.navigation_item_id, p.can_view);
        }
      });
      setUserPermissions(permMap);
      toast.success('Permissions copied');
    } catch (error) {
      console.error('Error copying permissions:', error);
      toast.error('Failed to copy permissions');
    }
  };

  const getItemsForSection = (sectionId: string) => {
    return items.filter(item => item.section_id === sectionId);
  };

  const getSectionPermissionStatus = (sectionId: string) => {
    const sectionItems = getItemsForSection(sectionId);
    const grantedCount = sectionItems.filter(item => userPermissions.get(item.id) === true).length;
    
    if (grantedCount === 0) return 'none';
    if (grantedCount === sectionItems.length) return 'all';
    return 'partial';
  };

  const handleToggleSection = (sectionId: string) => {
    const sectionItems = getItemsForSection(sectionId);
    const currentStatus = getSectionPermissionStatus(sectionId);
    const newValue = currentStatus !== 'all';

    const newPermissions = new Map(userPermissions);
    sectionItems.forEach(item => newPermissions.set(item.id, newValue));
    setUserPermissions(newPermissions);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Settings</h1>
          <p className="text-muted-foreground">Manage user access and system configurations</p>
        </div>
      </div>

      <Tabs defaultValue="permissions" className="w-full">
        <TabsList>
          <TabsTrigger value="permissions" className="gap-2">
            <Users className="h-4 w-4" />
            View Permissions
          </TabsTrigger>
          <TabsTrigger value="exophone" className="gap-2">
            <Settings className="h-4 w-4" />
            EXOPhone Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="permissions" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Users</CardTitle>
              <CardDescription>Choose one or more users to manage their view permissions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Selected users chips */}
              {selectedUserIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedUserIds.map(userId => {
                    const user = users.find(u => u.id === userId);
                    return (
                      <Badge key={userId} variant="secondary" className="gap-1 pr-1">
                        {user?.full_name || user?.email || 'Unknown'}
                        <button
                          onClick={() => setSelectedUserIds(selectedUserIds.filter(id => id !== userId))}
                          className="ml-1 hover:bg-muted rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedUserIds([])}
                    className="h-6 text-xs"
                  >
                    Clear all
                  </Button>
                </div>
              )}

              {/* User selection list */}
              <div className="border rounded-md max-h-60 overflow-y-auto">
                {users.map(user => (
                  <div 
                    key={user.id} 
                    className="flex items-center gap-3 p-3 hover:bg-muted/50 border-b last:border-b-0"
                  >
                    <Checkbox
                      id={`user-${user.id}`}
                      checked={selectedUserIds.includes(user.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedUserIds([...selectedUserIds, user.id]);
                        } else {
                          setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                        }
                      }}
                    />
                    <label 
                      htmlFor={`user-${user.id}`}
                      className="flex-1 cursor-pointer text-sm"
                    >
                      {user.full_name || user.email || 'Unknown User'}
                    </label>
                  </div>
                ))}
              </div>

              {selectedUserIds.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={handleGrantAll}>
                    <Eye className="h-4 w-4 mr-2" />
                    Grant All
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRevokeAll}>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Revoke All
                  </Button>
                  <div className="flex items-center gap-2">
                    <Select value={copyFromUserId} onValueChange={setCopyFromUserId}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Copy from..." />
                      </SelectTrigger>
                      <SelectContent>
                        {users.filter(u => !selectedUserIds.includes(u.id)).map(user => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name || user.email || 'Unknown'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={handleCopyPermissions} disabled={!copyFromUserId}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedUserIds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Navigation Permissions</CardTitle>
                <CardDescription>
                  Toggle access to individual navigation items. Items marked with "Auth Only" are accessible to all authenticated users by default.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {sections.map(section => {
                    const sectionItems = getItemsForSection(section.id);
                    const status = getSectionPermissionStatus(section.id);

                    return (
                      <AccordionItem key={section.id} value={section.id}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-3">
                            <span className="font-medium">{section.section_label}</span>
                            <Badge 
                              variant={status === 'all' ? 'default' : status === 'partial' ? 'secondary' : 'outline'}
                              className="ml-2"
                            >
                              {status === 'all' && <CheckCircle className="h-3 w-3 mr-1" />}
                              {status === 'none' && <XCircle className="h-3 w-3 mr-1" />}
                              {sectionItems.filter(i => userPermissions.get(i.id) === true).length}/{sectionItems.length}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3 pt-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleToggleSection(section.id)}
                              className="mb-2"
                            >
                              {status === 'all' ? 'Revoke All in Section' : 'Grant All in Section'}
                            </Button>
                            {sectionItems.map(item => (
                              <div 
                                key={item.id} 
                                className="flex items-center justify-between p-3 rounded-lg border bg-card"
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{item.item_title}</span>
                                  <span className="text-sm text-muted-foreground">{item.item_url}</span>
                                  <div className="flex gap-2 mt-1">
                                    {item.requires_auth_only && (
                                      <Badge variant="outline" className="text-xs">Auth Only</Badge>
                                    )}
                                    {item.legacy_permission && (
                                      <Badge variant="secondary" className="text-xs">
                                        Legacy: {item.legacy_permission}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <Switch
                                  checked={userPermissions.get(item.id) === true}
                                  onCheckedChange={() => handleTogglePermission(item.id, userPermissions.get(item.id) === true)}
                                />
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>

                <div className="mt-6 flex justify-end">
                  <Button onClick={handleSavePermissions} disabled={isSaving}>
                    {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Permissions
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="exophone" className="mt-6">
          <ExophoneSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ViewControllerAdmin;
