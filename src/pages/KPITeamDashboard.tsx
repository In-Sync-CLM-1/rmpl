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

// ─── CSBD types ───────────────────────────────────────────────────────────────
interface KPIDefinition {
  id: string;
  section: string;
  item_name: string;
  max_points: number;
  sort_order: number;
}

interface KPIAssessment {
  id: string;
  user_id: string;
  quarter: string;
  calendar_year: number;
  scores: Record<string, number>;
  total_score: number;
  status: "draft" | "submitted";
  submitted_at: string | null;
  manager_scores: Record<string, number> | null;
  manager_status: "not_started" | "draft" | "submitted" | null;
  manager_submitted_at: string | null;
}

interface CSBDMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

// ─── Role types ───────────────────────────────────────────────────────────────
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

interface RoleMember {
  user_id: string;
  full_name: string;
  email: string;
}

// ─── Shared ───────────────────────────────────────────────────────────────────
type Quarter = "Q1" | "Q2" | "Q3" | "Q4";
const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

export default function KPITeamDashboard() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // CSBD state
  const [definitions, setDefinitions] = useState<KPIDefinition[]>([]);
  const [csbdMembers, setCsbdMembers] = useState<CSBDMember[]>([]);
  const [csbdAssessments, setCsbdAssessments] = useState<KPIAssessment[]>([]);
  const [selectedCsbdMember, setSelectedCsbdMember] = useState<CSBDMember | null>(null);

  // Role state
  const [roleMembers, setRoleMembers] = useState<RoleMember[]>([]);
  const [allRoleDefs, setAllRoleDefs] = useState<RoleDef[]>([]);
  const [roleAssessments, setRoleAssessments] = useState<RoleAssessment[]>([]);
  const [selectedRoleMember, setSelectedRoleMember] = useState<RoleMember | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  // ── Access check ─────────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/"); return; }
      const isRay = user.email === "s.ray@redefine.in";
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const isAdmin = roles?.some(r => ["platform_admin", "super_admin", "admin_administration"].includes(r.role));
      setHasAccess(isRay || !!isAdmin);
    };
    check();
  }, []);

  // ── Load all data ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasAccess) return;
    const load = async () => {
      setIsLoading(true);
      try {
        // ── CSBD ──
        const { data: defs } = await (supabase as any)
          .from("kpi_definitions")
          .select("id, section, item_name, max_points, sort_order")
          .order("sort_order");
        setDefinitions((defs || []) as KPIDefinition[]);

        const { data: targets } = await (supabase as any)
          .from("csbd_targets")
          .select("user_id, profiles:user_id(full_name, email)")
          .eq("fiscal_year", selectedYear)
          .eq("is_active", true);

        const csbdList: CSBDMember[] = ((targets || []) as any[]).map((t: any) => ({
          user_id: t.user_id,
          full_name: t.profiles?.full_name || null,
          email: t.profiles?.email || null,
        }));
        setCsbdMembers(csbdList);

        if (csbdList.length > 0) {
          const { data: assmnts } = await (supabase as any)
            .from("kpi_self_assessments")
            .select("id, user_id, quarter, calendar_year, scores, total_score, status, submitted_at, manager_scores, manager_status, manager_submitted_at")
            .eq("calendar_year", selectedYear)
            .in("user_id", csbdList.map(m => m.user_id));
          setCsbdAssessments((assmnts || []) as KPIAssessment[]);
        } else {
          setCsbdAssessments([]);
        }

        // ── Role ──
        const { data: rdefs } = await (supabase as any)
          .from("kpi_role_definitions")
          .select("*")
          .order("sort_order");
        setAllRoleDefs((rdefs || []) as RoleDef[]);

        const roleMemberIds = [...new Set((rdefs || []).map((d: any) => d.user_id as string))];
        if (roleMemberIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", roleMemberIds);
          setRoleMembers((profiles || []).map((p: any) => ({
            user_id: p.id,
            full_name: p.full_name || p.email,
            email: p.email,
          })));

          const { data: rassmnts } = await (supabase as any)
            .from("kpi_role_assessments")
            .select("*")
            .eq("calendar_year", selectedYear)
            .in("user_id", roleMemberIds);
          setRoleAssessments((rassmnts || []) as RoleAssessment[]);
        } else {
          setRoleMembers([]);
          setRoleAssessments([]);
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [hasAccess, selectedYear]);

  // ── CSBD maps ─────────────────────────────────────────────────────────────
  const csbdAssessmentMap = useMemo(() => {
    const map = new Map<string, Map<Quarter, KPIAssessment>>();
    csbdAssessments.forEach(a => {
      if (!map.has(a.user_id)) map.set(a.user_id, new Map());
      map.get(a.user_id)!.set(a.quarter as Quarter, a);
    });
    return map;
  }, [csbdAssessments]);

  const csbdSections = useMemo(() => {
    const map = new Map<string, KPIDefinition[]>();
    definitions.forEach(d => {
      if (!map.has(d.section)) map.set(d.section, []);
      map.get(d.section)!.push(d);
    });
    return map;
  }, [definitions]);

  const maxPossible = definitions.reduce((s, d) => s + d.max_points, 0);

  // ── Role maps ─────────────────────────────────────────────────────────────
  const roleAssessmentMap = useMemo(() => {
    const map = new Map<string, Map<Quarter, RoleAssessment>>();
    roleAssessments.forEach(a => {
      if (!map.has(a.user_id)) map.set(a.user_id, new Map());
      map.get(a.user_id)!.set(a.quarter as Quarter, a);
    });
    return map;
  }, [roleAssessments]);

  const roleDefsMap = useMemo(() => {
    const map = new Map<string, RoleDef[]>();
    allRoleDefs.forEach(d => {
      if (!map.has(d.user_id)) map.set(d.user_id, []);
      map.get(d.user_id)!.push(d);
    });
    return map;
  }, [allRoleDefs]);

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderCsbdQuarterCell = (userId: string, q: Quarter) => {
    const a = csbdAssessmentMap.get(userId)?.get(q);
    if (!a) return <span className="text-muted-foreground">—</span>;
    const bothSubmitted = a.status === "submitted" && a.manager_status === "submitted";
    if (a.status === "draft") return <Badge variant="secondary" className="text-xs">Draft</Badge>;
    if (bothSubmitted) {
      const combined = definitions.reduce((sum, def) => {
        const s = a.scores?.[def.id] ?? 0;
        const m = a.manager_scores?.[def.id] ?? 0;
        return sum + (s + m) / 2;
      }, 0);
      return (
        <div className="text-center">
          <span className="font-semibold text-primary">{combined.toFixed(1)}</span>
          <span className="text-muted-foreground text-xs">/{maxPossible}</span>
        </div>
      );
    }
    return (
      <span className="font-semibold">
        {a.total_score}
        <span className="text-muted-foreground font-normal text-xs">/{maxPossible}</span>
      </span>
    );
  };

  const renderRoleQuarterCell = (userId: string, q: Quarter) => {
    const a = roleAssessmentMap.get(userId)?.get(q);
    if (!a) return <span className="text-muted-foreground">—</span>;
    const bothSubmitted = a.self_status === "submitted" && a.manager_status === "submitted";
    if (bothSubmitted && a.combined_total !== null) {
      return (
        <div className="text-center">
          <span className="font-semibold text-primary">{Number(a.combined_total).toFixed(1)}</span>
          <span className="text-muted-foreground text-xs">/100</span>
        </div>
      );
    }
    if (a.self_status === "submitted") {
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

  // Dialog data
  const csbdDialogAssessments = selectedCsbdMember
    ? csbdAssessmentMap.get(selectedCsbdMember.user_id) || new Map()
    : new Map<Quarter, KPIAssessment>();

  const roleDialogDefs = selectedRoleMember ? (roleDefsMap.get(selectedRoleMember.user_id) || []) : [];
  const roleDialogAssessments = selectedRoleMember
    ? roleAssessmentMap.get(selectedRoleMember.user_id) || new Map()
    : new Map<Quarter, RoleAssessment>();

  // ── Guards ────────────────────────────────────────────────────────────────
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

      {/* ── CSBD Team Card ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>CSBD Team Scores — {selectedYear}</CardTitle>
          <CardDescription>
            {csbdMembers.length} member{csbdMembers.length !== 1 ? "s" : ""} with active targets.
            Combined score shown when both self and manager have submitted. Click a row for full scorecard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {csbdMembers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No CSBD members with active targets found for {selectedYear}.
            </p>
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
                {csbdMembers.map(m => (
                  <TableRow
                    key={m.user_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedCsbdMember(m)}
                  >
                    <TableCell>
                      <div className="font-medium">{m.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{m.email}</div>
                    </TableCell>
                    {QUARTERS.map(q => (
                      <TableCell key={q} className="text-center">
                        {renderCsbdQuarterCell(m.user_id, q)}
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

      {/* ── Role Performance Card ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Role Performance Scores — {selectedYear}</CardTitle>
          <CardDescription>
            {roleMembers.length} member{roleMembers.length !== 1 ? "s" : ""} with role KPIs.
            Combined score shown when both self and manager have submitted. Click a row for full scorecard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {roleMembers.length === 0 ? (
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
                {roleMembers.map(m => (
                  <TableRow
                    key={m.user_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedRoleMember(m)}
                  >
                    <TableCell>
                      <div className="font-medium">{m.full_name}</div>
                      <div className="text-xs text-muted-foreground">{m.email}</div>
                    </TableCell>
                    {QUARTERS.map(q => (
                      <TableCell key={q} className="text-center">
                        {renderRoleQuarterCell(m.user_id, q)}
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

      {/* ── CSBD Scorecard Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!selectedCsbdMember} onOpenChange={open => { if (!open) setSelectedCsbdMember(null); }}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCsbdMember?.full_name} — CSBD Scorecard {selectedYear}</DialogTitle>
            <DialogDescription>{selectedCsbdMember?.email}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-2">
            {QUARTERS.map(q => {
              const a = csbdDialogAssessments.get(q as Quarter);
              const bothSubmitted = a?.status === "submitted" && a?.manager_status === "submitted";
              const combined = bothSubmitted ? definitions.reduce((sum, def) => {
                const s = a!.scores?.[def.id] ?? 0;
                const m = a!.manager_scores?.[def.id] ?? 0;
                return sum + (s + m) / 2;
              }, 0) : null;

              return (
                <div key={q}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-semibold text-sm">{q}</span>
                    {a?.status === "submitted"
                      ? <Badge className="bg-green-600 text-xs">Self ✓</Badge>
                      : a?.status === "draft"
                      ? <Badge variant="secondary" className="text-xs">Self Draft</Badge>
                      : <Badge variant="outline" className="text-xs">Self —</Badge>
                    }
                    {a?.manager_status === "submitted"
                      ? <Badge className="bg-blue-600 text-xs">Manager ✓</Badge>
                      : a?.manager_status === "draft"
                      ? <Badge variant="secondary" className="text-xs">Manager Draft</Badge>
                      : null
                    }
                    {combined !== null && (
                      <span className="ml-auto font-bold text-primary">
                        {combined.toFixed(1)}
                        <span className="text-muted-foreground font-normal text-xs">/{maxPossible}</span>
                      </span>
                    )}
                  </div>

                  {a ? (
                    <div className="pl-4 space-y-4">
                      {/* Header row */}
                      <div className="grid grid-cols-[1fr_60px_60px_60px] gap-2 text-[11px] text-muted-foreground font-medium pb-1 border-b">
                        <span>Item (max)</span>
                        <span className="text-center">Self</span>
                        <span className="text-center">Mgr</span>
                        <span className="text-center">Avg</span>
                      </div>
                      {Array.from(csbdSections.entries()).map(([sectionName, items]) => (
                        <div key={sectionName}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              {sectionName}
                            </span>
                            <Separator className="flex-1" />
                          </div>
                          <div className="space-y-1">
                            {items.map(def => {
                              const selfScore = a.scores?.[def.id] ?? 0;
                              const mgrScore = a.manager_scores?.[def.id] ?? null;
                              const avg = mgrScore !== null ? ((selfScore + mgrScore) / 2) : null;
                              return (
                                <div key={def.id} className="grid grid-cols-[1fr_60px_60px_60px] gap-2 items-center text-sm">
                                  <span className="text-muted-foreground">{def.item_name} <span className="text-xs">({def.max_points})</span></span>
                                  <span className="text-center">{selfScore}</span>
                                  <span className="text-center">{mgrScore ?? "—"}</span>
                                  <span className="text-center text-muted-foreground">{avg !== null ? avg.toFixed(1) : "—"}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      <div className="pt-2 border-t space-y-1">
                        {a.status === "submitted" && (
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Self Total</span>
                            <span>{a.total_score}/{maxPossible}</span>
                          </div>
                        )}
                        {combined !== null && (
                          <div className="flex justify-between font-semibold text-sm">
                            <span>Combined</span>
                            <span className="text-primary">{combined.toFixed(1)}/{maxPossible}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="pl-4 text-sm text-muted-foreground italic">No data entered yet.</p>
                  )}
                  {q !== "Q4" && <Separator className="mt-4" />}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Role Scorecard Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!selectedRoleMember} onOpenChange={open => { if (!open) setSelectedRoleMember(null); }}>
        <DialogContent className="sm:max-w-[750px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRoleMember?.full_name} — Performance Scorecard {selectedYear}</DialogTitle>
            <DialogDescription>{selectedRoleMember?.email}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-2">
            {QUARTERS.map(q => {
              const a = roleDialogAssessments.get(q as Quarter);
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

                  {roleDialogDefs.length > 0 && (
                    <div className="pl-4 space-y-2">
                      <div className="grid grid-cols-[1fr_60px_60px_60px_60px] gap-2 text-[11px] text-muted-foreground font-medium pb-1 border-b">
                        <span>Category (wt%)</span>
                        <span className="text-center">Self</span>
                        <span className="text-center">Mgr</span>
                        <span className="text-center">Avg</span>
                        <span className="text-center">Score</span>
                      </div>
                      {roleDialogDefs.map(def => {
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
