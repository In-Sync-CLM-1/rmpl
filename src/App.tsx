import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import DemandCom from "./pages/DemandCom";
import DemandComForm from "./pages/DemandComForm";
import DemandComDashboard from "./pages/DemandComDashboard";
import DemandComDailyTargets from "./pages/DemandComDailyTargets";
import Attendance from "./pages/Attendance";
import LeaveManagement from "./pages/LeaveManagement";
import LeaveApprovals from "./pages/LeaveApprovals";
import LeaveLimitsAdmin from "./pages/LeaveLimitsAdmin";
import AttendanceRegularizationApprovals from "./pages/AttendanceRegularizationApprovals";
import AttendanceReports from "./pages/AttendanceReports";
import CSBDProjections from "./pages/CSBDProjections";
import CSBDTargets from "./pages/CSBDTargets";
import Templates from "./pages/Templates";
import EmailTemplateForm from "./pages/EmailTemplateForm";
import SMSTemplateForm from "./pages/SMSTemplateForm";
import Campaigns from "./pages/Campaigns";
import CampaignForm from "./pages/CampaignForm";
import CampaignAnalytics from "./pages/CampaignAnalytics";
import Projects from "./pages/Projects";
import ProjectForm from "./pages/ProjectForm";
import ProjectDetail from "./pages/ProjectDetail";
import Master from "./pages/Master";
import MasterForm from "./pages/MasterForm";
import Clients from "./pages/Clients";
import ClientForm from "./pages/ClientForm";
import Vendors from "./pages/Vendors";
import VendorForm from "./pages/VendorForm";
import Inventory from "./pages/Inventory";
import InventoryForm from "./pages/InventoryForm";
import InventoryDashboard from "./pages/InventoryDashboard";
import InventoryAllocation from "./pages/InventoryAllocation";
import InventoryReturns from "./pages/InventoryReturns";
import InventoryHistory from "./pages/InventoryHistory";
import InventoryReports from "./pages/InventoryReports";
import InventorySerialEntry from "./pages/InventorySerialEntry";
import OperationsDistribution from "./pages/OperationsDistribution";
import OperationsInventoryDashboard from "./pages/OperationsInventoryDashboard";
import Webhooks from "./pages/Webhooks";
import Inbox from "./pages/Inbox";
import Users from "./pages/Users";
import MyProfile from "./pages/MyProfile";
import Teams from "./pages/Teams";
import Designations from "./pages/Designations";
import PipelineStages from "./pages/PipelineStages";
import CallDispositions from "./pages/CallDispositions";
import Tasks from "./pages/Tasks";
import WhatsNew from "./pages/WhatsNew";
import Announcements from "./pages/Announcements";
import Calendar from "./pages/Calendar";
import LiveComDashboard from "./pages/LiveComDashboard";
import ViewControllerAdmin from "./pages/ViewControllerAdmin";
import CashflowDashboard from "./pages/CashflowDashboard";
import VoiceAssistant from "./pages/VoiceAssistant";
import HRDocuments from "./pages/HRDocuments";
import HRPolicies from "./pages/HRPolicies";
import SalarySlips from "./pages/SalarySlips";
import SalarySlipsAdmin from "./pages/SalarySlipsAdmin";
import NewJoinerDocuments from "./pages/NewJoinerDocuments";
import EmployeeDirectory from "./pages/EmployeeDirectory";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";
import Chat from "./pages/Chat";
import WhatsAppSettings from "./pages/WhatsAppSettings";
import MicrosoftCallback from "./pages/MicrosoftCallback";
import OnboardingPublicForm from "./pages/OnboardingPublicForm";
import HROnboardingAdmin from "./pages/HROnboardingAdmin";
import VapiScheduler from "./pages/VapiScheduler";
import SupportTickets from "./pages/SupportTickets";
import DataExport from "./pages/DataExport";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes default
      gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
      refetchOnWindowFocus: false, // Don't refetch on tab focus
      retry: 1, // Reduce retry attempts
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Auth />} />
            <Route path="/install" element={<Install />} />
            <Route path="/welcome" element={<Index />} />
            <Route path="/onboarding/:slug" element={<OnboardingPublicForm />} />
            
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/executive-dashboard" element={<ExecutiveDashboard />} />
              <Route path="/demandcom" element={<DemandCom />} />
              <Route path="/demandcom/new" element={<DemandComForm />} />
              <Route path="/demandcom/:id" element={<DemandComForm />} />
              <Route path="/demandcom-dashboard" element={<DemandComDashboard />} />
              <Route path="/demandcom-daily-targets" element={<DemandComDailyTargets />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/templates/email/new" element={<EmailTemplateForm />} />
              <Route path="/templates/email/:id" element={<EmailTemplateForm />} />
              <Route path="/templates/sms/new" element={<SMSTemplateForm />} />
              <Route path="/templates/sms/:id" element={<SMSTemplateForm />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/campaigns/new" element={<CampaignForm />} />
              <Route path="/campaigns/:id" element={<CampaignForm />} />
              <Route path="/campaigns/:id/analytics" element={<CampaignAnalytics />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/new" element={<ProjectForm />} />
              <Route path="/projects/edit/:id" element={<ProjectForm />} />
              <Route path="/projects/view/:id" element={<ProjectDetail />} />
              <Route path="/master" element={<Master />} />
              <Route path="/master/new" element={<MasterForm />} />
              <Route path="/master/:id" element={<MasterForm />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/new" element={<ClientForm />} />
            <Route path="/clients/:id" element={<ClientForm />} />
              <Route path="/vendors" element={<Vendors />} />
              <Route path="/vendors/new" element={<VendorForm />} />
              <Route path="/vendors/:id" element={<VendorForm />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/inventory/new" element={<InventoryForm />} />
              <Route path="/inventory/:id/edit" element={<InventoryForm />} />
              <Route path="/inventory-dashboard" element={<InventoryDashboard />} />
              <Route path="/inventory-allocation" element={<InventoryAllocation />} />
              <Route path="/inventory-returns" element={<InventoryReturns />} />
              <Route path="/inventory-history" element={<InventoryHistory />} />
              <Route path="/inventory-reports" element={<InventoryReports />} />
              <Route path="/inventory-serial-entry" element={<InventorySerialEntry />} />
              <Route path="/operations-distribution" element={<OperationsDistribution />} />
              <Route path="/operations-inventory-dashboard" element={<OperationsInventoryDashboard />} />
              <Route path="/webhooks" element={<Webhooks />} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/users" element={<Users />} />
              <Route path="/my-profile" element={<MyProfile />} />
              <Route path="/teams" element={<Teams />} />
              <Route path="/designations" element={<Designations />} />
              <Route path="/pipeline-stages" element={<PipelineStages />} />
              <Route path="/call-dispositions" element={<CallDispositions />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/leave-management" element={<LeaveManagement />} />
              <Route path="/leave-approvals" element={<LeaveApprovals />} />
              <Route path="/leave-limits" element={<LeaveLimitsAdmin />} />
              <Route path="/regularization-approvals" element={<AttendanceRegularizationApprovals />} />
              <Route path="/attendance-reports" element={<AttendanceReports />} />
              <Route path="/whats-new" element={<WhatsNew />} />
              <Route path="/csbd-projections" element={<CSBDProjections />} />
              <Route path="/csbd-targets" element={<CSBDTargets />} />
              
              <Route path="/announcements" element={<Announcements />} />
              <Route path="/livecom-dashboard" element={<LiveComDashboard />} />
              <Route path="/view-controller" element={<ViewControllerAdmin />} />
              <Route path="/cashflow-dashboard" element={<CashflowDashboard />} />
              <Route path="/voice-assistant" element={<VoiceAssistant />} />
              <Route path="/hr-documents" element={<HRDocuments />} />
              <Route path="/hr-policies" element={<HRPolicies />} />
              <Route path="/salary-slips" element={<SalarySlips />} />
              <Route path="/salary-slips-admin" element={<SalarySlipsAdmin />} />
              <Route path="/new-joiner-documents" element={<NewJoinerDocuments />} />
              <Route path="/employee-directory" element={<EmployeeDirectory />} />
              <Route path="/hr-onboarding" element={<HROnboardingAdmin />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/chat/:conversationId" element={<Chat />} />
              <Route path="/whatsapp-settings" element={<WhatsAppSettings />} />
              <Route path="/vapi-scheduler" element={<VapiScheduler />} />
              <Route path="/support-tickets" element={<SupportTickets />} />
              <Route path="/admin/data-export" element={<DataExport />} />
            </Route>
            
            <Route path="/auth/microsoft/callback" element={<MicrosoftCallback />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
