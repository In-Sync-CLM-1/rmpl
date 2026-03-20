import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getNowISTISOString } from "@/lib/dateUtils";

export type RegularizationType = 
  | 'forgot_signin'
  | 'forgot_signout'
  | 'time_correction'
  | 'location_issue'
  | 'other';

export type RegularizationStatus = 'pending' | 'approved' | 'rejected';

export interface AttendanceRegularization {
  id: string;
  user_id: string;
  attendance_date: string;
  regularization_type: RegularizationType;
  original_sign_in_time: string | null;
  original_sign_out_time: string | null;
  requested_sign_in_time: string | null;
  requested_sign_out_time: string | null;
  reason: string;
  status: RegularizationStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegularizationWithProfile extends AttendanceRegularization {
  profile?: {
    id: string;
    full_name: string | null;
    email: string | null;
  };
}

export interface CreateRegularizationInput {
  attendance_date: string;
  regularization_type: RegularizationType;
  original_sign_in_time?: string | null;
  original_sign_out_time?: string | null;
  requested_sign_in_time?: string | null;
  requested_sign_out_time?: string | null;
  reason: string;
}

export function useAttendanceRegularization() {
  const queryClient = useQueryClient();

  const staleTime = 2 * 60 * 1000; // 2 minutes

  // Get current user
  const { data: user } = useQuery({
    queryKey: ["user"],
    staleTime: 5 * 60 * 1000, // 5 minutes for user data
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Fetch user's manager info
  const { data: managerInfo } = useQuery({
    queryKey: ["user-manager", user?.id],
    staleTime: 10 * 60 * 1000, // 10 minutes for manager info
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("reports_to")
        .eq("id", user.id)
        .single();
      
      if (!profile?.reports_to) return null;
      
      const { data: manager } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", profile.reports_to)
        .single();
      
      return manager;
    },
    enabled: !!user?.id,
  });

  // Fetch user's own regularization requests
  const { data: myRegularizations, isLoading: loadingMyRegularizations } = useQuery({
    queryKey: ["my-regularizations", user?.id],
    staleTime,
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("attendance_regularizations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AttendanceRegularization[];
    },
    enabled: !!user?.id,
  });

  // Check if user can approve (is a manager or admin)
  const { data: canApprove } = useQuery({
    queryKey: ["can-approve-regularizations", user?.id],
    staleTime: 10 * 60 * 1000, // 10 minutes for permissions
    queryFn: async () => {
      if (!user?.id) return false;
      
      // Check if user has admin roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      const isHR = roles?.some(r => r.role === 'hr_manager') || false;
      if (isHR) return true;
      
      // Check if user has any subordinates
      const { data: subordinates } = await supabase
        .from("profiles")
        .select("id")
        .eq("reports_to", user.id)
        .limit(1);
      
      return subordinates && subordinates.length > 0;
    },
    enabled: !!user?.id,
  });

  // Fetch pending regularizations for approval (managers/admins)
  const { data: pendingRegularizations, isLoading: loadingPending } = useQuery({
    queryKey: ["pending-regularizations", user?.id],
    staleTime,
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Get subordinates first
      const { data: subordinates } = await supabase
        .from("profiles")
        .select("id")
        .eq("reports_to", user.id);
      
      const subordinateIds = subordinates?.map(s => s.id) || [];
      
      // Check for admin roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      const isHR = roles?.some(r => r.role === 'hr_manager') || false;
      
      let query = supabase
        .from("attendance_regularizations")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      
      // If not admin, filter to only subordinates
      if (!isHR && subordinateIds.length > 0) {
        query = query.in("user_id", subordinateIds);
      } else if (!isHR) {
        return [];
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((r: any) => r.user_id))];
        
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        
        return data.map((reg: any) => ({
          ...reg,
          profile: profiles?.find(p => p.id === reg.user_id) || { full_name: "Unknown", email: "" }
        })) as RegularizationWithProfile[];
      }
      
      return data as RegularizationWithProfile[] || [];
    },
    enabled: !!user?.id && canApprove === true,
  });

  // Create regularization request
  const createRegularization = useMutation({
    mutationFn: async (input: CreateRegularizationInput) => {
      if (!user?.id) throw new Error("User not found");
      
      const { error } = await supabase
        .from("attendance_regularizations")
        .insert({
          user_id: user.id,
          ...input,
        });
      
      if (error) throw error;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["my-regularizations"] });
      toast.success("Regularization request submitted successfully!");

      // Send approval email to manager
      try {
        if (!user?.id) return;
        const { data: latest } = await supabase
          .from("attendance_regularizations")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (latest) {
          await supabase.functions.invoke("send-approval-email", {
            body: { request_type: "regularization", request_id: latest.id },
          });
        }
      } catch (emailErr) {
        console.error("Failed to send approval email:", emailErr);
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to submit request: " + error.message);
    },
  });

  // Approve regularization
  const approveRegularization = useMutation({
    mutationFn: async (regularizationId: string) => {
      if (!user?.id) throw new Error("User not found");
      
      const { error } = await supabase
        .from("attendance_regularizations")
        .update({
          status: "approved",
          approved_by: user.id,
          approved_at: getNowISTISOString(),
        })
        .eq("id", regularizationId);
      
      if (error) throw error;
    },
    onSuccess: async (_data, regularizationId) => {
      queryClient.invalidateQueries({ queryKey: ["pending-regularizations"] });
      queryClient.invalidateQueries({ queryKey: ["my-regularizations"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-recent"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      toast.success("Regularization approved! Attendance record updated.");

      // Send employee notification
      try {
        const reg = pendingRegularizations?.find((r: any) => r.id === regularizationId);
        if (reg?.profile?.email) {
          await supabase.functions.invoke("send-approval-email", {
            body: {
              notification_type: "result",
              request_type: "regularization",
              employee_name: reg.profile.full_name,
              employee_email: reg.profile.email,
              approver_name: "HR/Manager",
              status: "approved",
            },
          });
        }
      } catch (emailErr) {
        console.error("Failed to send employee notification:", emailErr);
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to approve: " + error.message);
    },
  });

  // Reject regularization
  const rejectRegularization = useMutation({
    mutationFn: async ({ regularizationId, reason }: { regularizationId: string; reason: string }) => {
      if (!user?.id) throw new Error("User not found");

      const { error } = await supabase
        .from("attendance_regularizations")
        .update({
          status: "rejected",
          approved_by: user.id,
          approved_at: getNowISTISOString(),
          rejection_reason: reason,
        })
        .eq("id", regularizationId);

      if (error) throw error;
    },
    onSuccess: async (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pending-regularizations"] });
      queryClient.invalidateQueries({ queryKey: ["my-regularizations"] });
      toast.success("Regularization request rejected.");

      // Send employee notification
      try {
        const reg = pendingRegularizations?.find((r: any) => r.id === variables.regularizationId);
        if (reg?.profile?.email) {
          await supabase.functions.invoke("send-approval-email", {
            body: {
              notification_type: "result",
              request_type: "regularization",
              employee_name: reg.profile.full_name,
              employee_email: reg.profile.email,
              approver_name: "HR/Manager",
              status: "rejected",
              rejection_reason: variables.reason,
            },
          });
        }
      } catch (emailErr) {
        console.error("Failed to send employee notification:", emailErr);
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to reject: " + error.message);
    },
  });

  // Delete own pending regularization
  const deleteRegularization = useMutation({
    mutationFn: async (regularizationId: string) => {
      const { error } = await supabase
        .from("attendance_regularizations")
        .delete()
        .eq("id", regularizationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-regularizations"] });
      toast.success("Request deleted.");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete: " + error.message);
    },
  });

  // Get attendance record for a specific date
  const getAttendanceForDate = async (date: string) => {
    if (!user?.id) return null;
    
    const { data, error } = await supabase
      .from("attendance_records")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", date)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  };

  return {
    user,
    managerInfo,
    myRegularizations,
    loadingMyRegularizations,
    pendingRegularizations,
    loadingPending,
    canApprove,
    createRegularization,
    approveRegularization,
    rejectRegularization,
    deleteRegularization,
    getAttendanceForDate,
  };
}
