import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Loader2, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

interface RoleDef {
  id: string;
  user_id: string;
  category_name: string;
  sub_items: string[];
  weightage: number;
  sort_order: number;
}

interface RoleAssessment {
  id: string;
  user_id: string;
  quarter: string;
  calendar_year: number;
  self_scores: Record<string, number>;
  self_total: number;
  self_status: "draft" | "submitted";
  manager_scores: Record<string, number>;
  manager_total: number;
  manager_status: "not_started" | "draft" | "submitted";
  combined_total: number | null;
}

interface Member {
  user_id: string;
  full_name: string;
  email: string;
}

type Quarter = "Q1" | "Q2" | "Q3" | "Q4";
const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

export default function KPIRoleTeamDashboard() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [members, setMembers] = useState<Member[]>([]);
  const [allDefs, setAllDefs] = useState<RoleDef[]>([]);
  const [allAssessments, setAllAssessments] = useState<RoleAssessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // Access check
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/"); return; }
      const isRay = user.email === "s.ray@redefine.in";
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const isAdmin = roles?.some(r =>
        ["platform_admin", "super_admin", "admin_administration"].includes(r.role)
      );
      setHasAccess(isRay || !!isAdmin);
    };
    check();
  }, []);

  // Load data
  useEffect(() => {
    if (!hasAccess) return;
    const load = async () => {
      setIsLoading(true);
      try {
        // All role definitions
        const { data: defs } = await (supabase as any)
          .from("kpi_role_definitions").select("*").order("sort_order");
        setAllDefs((defs || []) as RoleDef[]);

        // Unique member IDs
        const memberIds = [...new Set((defs || []).map((d: any) => d.user_id))];
        if (memberIds.length === 0) { setIsLoading(false); return; }

        // Profiles
        const { data: profiles } = await supabase
          .from("profiles").select("id, full_name, email").in("id", memberIds);
        setMembers((profiles || []).map((p: any) => ({
          user_id: p.id, full_name: p.full_name || p.email, email: p.email
        })));

        // All assessments for selected year
        const { data: assmnts } = await (supabase as any)
          .from("kpi_role_assessments")
          .select("*")
          .eq("calendar_year", selectedYear)
          .in("user_id", memberIds);
        setAllAssessments((assmnts || []) as RoleAssessment[]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [hasAccess, selectedYear]);

  // assessmentMap: user_id → quarter → assessment
  const assessmentMap = useMemo(() => {
    const map = new Map<string, Map<Quarter, RoleAssessment>>();
    allAssessments.forEach(a => {
      if (!map.has(a.user_id)) map.set(a.user_id, new Map());
      map.get(a.user_id)!.set(a.quarter as Quarter, a);
    });
    return map;
  }, [allAssessments]);

  // defsMap: user_id → RoleDef[]
  const defsMap = useMemo(() => {
    const map = new Map<string, RoleDef[]>();
    allDefs.forEach(d => {
      if (!map.has(d.user_id)) map.set(d.user_id, []);
      map.get(d.user_id)!.push(d);
    });
    return map;
  }, [allDefs]);

  const renderQuarterCell = (userId: string, q: Quarter) => {
    const a = assessmentMap.get(userId)?.get(q);
    if (!a) return <span className="text-muted-foreground">—</span>;

    const bothSubmitted = a.self_status === "submitted" && a.manager_status === "submitted";
    const selfOnly = a.self_status === "submitted" && a.manager_status !== "submitted";

    if (bothSubmitted && a.combined_total !== null) {
      return (
        <div className="text-center">
          <span className="font-semibold text-primary">{Number(a.combined_total).toFixed(1)}</span>
          <span className="text-muted-foreground text-xs">/100</span>
        </div>
      );
    }
    if (selfOnly) {
      return (
        <div className="text-center">
          <span className="font-medium">{Number(a.self_total).toFixed(1)}</span>
          <span className="text-muted-foreground text-xs">/100</span>
          <div><Badge variant="secondary" className="text-[10px] mt-0.5">Self only</Badge></div>
        </div>
      );
    }
    if (a.self_status === "draft" || a.manager_status === "draft") {
      return <Badge variant="secondary" className="text-xs">In Progress</Badge>;
    }
    return <span className="text-muted-foreground">—</span>;
  };

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  // Dialog data for selected member
  const selectedDefs = selectedMember ? (defsMap.get(selectedMember.user_id) || []) : [];
  const selectedAssessments = selectedMember ? (assessmentMap.get(selectedMember.user_id) || new Map()) : new Map<Quarter, RoleAssessment>();

  if (hasAccess === null || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (hasAccess === false) {
    navigate("/dashboard");
    return null;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Performance Dashboard"
          subtitle="Team KPI assessment overview"
          icon={BarChart3}
        />
        <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Scores — {selectedYear}</CardTitle>
          <CardDescription>
            Combined score shown when both self and manager have submitted. Click a row for full scorecard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No members with performance KPIs found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  {QUARTERS.map(q => <TableHead key={q} className="text-center">{q}</TableHead>)}
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map(m => (
                  <TableRow
                    key={m.user_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedMember(m)}
                  >
                    <TableCell>
                      <div className="font-medium">{m.full_name}</div>
                      <div className="text-xs text-muted-foreground">{m.email}</div>
                    </TableCell>
                    {QUARTERS.map(q => (
                      <TableCell key={q} className="text-center">
                        {renderQuarterCell(m.user_id, q)}
                      </TableCell>
                    ))}
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Full scorecard dialog */}
      <Dialog open={!!selectedMember} onOpenChange={open => { if (!open) setSelectedMember(null); }}>
        <DialogContent className="sm:max-w-[750px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedMember?.full_name} — Scorecard {selectedYear}</DialogTitle>
            <DialogDescription>{selectedMember?.email}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-2">
            {QUARTERS.map(q => {
              const a = selectedAssessments.get(q as Quarter);
              const bothSubmitted = a?.self_status === "submitted" && a?.manager_status === "submitted";

              return (
                <div key={q}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-semibold text-sm">{q}</span>
                    {a?.self_status === "submitted"
                      ? <Badge className="bg-green-600 text-xs">Self ✓</Badge>
                      : a?.self_status === "draft"
                      ? <Badge variant="secondary" className="text-xs">Self Draft</Badge>
                      : <Badge variant="outline" className="text-xs">Self —</Badge>
                    }
                    {a?.manager_status === "submitted"
                      ? <Badge className="bg-blue-600 text-xs">Manager ✓</Badge>
                      : a?.manager_status === "draft"
                      ? <Badge variant="secondary" className="text-xs">Manager Draft</Badge>
                      : <Badge variant="outline" className="text-xs">Manager —</Badge>
                    }
                    {bothSubmitted && a.combined_total !== null && (
                      <span className="ml-auto font-bold text-primary">
                        {Number(a.combined_total).toFixed(2)}
                        <span className="text-muted-foreground font-normal text-xs">/100</span>
                      </span>
                    )}
                  </div>

                  {selectedDefs.length > 0 && (
                    <div className="pl-4 space-y-2">
                      {/* Headers */}
                      <div className="grid grid-cols-[1fr_60px_60px_60px_60px] gap-2 text-[11px] text-muted-foreground font-medium pb-1 border-b">
                        <span>Category (wt%)</span>
                        <span className="text-center">Self</span>
                        <span className="text-center">Mgr</span>
                        <span className="text-center">Avg</span>
                        <span className="text-center">Score</span>
                      </div>
                      {selectedDefs.map(def => {
                        const selfScore = a?.self_scores?.[def.id] ?? null;
                        const mgrScore = a?.manager_scores?.[def.id] ?? null;
                        const avg = selfScore !== null && mgrScore !== null
                          ? ((selfScore + mgrScore) / 2)
                          : selfScore !== null ? selfScore : null;
                        const weighted = avg !== null ? ((avg * def.weightage) / 100).toFixed(2) : "—";
                        return (
                          <div key={def.id} className="grid grid-cols-[1fr_60px_60px_60px_60px] gap-2 items-center text-sm">
                            <span className="text-muted-foreground">
                              {def.category_name}
                              <span className="text-xs ml-1">({def.weightage}%)</span>
                            </span>
                            <span className="text-center">{selfScore ?? "—"}</span>
                            <span className="text-center">{mgrScore ?? "—"}</span>
                            <span className="text-center text-muted-foreground">
                              {avg !== null ? avg.toFixed(1) : "—"}
                            </span>
                            <span className="text-center font-medium text-primary">{weighted}</span>
                          </div>
                        );
                      })}
                      {/* Totals */}
                      <div className="pt-2 space-y-1 border-t">
                        {a?.self_status === "submitted" && (
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Self Total</span>
                            <span>{Number(a.self_total).toFixed(2)}/100</span>
                          </div>
                        )}
                        {a?.manager_status === "submitted" && (
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Manager Total</span>
                            <span>{Number(a.manager_total).toFixed(2)}/100</span>
                          </div>
                        )}
                        {bothSubmitted && a.combined_total !== null && (
                          <div className="flex justify-between font-semibold text-sm">
                            <span>Combined</span>
                            <span className="text-primary">{Number(a.combined_total).toFixed(2)}/100</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {!a && (
                    <p className="pl-4 text-sm text-muted-foreground italic">No data entered yet.</p>
                  )}
                  {q !== "Q4" && <Separator className="mt-4" />}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
