import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EmployeePersonalDetails {
  id: string;
  user_id: string;
  date_of_birth: string | null;
  marital_status: string | null;
  aadhar_number: string | null;
  father_name: string | null;
  mother_name: string | null;
  emergency_contact_number: string | null;
  personal_email: string | null;
  present_address: string | null;
  permanent_address: string | null;
  blood_group: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface EmployeeDirectoryRecord {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  location: string | null;
  employee_personal_details: EmployeePersonalDetails | null;
  employee_salary_details: {
    employee_code: string | null;
    department: string | null;
    pan_number: string | null;
    uan_number: string | null;
    pf_number: string | null;
  }[] | null;
}

export function useEmployeePersonalDetails(userId?: string) {
  const queryClient = useQueryClient();

  // Fetch personal details for a specific user
  const { data: personalDetails, isLoading, refetch } = useQuery({
    queryKey: ["employee-personal-details", userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from("employee_personal_details")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return data as EmployeePersonalDetails | null;
    },
    enabled: !!userId,
  });

  // Save or update personal details
  const savePersonalDetails = useMutation({
    mutationFn: async (details: Partial<EmployeePersonalDetails> & { user_id: string }) => {
      const { user_id, ...rest } = details;
      
      // Check if record exists
      const { data: existing } = await supabase
        .from("employee_personal_details")
        .select("id")
        .eq("user_id", user_id)
        .maybeSingle();

      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from("employee_personal_details")
          .update(rest)
          .eq("user_id", user_id);
        
        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from("employee_personal_details")
          .insert({ user_id, ...rest });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Personal details saved successfully");
      queryClient.invalidateQueries({ queryKey: ["employee-personal-details", userId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save personal details");
    },
  });

  return {
    personalDetails,
    isLoading,
    refetch,
    savePersonalDetails,
  };
}

// Hook for HR to view all employee directory
export function useEmployeeDirectory() {
  return useQuery({
    queryKey: ["employee-directory"],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, location")
        .not("email", "in", "(a@in-sync.co.in,s.ray@redefine.in)")
        .order("full_name");

      if (profilesError) throw profilesError;
      if (!profiles) return [];

      const userIds = profiles.map(p => p.id);

      // Fetch personal details separately
      const { data: personalDetails } = await supabase
        .from("employee_personal_details")
        .select("*")
        .in("user_id", userIds);

      // Fetch salary details separately
      const { data: salaryDetails } = await supabase
        .from("employee_salary_details")
        .select("user_id, employee_code, department, pan_number, uan_number, pf_number")
        .in("user_id", userIds);

      // Combine the data
      return profiles.map(profile => {
        const personal = personalDetails?.find(p => p.user_id === profile.id) || null;
        const salaryArr = salaryDetails?.filter(s => s.user_id === profile.id) || [];
        
        return {
          ...profile,
          employee_personal_details: personal as EmployeePersonalDetails | null,
          employee_salary_details: salaryArr.length > 0 ? salaryArr.map(s => ({
            employee_code: s.employee_code,
            department: s.department,
            pan_number: s.pan_number,
            uan_number: s.uan_number,
            pf_number: s.pf_number,
          })) : null,
        };
      }) as EmployeeDirectoryRecord[];
    },
  });
}
