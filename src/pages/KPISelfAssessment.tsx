import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck, Loader2, Lock, Save, Send, UserCog } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";

interface KPIDefinition {
  id: string;
  section: string;
  item_name: string;
  max_points: number;
  sort_order: number;
}

interface KPIAssessment {
  id: string;
  quarter: string;
  calendar_year: number;
  scores: Record<string, number>;
  total_score: number;
  status: "draft" | "submitted";
  submitted_at: string | null;
  manager_scores: Record<string, number>;
  manager_status: "not_started" | "draft" | "submitted";
  manager_submitted_at: string | null;
}

interface CSBDMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

type Quarter = "Q1" | "Q2" | "Q3" | "Q4";

function getCurrentQuarter(): Quarter {
  const m = new Date().getMonth();
  if (m <= 2) return "Q1";
  if (m <= 5) return "Q2";
  if (m <= 8) return "Q3";
  return "Q4";
}

const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

const STATUS_CONFIG = {
  submitted: { label: "Submitted", variant: "default" as const, className: "bg-green-600" },
  draft: { label: "Draft", variant: "secondary" as const, className: "" },
  not_started: { label: "Not Started", variant: "outline" as const, className: "" },
};

const MGR_STATUS = {
  submitted: { label: "Assessed", variant: "default" as const, className: "bg-blue-600" },
  draft: { label: "Draft", variant: "secondary" as const, className: "" },
  not_started: { label: "Pending", variant: "outline" as const, className: "" },
};

export default function KPISelfAssessment() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [hasSelfAccess, setHasSelfAccess] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  const [definitions, setDefinitions] = useState<KPIDefinition[]>([]);

  // Self assessment state
  const [assessments, setAssessments] = useState<Map<Quarter, KPIAssessment>>(new Map());
  const [draftScores, setDraftScores] = useState<Map<Quarter, Record<string, number>>>(new Map());
  const [activeQuarter, setActiveQuarter] = useState<Quarter>(getCurrentQuarter());
  const [isSaving, setIsSaving] = useState(false);

  // Manager section state
  const [csbdMembers, setCsbdMembers] = useState<CSBDMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [memberAssessments, setMemberAssessments] = useState<Map<Quarter, KPIAssessment>>(new Map());
  const [managerDraft, setManagerDraft] = useState<Map<Quarter, Record<string, number>>>(new Map());
  const [mgrActiveQuarter, setMgrActiveQuarter] = useState<Quarter>(getCurrentQuarter());
  const [isSavingMgr, setIsSavingMgr] = useState(false);
  const [isLoadingMember, setIsLoadingMember] = useState(false);

  const [isLoading, setIsLoading] = useState(true);

  // Check access
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/dashboard"); return; }
      setCurrentUserId(user.id);

      const [{ data: target }, { data: roles }] = await Promise.all([
        supabase.from("csbd_targets" as any).select("id")
          .eq("user_id", user.id).eq("fiscal_year", currentYear).eq("is_active", true).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);

      const isAdmin = roles?.some(r =>
        ["platform_admin", "super_admin", "admin_administration"].includes(r.role)
      );
      const isRay = user.email === "s.ray@redefine.in";
      const selfOk = !!target;

      setHasSelfAccess(selfOk);
      setIsManager(isRay || !!isAdmin);
      setHasAccess(selfOk || isRay || !!isAdmin);
    };
    check();
  }, []);

  // Load definitions + own assessments
  useEffect(() => {
    if (hasAccess === false || hasAccess === null || !currentUserId) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const [{ data: defs }, { data: assmnts }] = await Promise.all([
          supabase.from("kpi_definitions" as any)
            .select("id, section, item_name, max_points, sort_order").order("sort_order"),
          hasSelfAccess
            ? supabase.from("kpi_self_assessments" as any)
                .select("id, quarter, calendar_year, scores, total_score, status, submitted_at, manager_scores, manager_status, manager_submitted_at")
                .eq("user_id", currentUserId).eq("calendar_year", currentYear)
            : Promise.resolve({ data: [] }),
        ]);

        setDefinitions((defs || []) as KPIDefinition[]);

        const aMap = new Map<Quarter, KPIAssessment>();
        const sMap = new Map<Quarter, Record<string, number>>();
        ((assmnts || []) as KPIAssessment[]).forEach(a => {
          aMap.set(a.quarter as Quarter, a);
          sMap.set(a.quarter as Quarter, { ...(a.scores || {}) });
        });
        setAssessments(aMap);
        setDraftScores(sMap);

        // Load CSBD members for manager section
        if (isManager) {
          const { data: targets } = await (supabase as any)
            .from("csbd_targets")
            .select("user_id, profiles:user_id(full_name, email)")
            .eq("fiscal_year", currentYear).eq("is_active", true);
          const memberList: CSBDMember[] = ((targets || []) as any[]).map((t: any) => ({
            user_id: t.user_id,
            full_name: t.profiles?.full_name || null,
            email: t.profiles?.email || null,
          }));
          setCsbdMembers(memberList);
          if (memberList.length > 0 && !selectedMemberId) {
            setSelectedMemberId(memberList[0].user_id);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [hasAccess, currentUserId, hasSelfAccess, isManager]);

  // Load selected member's assessments for manager section
  useEffect(() => {
    if (!isManager || !selectedMemberId) return;
    const load = async () => {
      setIsLoadingMember(true);
      try {
        const { data: assmnts } = await (supabase as any)
          .from("kpi_self_assessments")
          .select("id, quarter, calendar_year, scores, total_score, status, submitted_at, manager_scores, manager_status, manager_submitted_at")
          .eq("user_id", selectedMemberId)
          .eq("calendar_year", currentYear);

        const aMap = new Map<Quarter, KPIAssessment>();
        const mMap = new Map<Quarter, Record<string, number>>();
        ((assmnts || []) as KPIAssessment[]).forEach(a => {
          aMap.set(a.quarter as Quarter, a);
          mMap.set(a.quarter as Quarter, { ...(a.manager_scores || {}) });
        });
        setMemberAssessments(aMap);
        setManagerDraft(mMap);
      } finally {
        setIsLoadingMember(false);
      }
    };
    load();
  }, [isManager, selectedMemberId, currentYear]);

  const sections = useMemo(() => {
    const map = new Map<string, KPIDefinition[]>();
    definitions.forEach(d => {
      if (!map.has(d.section)) map.set(d.section, []);
      map.get(d.section)!.push(d);
    });
    return map;
  }, [definitions]);

  const maxPossible = useMemo(() => definitions.reduce((s, d) => s + d.max_points, 0), [definitions]);

  // Self section
  const currentAssessment = assessments.get(activeQuarter);
  const isSubmitted = currentAssessment?.status === "submitted";
  const currentScores = draftScores.get(activeQuarter) || {};
  const totalScoreForQuarter = useMemo(() =>
    definitions.reduce((sum, d) => sum + (currentScores[d.id] || 0), 0),
    [definitions, currentScores, activeQuarter]
  );

  // Manager section
  const currentMgrAssessment = memberAssessments.get(mgrActiveQuarter);
  const isMgrSubmitted = currentMgrAssessment?.manager_status === "submitted";
  const currentMgrScores = managerDraft.get(mgrActiveQuarter) || {};
  const memberSelfScores = currentMgrAssessment?.scores || {};
  const memberSelfTotal = useMemo(() =>
    definitions.reduce((s, d) => s + (memberSelfScores[d.id] || 0), 0),
    [definitions, memberSelfScores]
  );
  const mgrTotal = useMemo(() =>
    definitions.reduce((s, d) => s + (currentMgrScores[d.id] || 0), 0),
    [definitions, currentMgrScores]
  );
  const combinedTotal = useMemo(() => {
    if (currentMgrAssessment?.status === "submitted" && isMgrSubmitted) {
      return definitions.reduce((s, d) =>
        s + ((memberSelfScores[d.id] || 0) + (currentMgrScores[d.id] || 0)) / 2, 0
      );
    }
    return null;
  }, [definitions, memberSelfScores, currentMgrScores, currentMgrAssessment, isMgrSubmitted]);

  const handleScoreChange = (defId: string, value: string, maxPoints: number) => {
    if (isSubmitted) return;
    let num = parseInt(value, 10);
    if (isNaN(num) || num < 0) num = 0;
    if (num > maxPoints) num = maxPoints;
    setDraftScores(prev => {
      const next = new Map(prev);
      next.set(activeQuarter, { ...(next.get(activeQuarter) || {}), [defId]: num });
      return next;
    });
  };

  const handleMgrScoreChange = (defId: string, value: string, maxPoints: number) => {
    if (isMgrSubmitted) return;
    let num = parseInt(value, 10);
    if (isNaN(num) || num < 0) num = 0;
    if (num > maxPoints) num = maxPoints;
    setManagerDraft(prev => {
      const next = new Map(prev);
      next.set(mgrActiveQuarter, { ...(next.get(mgrActiveQuarter) || {}), [defId]: num });
      return next;
    });
  };

  const handleSave = async (submit: boolean) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      if (submit && !confirm(`Submit your KPI self-assessment for ${activeQuarter} ${currentYear}? This cannot be edited after submission.`)) return;

      const scores = draftScores.get(activeQuarter) || {};
      const total = definitions.reduce((sum, d) => sum + (scores[d.id] || 0), 0);
      const payload: any = {
        user_id: user.id, calendar_year: currentYear, quarter: activeQuarter,
        scores, total_score: total, status: submit ? "submitted" : "draft",
        updated_at: new Date().toISOString(),
      };
      if (submit) payload.submitted_at = new Date().toISOString();

      const existing = assessments.get(activeQuarter);
      let result;
      if (existing) {
        result = await (supabase as any).from("kpi_self_assessments")
          .update(payload).eq("id", existing.id).select().single();
      } else {
        result = await (supabase as any).from("kpi_self_assessments")
          .insert(payload).select().single();
      }
      if (result.error) throw result.error;
      setAssessments(prev => { const n = new Map(prev); n.set(activeQuarter, result.data); return n; });
      toast.success(submit ? `${activeQuarter} submitted successfully` : "Draft saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveManager = async (submit: boolean) => {
    if (!selectedMemberId) return;
    setIsSavingMgr(true);
    try {
      if (submit && !confirm(`Submit manager assessment for ${mgrActiveQuarter} ${currentYear}? This cannot be edited after submission.`)) return;

      const scores = managerDraft.get(mgrActiveQuarter) || {};
      const mgrTotalVal = definitions.reduce((s, d) => s + (scores[d.id] || 0), 0);
      const payload: any = {
        manager_scores: scores,
        manager_status: submit ? "submitted" : "draft",
        updated_at: new Date().toISOString(),
      };
      if (submit) payload.manager_submitted_at = new Date().toISOString();

      const existing = memberAssessments.get(mgrActiveQuarter);
      let result;
      if (existing) {
        result = await (supabase as any).from("kpi_self_assessments")
          .update(payload).eq("id", existing.id).select().single();
      } else {
        // Create a new record for member with empty self scores
        result = await (supabase as any).from("kpi_self_assessments")
          .insert({
            user_id: selectedMemberId, calendar_year: currentYear, quarter: mgrActiveQuarter,
            scores: {}, total_score: 0, status: "draft",
            manager_scores: scores, manager_status: submit ? "submitted" : "draft",
            ...(submit ? { manager_submitted_at: new Date().toISOString() } : {}),
          }).select().single();
      }
      if (result.error) throw result.error;
      setMemberAssessments(prev => { const n = new Map(prev); n.set(mgrActiveQuarter, result.data); return n; });
      toast.success(submit ? `Manager assessment submitted for ${mgrActiveQuarter}` : "Draft saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setIsSavingMgr(false);
    }
  };

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
    <div className="container mx-auto py-6 space-y-8 max-w-3xl">
      <PageHeader
        title="KPI Self Assessment"
        subtitle={`Calendar Year ${currentYear} — ${maxPossible} points total`}
        icon={ClipboardCheck}
      />

      {/* ── SELF ASSESSMENT ── */}
      {hasSelfAccess && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Self Assessment</h2>

          <div className="flex gap-2 flex-wrap">
            {QUARTERS.map(q => {
              const a = assessments.get(q);
              const status = a?.status === "submitted" ? "submitted" : a?.status === "draft" ? "draft" : "not_started";
              const cfg = STATUS_CONFIG[status];
              return (
                <button key={q} onClick={() => setActiveQuarter(q)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    activeQuarter === q ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border"
                  }`}
                >
                  {q}
                  <Badge variant={cfg.variant} className={`text-[10px] px-1.5 py-0 ${cfg.className}`}>{cfg.label}</Badge>
                </button>
              );
            })}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">{activeQuarter} {currentYear}</CardTitle>
                <CardDescription>
                  {isSubmitted
                    ? `Submitted on ${new Date(currentAssessment!.submitted_at!).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
                    : "Enter your score for each KPI item (whole numbers only)"}
                </CardDescription>
              </div>
              {isSubmitted && (
                <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                  <Lock className="h-4 w-4" /> Locked
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {Array.from(sections.entries()).map(([sectionName, items]) => (
                <div key={sectionName}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{sectionName}</span>
                    <Separator className="flex-1" />
                    <span className="text-xs text-muted-foreground">
                      {items.reduce((s, d) => s + (currentScores[d.id] || 0), 0)} /&nbsp;
                      {items.reduce((s, d) => s + d.max_points, 0)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {items.map(def => (
                      <div key={def.id} className="flex items-center gap-3">
                        <span className="flex-1 text-sm">{def.item_name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Input type="number" min={0} max={def.max_points}
                            value={currentScores[def.id] ?? ""}
                            onChange={e => handleScoreChange(def.id, e.target.value, def.max_points)}
                            disabled={isSubmitted} className="w-20 h-8 text-center text-sm" placeholder="0" />
                          <span className="text-xs text-muted-foreground w-12">/ {def.max_points}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total Score</span>
                <span className={`text-lg font-bold ${totalScoreForQuarter === maxPossible ? "text-green-600" : ""}`}>
                  {totalScoreForQuarter} <span className="text-muted-foreground font-normal text-sm">/ {maxPossible}</span>
                </span>
              </div>
              {!isSubmitted && (
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => handleSave(false)} disabled={isSaving} className="flex-1">
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Draft
                  </Button>
                  <Button onClick={() => handleSave(true)} disabled={isSaving} className="flex-1">
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Submit {activeQuarter}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── MANAGER ASSESSMENT ── */}
      {isManager && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <UserCog className="h-4 w-4" /> Manager Assessment — CSBD
          </h2>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground shrink-0">Member:</span>
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select CSBD member" />
              </SelectTrigger>
              <SelectContent>
                {csbdMembers.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || m.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoadingMember ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="flex gap-2 flex-wrap">
                {QUARTERS.map(q => {
                  const a = memberAssessments.get(q);
                  const status = a?.manager_status === "submitted" ? "submitted"
                    : a?.manager_status === "draft" ? "draft" : "not_started";
                  const cfg = MGR_STATUS[status];
                  return (
                    <button key={q} onClick={() => setMgrActiveQuarter(q)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        mgrActiveQuarter === q ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border"
                      }`}
                    >
                      {q}
                      <Badge variant={cfg.variant} className={`text-[10px] px-1.5 py-0 ${cfg.className}`}>{cfg.label}</Badge>
                    </button>
                  );
                })}
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-base">
                      {csbdMembers.find(m => m.user_id === selectedMemberId)?.full_name} — {mgrActiveQuarter} {currentYear}
                    </CardTitle>
                    <CardDescription>
                      {isMgrSubmitted
                        ? `Manager assessment submitted ${new Date(currentMgrAssessment!.manager_submitted_at!).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
                        : "Enter manager scores (0 – max points per item)"}
                    </CardDescription>
                  </div>
                  {isMgrSubmitted && (
                    <div className="flex items-center gap-1.5 text-blue-600 text-sm font-medium">
                      <Lock className="h-4 w-4" /> Locked
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  {Array.from(sections.entries()).map(([sectionName, items]) => (
                    <div key={sectionName}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{sectionName}</span>
                        <Separator className="flex-1" />
                      </div>
                      <div className="space-y-2">
                        {/* Column headers */}
                        <div className="grid grid-cols-[1fr_70px_70px_70px] gap-2 text-[11px] text-muted-foreground font-medium pb-1">
                          <span>Item</span>
                          <span className="text-center">Self</span>
                          <span className="text-center">Manager</span>
                          <span className="text-center">Avg</span>
                        </div>
                        {items.map(def => {
                          const selfScore = memberSelfScores[def.id] ?? null;
                          const mgrScore = currentMgrScores[def.id] ?? 0;
                          const avg = selfScore !== null
                            ? (((selfScore + mgrScore) / 2)).toFixed(1)
                            : "—";
                          return (
                            <div key={def.id} className="grid grid-cols-[1fr_70px_70px_70px] gap-2 items-center">
                              <span className="text-sm">{def.item_name}
                                <span className="text-xs text-muted-foreground ml-1">/ {def.max_points}</span>
                              </span>
                              <span className="text-sm text-center text-muted-foreground">{selfScore ?? "—"}</span>
                              <Input type="number" min={0} max={def.max_points}
                                value={currentMgrScores[def.id] ?? ""}
                                onChange={e => handleMgrScoreChange(def.id, e.target.value, def.max_points)}
                                disabled={isMgrSubmitted}
                                className="h-8 text-center text-sm" placeholder="0" />
                              <span className="text-xs text-center text-muted-foreground">{avg}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <Separator />
                  <div className="space-y-1">
                    {currentMgrAssessment?.status === "submitted" && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Self Total</span>
                        <span>{memberSelfTotal} / {maxPossible}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Manager Total</span>
                      <span>{mgrTotal} / {maxPossible}</span>
                    </div>
                    {combinedTotal !== null && (
                      <div className="flex justify-between font-semibold">
                        <span>Combined Score</span>
                        <span className={`text-lg ${combinedTotal === maxPossible ? "text-green-600" : "text-primary"}`}>
                          {combinedTotal} <span className="text-muted-foreground font-normal text-sm">/ {maxPossible}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {!isMgrSubmitted && (
                    <div className="flex gap-3 pt-2">
                      <Button variant="outline" onClick={() => handleSaveManager(false)} disabled={isSavingMgr} className="flex-1">
                        {isSavingMgr ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Draft
                      </Button>
                      <Button onClick={() => handleSaveManager(true)} disabled={isSavingMgr} className="flex-1">
                        {isSavingMgr ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                        Submit {mgrActiveQuarter}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
