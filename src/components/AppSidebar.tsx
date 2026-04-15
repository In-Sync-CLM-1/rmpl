import { NavLink, useLocation } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Mail,
  FileText,
  Building2,
  TrendingUp,
  UserPlus,
  PackageMinus,
  History,
  Webhook,
  MessageSquare,
  Sparkles,
  LogOut,
  UserCircle,
  Database,
  Building,
  UsersRound,
  Contact,
  BadgeCheck,
  UserCog,
  Users2,
  Clock,
  Calendar,
  CheckSquare,
  BarChart3,
  ListTodo,
  Filter,
  Settings,
  Package,
  Package2,
  Target,
  Megaphone,
  Activity,
  Truck,
  Hash,
  Eye,
  LucideIcon,
  CalendarDays,
  PieChart,
  LineChart,
  CalendarClock,
  ClipboardCheck,
  FileBarChart,
  Boxes,
  LayoutGrid,
  GitBranch,
  Inbox,
  Send,
  Home,
  Phone,
  Gauge,
  Crosshair,
  SlidersHorizontal,
  Zap,
  ClipboardList,
  FolderKanban,
  ChartLine,
  Rocket,
  MailOpen,
  FileCode,
  MonitorSmartphone,
  Server,
  Barcode,
  Warehouse,
  PackageSearch,
  Store,
  TimerReset,
  CalendarOff,
  ShieldCheck,
  ScrollText,
  UserRoundCog,
  Network,
  Award,
  Workflow,
  ScanEye,
  Globe,
  Bell,
  Wallet,
  MessageCircle,
  Contact2,
  ClipboardPlus,
  LifeBuoy,
  Plane,
} from "lucide-react";
import { getRolePermissions, Permissions } from "@/lib/rolePermissions";
import { useNavigationPermissions } from "@/hooks/useNavigationPermissions";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import rmplLogo from "@/assets/rmpl-logo.png";

// Icon mapping for dynamic icons from database
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Home,
  Calendar,
  CalendarDays,
  CalendarClock,
  BarChart3,
  PieChart,
  LineChart,
  ChartLine,
  Database,
  Activity,
  Target,
  Crosshair,
  Filter,
  SlidersHorizontal,
  Briefcase,
  FolderKanban,
  Sparkles,
  Zap,
  ListTodo,
  ClipboardList,
  Building,
  TrendingUp,
  Mail,
  MailOpen,
  MessageSquare,
  Inbox,
  Send,
  Rocket,
  FileText,
  FileCode,
  Package,
  Package2,
  Boxes,
  LayoutGrid,
  MonitorSmartphone,
  Server,
  Hash,
  Barcode,
  Truck,
  PackageSearch,
  Warehouse,
  Building2,
  Store,
  Clock,
  TimerReset,
  CheckSquare,
  ClipboardCheck,
  CalendarOff,
  ShieldCheck,
  FileBarChart,
  ScrollText,
  UserCog,
  UserRoundCog,
  Users2,
  Network,
  BadgeCheck,
  Award,
  GitBranch,
  Workflow,
  Webhook,
  Globe,
  Megaphone,
  Bell,
  Eye,
  ScanEye,
  Contact,
  Users,
  UserPlus,
  PackageMinus,
  History,
  Settings,
  UsersRound,
  Gauge,
  Phone,
  MessageCircle,
  Wallet,
  Contact2,
  ClipboardPlus,
  LifeBuoy,
  Plane,
};

interface NavigationItem {
  title: string;
  url: string;
  icon: any;
  requiredPermission?: keyof Permissions;
}

interface NavigationSection {
  label: string;
  items: NavigationItem[];
}

// Fallback navigation sections (used while loading or if DB is empty)
const fallbackNavigationSections: NavigationSection[] = [
  {
    label: "DASHBOARDS",
    items: [
      { title: "Home", url: "/dashboard", icon: Home },
      { title: "Calendar", url: "/calendar", icon: CalendarDays },
    ],
  },
  {
    label: "CSBD",
    items: [
      { title: "Executive View", url: "/executive-dashboard", icon: Gauge, requiredPermission: 'canViewCSBDDashboard' },
      { title: "Projects", url: "/projects", icon: FolderKanban },
      { title: "Clients", url: "/clients", icon: Building },
      { title: "Contacts", url: "/contacts", icon: Contact2 },
      { title: "Cashflow", url: "/cashflow-dashboard", icon: Wallet },
      { title: "Projections", url: "/csbd-projections", icon: ChartLine, requiredPermission: 'canViewCSBDProjections' },
    ],
  },
  {
    label: "DEMANDCOM",
    items: [
      { title: "Data", url: "/demandcom", icon: Phone },
      { title: "Master", url: "/master", icon: Database },
      { title: "Analytics", url: "/demandcom-dashboard", icon: BarChart3 },
      { title: "Daily Targets", url: "/demandcom-daily-targets", icon: Crosshair },
      { title: "VAPI Call Scheduler", url: "/vapi-scheduler", icon: CalendarClock },
    ],
  },
  {
    label: "TASKS",
    items: [
      { title: "All Tasks", url: "/tasks", icon: ClipboardList },
      { title: "Team Chat", url: "/chat", icon: MessageCircle },
    ],
  },
  {
    label: "HR",
    items: [
      { title: "HR Policies", url: "/hr-policies", icon: ScrollText },
      { title: "Salary Slips", url: "/salary-slips", icon: Wallet },
      { title: "My Documents", url: "/hr-documents", icon: FileText },
      { title: "Employee Directory", url: "/employee-directory", icon: Contact2, requiredPermission: 'canViewEmployeeDirectory' },
      { title: "Self Assessment", url: "/kpi-self-assessment", icon: ClipboardCheck },
    ],
  },
  {
    label: "HR ADMIN",
    items: [
      { title: "My Attendance", url: "/attendance", icon: TimerReset },
      { title: "Leave Requests", url: "/leave-management", icon: CalendarOff },
      { title: "Leave Approvals", url: "/leave-approvals", icon: ShieldCheck, requiredPermission: 'canApproveLeaves' },
      { title: "Regularization Approvals", url: "/regularization-approvals", icon: FileBarChart, requiredPermission: 'canApproveLeaves' },
      { title: "Reports", url: "/attendance-reports", icon: ScrollText, requiredPermission: 'canViewAttendanceReports' },
      { title: "Travel Expenses", url: "/travel-expenses", icon: Plane },
      { title: "Expense Approvals", url: "/travel-expense-approvals", icon: ShieldCheck, requiredPermission: 'canApproveLeaves' },
      { title: "Leave Limits", url: "/leave-limits", icon: SlidersHorizontal, requiredPermission: 'canAdjustLeaveBalances' },
      { title: "Salary Admin", url: "/salary-slips-admin", icon: UserRoundCog, requiredPermission: 'canManageSalarySlips' },
      { title: "Employee Onboarding", url: "/hr-onboarding", icon: ClipboardPlus, requiredPermission: 'canManageOnboarding' },
      { title: "Team Assessment", url: "/kpi-team-dashboard", icon: BarChart3 },
    ],
  },
  {
    label: "DIGICOM",
    items: [
      { title: "Dashboard", url: "/digicom-dashboard", icon: Sparkles },
      { title: "Tasks", url: "/digicom-tasks", icon: ClipboardList },
    ],
  },
  {
    label: "LIVECOM",
    items: [
      { title: "Dashboard", url: "/livecom-dashboard", icon: Zap },
    ],
  },
  {
    label: "ADMIN",
    items: [
      { title: "Users", url: "/users", icon: UserRoundCog, requiredPermission: 'canViewUsers' },
      { title: "Teams", url: "/teams", icon: Network, requiredPermission: 'canViewTeams' },
      { title: "Designations", url: "/designations", icon: Award, requiredPermission: 'canViewDesignations' },
      { title: "Templates", url: "/templates", icon: FileCode, requiredPermission: 'canViewUsers' },
      { title: "View Controller", url: "/view-controller", icon: ScanEye, requiredPermission: 'canViewUsers' },
    ],
  },
];

interface AppSidebarProps {
  user: User | null;
  userRoles: string[];
  onLogout: () => void;
}

export function AppSidebar({ user, userRoles, onLogout }: AppSidebarProps) {
  const location = useLocation();
  const currentPath = location.pathname;
  const permissions = getRolePermissions(userRoles);
  const { 
    sections, 
    items, 
    isLoading, 
    canViewItem, 
    getVisibleSections: getDbVisibleSections,
    getVisibleItemsForSection,
    isAdmin 
  } = useNavigationPermissions();

  const isActive = (path: string) => currentPath === path;
  
  // Use database-driven navigation if data is loaded, otherwise use fallback
  const useDynamicNav = !isLoading && sections.length > 0 && items.length > 0;

  const getVisibleSectionsFromFallback = () => {
    return fallbackNavigationSections
      .map(section => ({
        ...section,
        items: section.items.filter(item => {
          if (!item.requiredPermission) return true;
          return permissions[item.requiredPermission];
        })
      }))
      .filter(section => section.items.length > 0);
  };

  const renderDynamicNavigation = () => {
    const visibleSections = getDbVisibleSections();
    
    return visibleSections.map((section) => {
      const sectionItems = getVisibleItemsForSection(section.id);
      
      return (
        <SidebarGroup key={section.id}>
          <SidebarGroupLabel className="text-[10px] font-semibold text-sidebar-foreground/60 uppercase tracking-wider px-3 py-2 group-data-[collapsible=icon]:hidden">
            {section.section_label}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sectionItems.map((item) => {
                const IconComponent = iconMap[item.icon_name] || LayoutDashboard;
                
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton asChild isActive={isActive(item.item_url)}>
                      <NavLink
                        to={item.item_url}
                        className="flex items-center gap-3 mx-2"
                      >
                        <IconComponent className="h-4 w-4" />
                        <span className="text-sm group-data-[collapsible=icon]:hidden">{item.item_title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      );
    });
  };

  const renderFallbackNavigation = () => {
    const visibleSections = getVisibleSectionsFromFallback();
    
    return visibleSections.map((section) => (
      <SidebarGroup key={section.label}>
        <SidebarGroupLabel className="text-[10px] font-semibold text-sidebar-foreground/60 uppercase tracking-wider px-3 py-2 group-data-[collapsible=icon]:hidden">
          {section.label}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {section.items.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={isActive(item.url)}>
                  <NavLink
                    to={item.url}
                    className="flex items-center gap-3 mx-2"
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="text-sm group-data-[collapsible=icon]:hidden">{item.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    ));
  };

  return (
    <Sidebar collapsible="icon" className="bg-sidebar border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="p-4">
          <div className="bg-white rounded-lg p-3 mb-3 mx-auto w-fit">
            <img src={rmplLogo} alt="Logo" className="w-24 h-auto transition-all duration-300 hover:scale-105" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden text-center">
            <p className="text-lg font-bold text-sidebar-foreground">
              {user?.user_metadata?.full_name || user?.email}
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {useDynamicNav ? renderDynamicNavigation() : renderFallbackNavigation()}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/my-profile")}>
              <NavLink
                to="/my-profile"
                className="flex items-center gap-3"
              >
                <UserCircle className="h-4 w-4" />
                <span className="text-sm group-data-[collapsible=icon]:hidden">My Profile</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <Button
          variant="ghost"
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 text-sidebar-foreground bg-transparent hover:bg-sidebar-accent transition-all rounded-lg w-full justify-start mt-2"
        >
          <LogOut className="h-4 w-4" />
          <span className="text-sm group-data-[collapsible=icon]:hidden">Logout</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
