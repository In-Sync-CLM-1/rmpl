import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatLocalDateString } from '@/lib/dateUtils';

export interface CompanyHoliday {
  id: string;
  year: number;
  holiday_date: string;
  holiday_name: string;
  day_of_week: string | null;
  is_optional: boolean;
  applicable_locations: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OptionalHolidayClaim {
  id: string;
  user_id: string;
  holiday_id: string | null;
  year: number;
  claim_type: string;
  claim_date: string | null;
  claimed_at: string;
}

// Generate 2nd and 4th Saturday holidays for a year
function generate2nd4thSaturdayHolidays(year: number): CompanyHoliday[] {
  const saturdays: CompanyHoliday[] = [];
  
  for (let month = 0; month < 12; month++) {
    let saturdayCount = 0;
    const date = new Date(year, month, 1);
    
    while (date.getMonth() === month) {
      if (date.getDay() === 6) { // Saturday
        saturdayCount++;
        if (saturdayCount === 2 || saturdayCount === 4) {
          saturdays.push({
            id: `sat-${year}-${month}-${saturdayCount}`,
            year,
            holiday_date: formatLocalDateString(date),
            holiday_name: `${saturdayCount === 2 ? '2nd' : '4th'} Saturday`,
            day_of_week: 'Saturday',
            is_optional: false,
            applicable_locations: ['Delhi', 'Bangaluru', 'Mumbai'],
            notes: 'Office closed on 2nd & 4th Saturdays',
            created_at: '',
            updated_at: '',
          });
        }
      }
      date.setDate(date.getDate() + 1);
    }
  }
  
  return saturdays;
}

export const useCompanyHolidays = (year: number = new Date().getFullYear()) => {
  const queryClient = useQueryClient();

  const { data: dbHolidays = [], isLoading: holidaysLoading, error: holidaysError } = useQuery({
    queryKey: ['company-holidays', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_holidays')
        .select('*')
        .eq('year', year)
        .order('holiday_date', { ascending: true });

      if (error) throw error;
      return data as CompanyHoliday[];
    },
  });

  // Merge database holidays with generated 2nd/4th Saturday holidays
  const saturdayHolidays = generate2nd4thSaturdayHolidays(year);
  const holidays = [...dbHolidays, ...saturdayHolidays].sort(
    (a, b) => new Date(a.holiday_date).getTime() - new Date(b.holiday_date).getTime()
  );

  const { data: userClaims = [], isLoading: claimsLoading } = useQuery({
    queryKey: ['optional-holiday-claims', year],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_optional_holiday_claims')
        .select('*')
        .eq('user_id', user.id)
        .eq('year', year);

      if (error) throw error;
      return data as OptionalHolidayClaim[];
    },
  });

  const { data: userLocation } = useQuery({
    queryKey: ['user-location'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 'Delhi';

      const { data, error } = await supabase
        .from('profiles')
        .select('location')
        .eq('id', user.id)
        .single();

      if (error) return 'Delhi';
      return data?.location || 'Delhi';
    },
  });

  const claimOptionalHoliday = useMutation({
    mutationFn: async ({ claimType, claimDate }: { claimType: string; claimDate: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if user has already claimed 2 optional holidays this year
      if (userClaims.length >= 2) {
        throw new Error('You have already claimed 2 optional holidays this year');
      }

      // Check if this claim type is already used
      const existingClaim = userClaims.find(c => c.claim_type === claimType);
      if (existingClaim) {
        throw new Error(`You have already claimed an optional holiday for ${claimType}`);
      }

      const { data, error } = await supabase
        .from('user_optional_holiday_claims')
        .insert({
          user_id: user.id,
          year,
          claim_type: claimType,
          claim_date: claimDate,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['optional-holiday-claims', year] });
      toast.success('Optional holiday claimed successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteOptionalHolidayClaim = useMutation({
    mutationFn: async (claimId: string) => {
      const { error } = await supabase
        .from('user_optional_holiday_claims')
        .delete()
        .eq('id', claimId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['optional-holiday-claims', year] });
      toast.success('Optional holiday claim removed');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Filter holidays applicable to user's location
  const applicableHolidays = holidays.filter(holiday => {
    if (!holiday.applicable_locations) return true;
    if (holiday.applicable_locations.includes('all')) return true;
    return holiday.applicable_locations.includes(userLocation || 'Delhi');
  });

  // Get upcoming holidays (next 3 months)
  const today = new Date();
  const threeMonthsLater = new Date(today);
  threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

  const upcomingHolidays = applicableHolidays.filter(holiday => {
    const holidayDate = new Date(holiday.holiday_date);
    return holidayDate >= today && holidayDate <= threeMonthsLater;
  });

  return {
    holidays,
    applicableHolidays,
    upcomingHolidays,
    userClaims,
    userLocation,
    isLoading: holidaysLoading || claimsLoading,
    error: holidaysError,
    claimOptionalHoliday,
    deleteOptionalHolidayClaim,
    remainingOptionalHolidays: 2 - userClaims.length,
  };
};

export const isHolidayDate = (date: Date, holidays: CompanyHoliday[], userLocation: string): CompanyHoliday | null => {
  const dateStr = formatLocalDateString(date);
  return holidays.find(h => {
    if (h.holiday_date !== dateStr) return false;
    if (!h.applicable_locations) return true;
    if (h.applicable_locations.includes('all')) return true;
    return h.applicable_locations.includes(userLocation);
  }) || null;
};

export const countWorkingDays = (
  startDate: Date,
  endDate: Date,
  holidays: CompanyHoliday[],
  userLocation: string
): { totalDays: number; workingDays: number; holidayDays: number } => {
  let totalDays = 0;
  let holidayDays = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    totalDays++;
    const dayOfWeek = current.getDay();
    
    // Check if it's a weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Weekend - not counted as working day anyway
    } else if (isHolidayDate(current, holidays, userLocation)) {
      holidayDays++;
    }
    
    current.setDate(current.getDate() + 1);
  }

  return {
    totalDays,
    workingDays: totalDays - holidayDays,
    holidayDays,
  };
};
