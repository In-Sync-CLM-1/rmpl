export interface Permissions {
  canViewUsers: boolean;
  canEditUsers: boolean;
  canDeleteUsers: boolean;
  canViewSystemSettings: boolean;
  canViewWebhooks: boolean;
  canViewReports: boolean;
  canViewTeams: boolean;
  canViewDesignations: boolean;
  canViewPipelineStages: boolean;
  canManageTeams: boolean;
  canManageClients: boolean;
  canManageParticipants: boolean;
  canManageCampaigns: boolean;
  canDeleteMaster: boolean;
  canDeleteClients: boolean;
  canDeleteVendors: boolean;
  canManageInventory: boolean;
  canDeleteInventory: boolean;
  canManageProjects: boolean;
  canDeleteProjects: boolean;
  canRecommendLeaves: boolean;
  canApproveLeaves: boolean;
  canViewAttendanceReports: boolean;
  canViewCSBDDashboard: boolean;
  canViewCSBDProjections: boolean;
  canEditOwnCSBDProjections: boolean;
  // HR Admin permissions
  canManageHRDocuments: boolean;
  canManageSalarySlips: boolean;
  canOverrideLeaveApprovals: boolean;
  canAdjustLeaveBalances: boolean;
  canViewEmployeeDirectory: boolean;
  canManageOnboarding: boolean;
  // Navigation visibility permissions (used by DB-driven navigation)
  canViewDemandCom: boolean;
  canViewProjects: boolean;
  canViewClients: boolean;
  canViewInventory: boolean;
  canViewCampaigns: boolean;
  canManageDispositions: boolean;
}

export const getRolePermissions = (roles: string[], userId?: string, hasSubordinates?: boolean, teamNames?: string[]): Permissions => {
  const hasRole = (role: string) => roles.includes(role);
  const isHRManager = hasRole('hr_manager');
  const isAdmin = hasRole('platform_admin') || hasRole('super_admin') || hasRole('admin_administration') || hasRole('admin_tech') || hasRole('admin');
  const isManagerOrAdmin = hasRole('manager') || isAdmin;
  const isCSBD = hasRole('csbd') || (teamNames || []).some(name => name.toUpperCase().includes('CSBD'));
  const isLeadership = hasRole('leadership');
  
  // Leave approval restricted to platform admins, HR managers, and specific legacy users
  const AUTHORIZED_HR_USERS = [
    '2fe1bb0f-879c-4b11-9c31-ce7eee8a2be9', // s.ray@redefine.in
    'ae3869ea-b6fc-41e7-8596-f0a90772cc99', // hr@redefine.in (Indu)
  ];
  const isPlatformAdmin = hasRole('platform_admin') || hasRole('super_admin') || hasRole('admin_tech');
  const isHRAdmin = isHRManager;
  const isAuthorizedHR = userId ? AUTHORIZED_HR_USERS.includes(userId) : false;
  
  // Attendance reports: only specific authorized users + team leads with subordinates
  const AUTHORIZED_ATTENDANCE_USERS = [
    'ae3869ea-b6fc-41e7-8596-f0a90772cc99', // hr@redefine.in (Indu)
    '70f7619f-1984-4583-9f2f-53cfec733eb5', // a@in-sync.co.in
  ];
  const isAuthorizedAttendanceUser = userId ? AUTHORIZED_ATTENDANCE_USERS.includes(userId) : false;
  
  return {
    canViewUsers: isAdmin,
    canEditUsers: isAdmin,
    canDeleteUsers: isAdmin,
    canViewSystemSettings: hasRole('platform_admin') || hasRole('super_admin') || hasRole('admin_tech'),
    canViewWebhooks: hasRole('platform_admin') || hasRole('super_admin') || hasRole('admin_tech'),
    canViewReports: hasRole('platform_admin') || hasRole('super_admin') || roles.some(r => r.includes('admin')) || isHRManager,
    canViewTeams: isAdmin,
    canViewDesignations: isAdmin,
    canViewPipelineStages: isAdmin,
    canManageTeams: isAdmin,
    canManageClients: true,
    canManageParticipants: true,
    canManageCampaigns: true,
    canDeleteMaster: isManagerOrAdmin,
    canDeleteClients: isManagerOrAdmin,
    canDeleteVendors: isManagerOrAdmin,
    canManageInventory: true,
    canDeleteInventory: isManagerOrAdmin,
    canManageProjects: true,
    canDeleteProjects: isAdmin,
    canRecommendLeaves: isManagerOrAdmin,
    canApproveLeaves: isHRAdmin || hasRole('platform_admin') || hasSubordinates === true,
    canViewAttendanceReports: isAuthorizedAttendanceUser || hasSubordinates === true,
    canViewCSBDDashboard: isCSBD || isLeadership || isAdmin,
    canViewCSBDProjections: isCSBD || isLeadership || isAdmin,
    canEditOwnCSBDProjections: isCSBD,
    // HR Admin permissions
    canManageHRDocuments: isHRAdmin || hasRole('platform_admin'),
    canManageSalarySlips: isHRAdmin || hasRole('platform_admin'),
    canOverrideLeaveApprovals: isHRAdmin || hasRole('platform_admin'),
    canAdjustLeaveBalances: isHRAdmin || hasRole('platform_admin'),
    canViewEmployeeDirectory: isHRAdmin || hasRole('platform_admin'),
    canManageOnboarding: isHRAdmin || isAdmin,
    // Navigation visibility permissions (used by DB-driven navigation)
    canViewDemandCom: true,
    canViewProjects: true,
    canViewClients: true,
    canViewInventory: true,
    canViewCampaigns: true,
    canManageDispositions: isAdmin,
  };
};

export const getRoleHierarchy = () => [
  'platform_admin',
  'super_admin',
  'admin_administration',
  'admin_tech',
  'admin',
  'hr_manager',
  'manager',
  'agent',
  'user',
  'client'
];

export const getRoleDisplayName = (role: string): string => {
  const roleMap: Record<string, string> = {
    platform_admin: 'Platform Admin',
    super_admin: 'Super Admin',
    admin_administration: 'Administration Admin',
    admin_tech: 'Tech Admin',
    admin: 'Admin',
    hr_manager: 'HR Manager',
    manager: 'Manager',
    agent: 'Agent',
    user: 'User',
    client: 'Client',
  };
  return roleMap[role] || role;
};

export const getRoleVariant = (role: string): "default" | "destructive" | "secondary" | "outline" => {
  if (role === 'platform_admin') return 'default';
  if (role === 'super_admin') return 'destructive';
  if (role.includes('admin')) return 'secondary';
  return 'outline';
};
