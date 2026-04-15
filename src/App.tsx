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

import Projects from "./pages/Projects";
import ProjectForm from "./pages/ProjectForm";
import ProjectDetail from "./pages/ProjectDetail";
import Master from "./pages/Master";
import MasterForm from "./pages/MasterForm";
import Clients from "./pages/Clients";
import ClientForm from "./pages/ClientForm";
import Contacts from "./pages/Contacts";
import ContactForm from "./pages/ContactForm";
import DigicomDashboard from "./pages/DigicomDashboard";
import DigicomTasks from "./pages/DigicomTasks";
import Users from "./pages/Users";
import MyProfile from "./pages/MyProfile";
import Teams from "./pages/Teams";
import Designations from "./pages/Designations";
import CallDispositions from "./pages/CallDispositions";
import Tasks from "./pages/Tasks";
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
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Chat from "./pages/Chat";
// WhatsApp settings removed from frontend — managed via backend only
import OnboardingPublicForm from "./pages/OnboardingPublicForm";
import HROnboardingAdmin from "./pages/HROnboardingAdmin";
import VapiScheduler from "./pages/VapiScheduler";

import DataExport from "./pages/DataExport";
import TicketTracker from "./pages/TicketTracker";
import TravelExpenseClaims from "./pages/TravelExpenseClaims";
import TravelExpenseApprovals from "./pages/TravelExpenseApprovals";
import ApprovalResult from "./pages/ApprovalResult";
import KPISelfAssessment from "./pages/KPISelfAssessment";
import KPITeamDashboard from "./pages/KPITeamDashboard";
import KPIRoleAssessment from "./pages/KPIRoleAssessment";
import KPIRoleTeamDashboard from "./pages/KPIRoleTeamDashboard";
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
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/ticket-status" element={<TicketTracker />} />
            <Route path="/approval-result" element={<ApprovalResult />} />
            
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
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/contacts/new" element={<ContactForm />} />
              <Route path="/contacts/:id" element={<ContactForm />} />
              <Route path="/digicom-dashboard" element={<DigicomDashboard />} />
              <Route path="/digicom-tasks" element={<DigicomTasks />} />
              <Route path="/users" element={<Users />} />
              <Route path="/my-profile" element={<MyProfile />} />
              <Route path="/teams" element={<Teams />} />
              <Route path="/designations" element={<Designations />} />
              <Route path="/call-dispositions" element={<CallDispositions />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/leave-management" element={<LeaveManagement />} />
              <Route path="/leave-approvals" element={<LeaveApprovals />} />
              <Route path="/leave-limits" element={<LeaveLimitsAdmin />} />
              <Route path="/regularization-approvals" element={<AttendanceRegularizationApprovals />} />
              <Route path="/attendance-reports" element={<AttendanceReports />} />
              <Route path="/csbd-projections" element={<CSBDProjections />} />
              <Route path="/csbd-targets" element={<CSBDTargets />} />
              
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
              {/* WhatsApp settings removed — managed via backend */}
              <Route path="/vapi-scheduler" element={<VapiScheduler />} />
              <Route path="/travel-expenses" element={<TravelExpenseClaims />} />
              <Route path="/travel-expense-approvals" element={<TravelExpenseApprovals />} />
              <Route path="/kpi-self-assessment" element={<KPISelfAssessment />} />
              <Route path="/kpi-team-dashboard" element={<KPITeamDashboard />} />
              <Route path="/kpi-role-assessment" element={<KPIRoleAssessment />} />
              <Route path="/kpi-role-team-dashboard" element={<KPIRoleTeamDashboard />} />

              <Route path="/admin/data-export" element={<DataExport />} />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
