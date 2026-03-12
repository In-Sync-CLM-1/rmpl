import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserPermissions } from "./useUserPermissions";

interface NavigationSection {
  id: string;
  section_key: string;
  section_label: string;
  display_order: number;
  is_active: boolean;
}

interface NavigationItem {
  id: string;
  section_id: string;
  item_key: string;
  item_title: string;
  item_url: string;
  icon_name: string;
  display_order: number;
  is_active: boolean;
  requires_auth_only: boolean;
  legacy_permission: string | null;
}

interface UserViewPermission {
  navigation_item_id: string;
  can_view: boolean;
}

export const useNavigationPermissions = () => {
  const [sections, setSections] = useState<NavigationSection[]>([]);
  const [items, setItems] = useState<NavigationItem[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserViewPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { permissions: rolePermissions, userRoles } = useUserPermissions();

  const isAdmin = userRoles.some(role => 
    ['platform_admin', 'super_admin', 'admin', 'admin_administration', 'admin_tech'].includes(role)
  );

  useEffect(() => {
    const fetchNavigationData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          setIsLoading(false);
          return;
        }

        // Fetch sections and items in parallel
        const [sectionsRes, itemsRes, permissionsRes] = await Promise.all([
          supabase
            .from('navigation_sections')
            .select('*')
            .eq('is_active', true)
            .order('display_order'),
          supabase
            .from('navigation_items')
            .select('*')
            .eq('is_active', true)
            .order('display_order'),
          supabase
            .from('user_view_permissions')
            .select('navigation_item_id, can_view')
            .eq('user_id', session.user.id)
        ]);

        if (sectionsRes.data) setSections(sectionsRes.data);
        if (itemsRes.data) setItems(itemsRes.data as NavigationItem[]);
        if (permissionsRes.data) setUserPermissions(permissionsRes.data);
      } catch (error) {
        console.error('Error fetching navigation permissions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNavigationData();
  }, []);

  const canViewItem = useCallback((itemKey: string): boolean => {
    const item = items.find(i => i.item_key === itemKey);
    if (!item) return false;

    // Admins can see all navigation items
    if (isAdmin) return true;

    // Check if item requires only authentication (no special permissions)
    if (item.requires_auth_only) return true;

    // Check user-specific view permission first
    const userPerm = userPermissions.find(p => p.navigation_item_id === item.id);
    if (userPerm !== undefined) {
      return userPerm.can_view;
    }

    // Fall back to legacy role-based permission
    if (item.legacy_permission) {
      const permKey = item.legacy_permission as keyof typeof rolePermissions;
      return rolePermissions[permKey] === true;
    }

    return false;
  }, [items, userPermissions, rolePermissions, isAdmin]);

  const getVisibleSections = useCallback(() => {
    return sections.filter(section => {
      const sectionItems = items.filter(item => item.section_id === section.id);
      return sectionItems.some(item => canViewItem(item.item_key));
    });
  }, [sections, items, canViewItem]);

  const getVisibleItemsForSection = useCallback((sectionId: string) => {
    return items
      .filter(item => item.section_id === sectionId && canViewItem(item.item_key))
      .sort((a, b) => a.display_order - b.display_order);
  }, [items, canViewItem]);

  return {
    sections,
    items,
    userPermissions,
    isLoading,
    canViewItem,
    getVisibleSections,
    getVisibleItemsForSection,
    isAdmin
  };
};
