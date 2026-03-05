import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/supabase-client.ts";
import { corsHeaders, handleCorsPreflightRequest } from "../_shared/cors-headers.ts";
import { successResponse, errorResponse } from "../_shared/response-helpers.ts";

interface GenerateRequest {
  user_id: string;
  month: number;
  year: number;
  paid_days?: number;
  loss_of_pay_days?: number;
  incentive?: number;
  bonus?: number;
  other_deductions?: number;
  remarks?: string;
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest();
  }

  try {
    const supabase = createServiceClient();
    const body: GenerateRequest = await req.json();
    
    const { user_id, month, year, paid_days, loss_of_pay_days = 0, incentive = 0, bonus = 0, other_deductions = 0, remarks } = body;

    if (!user_id || !month || !year) {
      return errorResponse("user_id, month, and year are required", 400);
    }

    // Get employee salary details
    const { data: salaryDetails, error: detailsError } = await supabase
      .from("employee_salary_details")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (detailsError || !salaryDetails) {
      return errorResponse("Employee salary details not found", 404);
    }

    const daysInMonth = new Date(year, month, 0).getDate();

    // Calculate paid days from attendance + leaves + holidays + weekoffs if not provided
    let calculatedPaidDays = paid_days;
    if (calculatedPaidDays === undefined) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      const monthDates = getMonthDates(year, month);
      
      // Fetch attendance records with dates
      const { data: attendance } = await supabase
        .from("attendance_records")
        .select("date, status")
        .eq("user_id", user_id)
        .gte("date", startDate)
        .lte("date", endDate);

      // Fetch approved paid leaves overlapping this month
      const { data: leaves } = await supabase
        .from("leave_applications")
        .select("start_date, end_date, total_days, leave_type, half_day, sandwich_days, leave_calculation")
        .eq("user_id", user_id)
        .eq("status", "approved")
        .lte("start_date", endDate)
        .gte("end_date", startDate);

      // Fetch company holidays
      const { data: holidays } = await supabase
        .from("company_holidays")
        .select("holiday_date, is_optional, applicable_locations")
        .gte("holiday_date", startDate)
        .lte("holiday_date", endDate);

      // Get user location
      const { data: profile } = await supabase
        .from("profiles")
        .select("location")
        .eq("id", user_id)
        .single();

      // Build a set of leave dates (paid leaves only), including sandwich days
      const leaveDates = new Set<string>();
      for (const leave of (leaves || [])) {
        if (leave.leave_type === "unpaid_leave") continue;
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

      // Build attendance map
      const attendanceMap = new Map<string, string>();
      for (const a of (attendance || [])) {
        attendanceMap.set(a.date, a.status);
      }

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
          return profile?.location ? h.applicable_locations.includes(profile.location) : true;
        });
        if (isHoliday) { paidDays += 1; continue; }

        // Priority 4: Week-off
        if (isWeekOff(date)) { paidDays += 1; continue; }

        // Otherwise: absent (not paid)
      }

      calculatedPaidDays = paidDays;
    }

    const calculatedLopDays = loss_of_pay_days || Math.max(0, daysInMonth - calculatedPaidDays);

    // Calculate earnings
    const basicSalary = Number(salaryDetails.basic_salary) || 0;
    const hra = Number(salaryDetails.hra) || 0;
    const conveyanceAllowance = Number(salaryDetails.conveyance_allowance) || 0;
    const medicalAllowance = Number(salaryDetails.medical_allowance) || 0;
    const specialAllowance = Number(salaryDetails.special_allowance) || 0;
    const otherAllowance = Number(salaryDetails.other_allowance) || 0;

    // Pro-rate based on paid days
    const proRateFactor = Math.min(calculatedPaidDays / daysInMonth, 1);
    const proratedBasic = Math.round(basicSalary * proRateFactor);
    const proratedHra = Math.round(hra * proRateFactor);
    const proratedConveyance = Math.round(conveyanceAllowance * proRateFactor);
    const proratedMedical = Math.round(medicalAllowance * proRateFactor);
    const proratedSpecial = Math.round(specialAllowance * proRateFactor);
    const proratedOther = Math.round(otherAllowance * proRateFactor);

    const totalEarnings = proratedBasic + proratedHra + proratedConveyance + proratedMedical + proratedSpecial + proratedOther + incentive + bonus;

    // Calculate deductions
    const epfPercentage = Number(salaryDetails.epf_percentage) || 12;
    const esicPercentage = Number(salaryDetails.esic_percentage) || 0;
    const professionalTax = Number(salaryDetails.professional_tax) || 200;

    const epfBase = Math.min(proratedBasic, 15000);
    const epf = Math.round((epfBase * epfPercentage) / 100);
    const esic = esicPercentage > 0 ? Math.round((totalEarnings * esicPercentage) / 100) : 0;

    const totalDeductions = epf + esic + professionalTax + other_deductions;
    const netPay = totalEarnings - totalDeductions;
    const netPayWords = numberToWords(netPay);

    // Check if slip already exists
    const { data: existingSlip } = await supabase
      .from("salary_slips")
      .select("id")
      .eq("user_id", user_id)
      .eq("month", month)
      .eq("year", year)
      .single();

    const slipData = {
      user_id,
      month,
      year,
      paid_days: calculatedPaidDays,
      loss_of_pay_days: calculatedLopDays,
      basic_salary: proratedBasic,
      hra: proratedHra,
      conveyance_allowance: proratedConveyance,
      medical_allowance: proratedMedical,
      special_allowance: proratedSpecial,
      other_allowance: proratedOther,
      incentive,
      bonus,
      total_earnings: totalEarnings,
      epf,
      esic,
      tds: 0,
      professional_tax: professionalTax,
      health_insurance: 0,
      salary_advance: 0,
      other_deductions,
      total_deductions: totalDeductions,
      net_pay: netPay,
      net_pay_words: netPayWords,
      is_published: false,
      generated_at: new Date().toISOString(),
      remarks,
    };

    let result;
    if (existingSlip) {
      const { data, error } = await supabase
        .from("salary_slips")
        .update(slipData)
        .eq("id", existingSlip.id)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from("salary_slips")
        .insert(slipData)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    }

    return successResponse({
      success: true,
      slip: result,
      message: existingSlip ? "Salary slip updated" : "Salary slip generated",
    });

  } catch (error) {
    console.error("Error generating salary slip:", error);
    return errorResponse(error.message || "Failed to generate salary slip", 500);
  }
});
