import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/supabase-client.ts";
import { corsHeaders, handleCorsPreflightRequest } from "../_shared/cors-headers.ts";
import { successResponse, errorResponse } from "../_shared/response-helpers.ts";

interface BulkGenerateRequest {
  month: number;
  year: number;
  publish?: boolean;
}

function numberToWords(num: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const convert = (n: number): string => {
    if (n === 0) return "";
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + convert(n % 100) : "");
    if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
    if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + convert(n % 100000) : "");
    return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + convert(n % 10000000) : "");
  };

  if (num === 0) return "Zero Rupees Only";
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  
  let result = convert(rupees) + " Rupees";
  if (paise > 0) {
    result += " and " + convert(paise) + " Paise";
  }
  return result + " Only";
}

// Check if a date is a week-off (Sunday or 2nd/4th Saturday)
function isWeekOff(date: Date): boolean {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0) return true; // Sunday
  if (dayOfWeek === 6) {
    const dayOfMonth = date.getDate();
    const weekOfMonth = Math.ceil(dayOfMonth / 7);
    return weekOfMonth === 2 || weekOfMonth === 4;
  }
  return false;
}

// Get all dates in a month
function getMonthDates(year: number, month: number): Date[] {
  const dates: Date[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(new Date(year, month - 1, d));
  }
  return dates;
}

// Count holidays for a user in a given month
function countHolidays(
  monthDates: Date[],
  holidays: { holiday_date: string; is_optional: boolean | null; applicable_locations: string[] | null }[],
  userLocation?: string | null
): number {
  let count = 0;
  for (const date of monthDates) {
    if (isWeekOff(date)) continue; // Don't double-count week-offs
    const dateStr = date.toISOString().split("T")[0];
    const isHoliday = holidays.some((h) => {
      if (h.holiday_date !== dateStr) return false;
      if (h.is_optional) return false;
      if (!h.applicable_locations || h.applicable_locations.length === 0) return true;
      return userLocation ? h.applicable_locations.includes(userLocation) : true;
    });
    if (isHoliday) count++;
  }
  return count;
}

// Count week-offs in a month (excluding holidays to avoid double-count)
function countWeekOffs(monthDates: Date[]): number {
  return monthDates.filter((d) => isWeekOff(d)).length;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest();
  }

  try {
    const supabase = createServiceClient();
    const body: BulkGenerateRequest = await req.json();
    
    const { month, year, publish = false } = body;

    if (!month || !year) {
      return errorResponse("month and year are required", 400);
    }

    // Get all employees with salary details
    const { data: employees, error: empError } = await supabase
      .from("employee_salary_details")
      .select("*");

    if (empError) throw empError;
    if (!employees || employees.length === 0) {
      return errorResponse("No employees with salary details found", 404);
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthDates = getMonthDates(year, month);

    // Fetch company holidays for this month
    const { data: holidays } = await supabase
      .from("company_holidays")
      .select("holiday_date, is_optional, applicable_locations")
      .gte("holiday_date", startDate)
      .lte("holiday_date", endDate);

    // Fetch all approved leaves for this month (with date ranges for per-day logic)
    const { data: allLeaves } = await supabase
      .from("leave_applications")
      .select("user_id, start_date, end_date, total_days, leave_type, half_day, sandwich_days, leave_calculation")
      .eq("status", "approved")
      .lte("start_date", endDate)
      .gte("end_date", startDate);

    // Fetch profiles for location info
    const userIds = employees.map((e) => e.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, location")
      .in("id", userIds);

    // Fetch all attendance for this month in one query
    const { data: allAttendance } = await supabase
      .from("attendance_records")
      .select("user_id, date, status")
      .in("user_id", userIds)
      .gte("date", startDate)
      .lte("date", endDate);

    const results = {
      generated: 0,
      updated: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const salaryDetails of employees) {
      try {
        // Build attendance map for this user
        const userAttendance = (allAttendance || []).filter(a => a.user_id === salaryDetails.user_id);
        const attendanceMap = new Map<string, string>();
        for (const a of userAttendance) {
          attendanceMap.set(a.date, a.status);
        }

        // Build paid leave dates set for this user, including sandwich days
        const userLeaves = (allLeaves || []).filter(l => l.user_id === salaryDetails.user_id && l.leave_type !== "unpaid_leave");
        const leaveDates = new Set<string>();
        for (const leave of userLeaves) {
          const ls = new Date(leave.start_date);
          const le = new Date(leave.end_date);
          for (let d = new Date(ls); d <= le; d.setDate(d.getDate() + 1)) {
            leaveDates.add(d.toISOString().split("T")[0]);
          }
          // Include sandwich weekend/holiday dates so they count as leave, not as free week-offs
          if (leave.sandwich_days && leave.sandwich_days > 0 && leave.leave_calculation) {
            const calc = leave.leave_calculation as { weekend_dates?: string[]; holiday_dates?: string[] };
            for (const wd of (calc.weekend_dates || [])) { leaveDates.add(wd); }
            for (const hd of (calc.holiday_dates || [])) { leaveDates.add(hd); }
          }
        }

        // Get user location for holiday matching
        const userProfile = profiles?.find(p => p.id === salaryDetails.user_id);

        // For each day, assign exactly ONE status and sum paid days
        let paidDays = 0;
        for (const date of monthDates) {
          const dateStr = date.toISOString().split("T")[0];
          const attStatus = attendanceMap.get(dateStr);

          // Priority 1: Attendance record exists
          if (attStatus === "present") { paidDays += 1; continue; }
          if (attStatus === "half_day") { paidDays += 0.5; continue; }

          // Priority 2: Paid leave
          if (leaveDates.has(dateStr)) { paidDays += 1; continue; }

          // Priority 3: Company holiday (non-optional, location-matched)
          const isHoliday = (holidays || []).some((h) => {
            if (h.holiday_date !== dateStr) return false;
            if (h.is_optional) return false;
            if (!h.applicable_locations || h.applicable_locations.length === 0) return true;
            return userProfile?.location ? h.applicable_locations.includes(userProfile.location) : true;
          });
          if (isHoliday) { paidDays += 1; continue; }

          // Priority 4: Week-off
          if (isWeekOff(date)) { paidDays += 1; continue; }

          // Otherwise: absent (not paid)
        }

        const lopDays = Math.max(0, daysInMonth - paidDays);

        // Calculate earnings
        const basicSalary = Number(salaryDetails.basic_salary) || 0;
        const hra = Number(salaryDetails.hra) || 0;
        const conveyanceAllowance = Number(salaryDetails.conveyance_allowance) || 0;
        const medicalAllowance = Number(salaryDetails.medical_allowance) || 0;
        const specialAllowance = Number(salaryDetails.special_allowance) || 0;
        const otherAllowance = Number(salaryDetails.other_allowance) || 0;

        // Pro-rate based on paid days
        const proRateFactor = Math.min(paidDays / daysInMonth, 1);
        const proratedBasic = Math.round(basicSalary * proRateFactor);
        const proratedHra = Math.round(hra * proRateFactor);
        const proratedConveyance = Math.round(conveyanceAllowance * proRateFactor);
        const proratedMedical = Math.round(medicalAllowance * proRateFactor);
        const proratedSpecial = Math.round(specialAllowance * proRateFactor);
        const proratedOther = Math.round(otherAllowance * proRateFactor);

        const totalEarnings = proratedBasic + proratedHra + proratedConveyance + proratedMedical + proratedSpecial + proratedOther;

        // Calculate deductions
        const epfPercentage = Number(salaryDetails.epf_percentage) || 12;
        const esicPercentage = Number(salaryDetails.esic_percentage) || 0;
        const professionalTax = Number(salaryDetails.professional_tax) || 200;

        const epfBase = Math.min(proratedBasic, 15000);
        const epf = Math.round((epfBase * epfPercentage) / 100);
        const esic = esicPercentage > 0 ? Math.round((totalEarnings * esicPercentage) / 100) : 0;

        const totalDeductions = epf + esic + professionalTax;
        const netPay = totalEarnings - totalDeductions;
        const netPayWords = numberToWords(netPay);

        // Check if slip already exists
        const { data: existingSlip } = await supabase
          .from("salary_slips")
          .select("id")
          .eq("user_id", salaryDetails.user_id)
          .eq("month", month)
          .eq("year", year)
          .single();

        const slipData = {
          user_id: salaryDetails.user_id,
          month,
          year,
          paid_days: paidDays,
          loss_of_pay_days: lopDays,
          basic_salary: proratedBasic,
          hra: proratedHra,
          conveyance_allowance: proratedConveyance,
          medical_allowance: proratedMedical,
          special_allowance: proratedSpecial,
          other_allowance: proratedOther,
          incentive: 0,
          bonus: 0,
          total_earnings: totalEarnings,
          epf,
          esic,
          tds: 0,
          professional_tax: professionalTax,
          health_insurance: 0,
          salary_advance: 0,
          other_deductions: 0,
          total_deductions: totalDeductions,
          net_pay: netPay,
          net_pay_words: netPayWords,
          is_published: publish,
          generated_at: new Date().toISOString(),
        };

        if (existingSlip) {
          const { error } = await supabase
            .from("salary_slips")
            .update(slipData)
            .eq("id", existingSlip.id);
          
          if (error) throw error;
          results.updated++;
        } else {
          const { error } = await supabase
            .from("salary_slips")
            .insert(slipData);
          
          if (error) throw error;
          results.generated++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`User ${salaryDetails.user_id}: ${error.message}`);
      }
    }

    return successResponse({
      success: true,
      results,
      message: `Processed ${results.generated + results.updated} salary slips (${results.generated} new, ${results.updated} updated, ${results.failed} failed)`,
    });

  } catch (error) {
    console.error("Error bulk generating salary slips:", error);
    return errorResponse(error.message || "Failed to bulk generate salary slips", 500);
  }
});
