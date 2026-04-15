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
  self_submitted_at: string | null;
  manager_scores: Record<string, number>;
  manager_total: number;
  manager_status: "not_started" | "draft" | "submitted";
  manager_submitted_at: string | null;
  combined_total: number | null;
}

interface Member {
  user_id: string;
  full_name: string;
  email: string;
}

type Quarter = "Q1" | "Q2" | "Q3" | "Q4";
const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

function getCurrentQuarter(): Quarter {
  const m = new Date().getMonth();
  if (m <= 2) return "Q1";
  if (m <= 5) return "Q2";
  if (m <= 8) return "Q3";
  return "Q4";
}

function calcSelfTotal(defs: RoleDef[], scores: Record<string, number>) {
  return defs.reduce((s, d) => s + ((scores[d.id] || 0) * d.weightage) / 100, 0);
}

function calcManagerTotal(defs: RoleDef[], scores: Record<string, number>) {
  return defs.reduce((s, d) => s + ((scores[d.id] || 0) * d.weightage) / 100, 0);
}

function calcCombined(defs: RoleDef[], selfScores: Record<string, number>, managerScores: Record<string, number>) {
  return defs.reduce((s, d) => {
    const avg = ((selfScores[d.id] || 0) + (managerScores[d.id] || 0)) / 2;
    return s + (avg * d.weightage) / 100;
  }, 0);
}

const SELF_STATUS = {
  submitted: { label: "Submitted", variant: "default" as const, className: "bg-green-600" },
  draft: { label: "Draft", variant: "secondary" as const, className: "" },
  not_started: { label: "Not Started", variant: "outline" as const, className: "" },
};

const MGR_STATUS = {
  submitted: { label: "Assessed", variant: "default" as const, className: "bg-blue-600" },
  draft: { label: "Draft", variant: "secondary" as const, className: "" },
  not_started: { label: "Pending", variant: "outline" as const, className: "" },
};

export default function KPIRoleAssessment() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  // Self section
  const [myDefs, setMyDefs] = useState<RoleDef[]>([]);
  const [myAssessments, setMyAssessments] = useState<Map<Quarter, RoleAssessment>>(new Map());
  const [selfDraft, setSelfDraft] = useState<Map<Quarter, Record<string, number>>>(new Map());
  const [activeQuarter, setActiveQuarter] = useState<Quarter>(getCurrentQuarter());
  const [isSavingSelf, setIsSavingSelf] = useState(false);

  // Manager section
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [memberDefs, setMemberDefs] = useState<RoleDef[]>([]);
  const [memberAssessments, setMemberAssessments] = useState<Map<Quarter, RoleAssessment>>(new Map());
  const [managerDraft, setManagerDraft] = useState<Map<Quarter, Record<string, number>>>(new Map());
  const [mgrActiveQuarter, setMgrActiveQuarter] = useState<Quarter>(getCurrentQuarter());
  const [isSavingMgr, setIsSavingMgr] = useState(false);
  const [isLoadingMember, setIsLoadingMember] = useState(false);

  const [isLoading, setIsLoading] = useState(true);

  // Check access
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/"); return; }
      setCurrentUserId(user.id);

      const { data: roles } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id);
      const isAdmin = roles?.some(r =>
        ["platform_admin", "super_admin", "admin_administration"].includes(r.role)
      );
      const isRay = user.email === "s.ray@redefine.in";
      setIsManager(isRay || !!isAdmin);

      // Check if user has role definitions
      const { data: defs } = await (supabase as any)
        .from("kpi_role_definitions").select("id").eq("user_id", user.id).limit(1);
      const hasDefs = (defs?.length || 0) > 0;

      setHasAccess(hasDefs || isRay || !!isAdmin);
    };
    check();
  }, []);

  // Load own definitions + assessments
  useEffect(() => {
    if (!currentUserId || hasAccess === false || hasAccess === null) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const [{ data: defs }, { data: assmnts }] = await Promise.all([
          (supabase as any)
            .from("kpi_role_definitions")
            .select("*")
            .eq("user_id", currentUserId)
            .order("sort_order"),
          (supabase as any)
            .from("kpi_role_assessments")
            .select("*")
            .eq("user_id", currentUserId)
            .eq("calendar_year", currentYear),
        ]);
        setMyDefs((defs || []) as RoleDef[]);
        const aMap = new Map<Quarter, RoleAssessment>();
        const sMap = new Map<Quarter, Record<string, number>>();
        ((assmnts || []) as RoleAssessment[]).forEach(a => {
          aMap.set(a.quarter as Quarter, a);
          sMap.set(a.quarter as Quarter, { ...(a.self_scores || {}) });
        });
        setMyAssessments(aMap);
        setSelfDraft(sMap);

        // Load members list for manager section
        if (isManager) {
          const { data: allDefs } = await (supabase as any)
            .from("kpi_role_definitions")
            .select("user_id")
            .order("user_id");
          const uniqueIds = [...new Set((allDefs || []).map((d: any) => d.user_id))];
          if (uniqueIds.length > 0) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, full_name, email")
              .in("id", uniqueIds);
            const memberList = (profiles || []).map((p: any) => ({
              user_id: p.id, full_name: p.full_name || p.email, email: p.email
            }));
            setMembers(memberList);
            if (memberList.length > 0 && !selectedMemberId) {
              setSelectedMemberId(memberList[0].user_id);
            }
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [currentUserId, hasAccess, isManager]);

  // Load selected member's data for manager section
  useEffect(() => {
    if (!isManager || !selectedMemberId) return;
    const load = async () => {
      setIsLoadingMember(true);
      try {
        const [{ data: defs }, { data: assmnts }] = await Promise.all([
          (supabase as any)
            .from("kpi_role_definitions")
            .select("*")
            .eq("user_id", selectedMemberId)
            .order("sort_order"),
          (supabase as any)
            .from("kpi_role_assessments")
            .select("*")
            .eq("user_id", selectedMemberId)
            .eq("calendar_year", currentYear),
        ]);
        setMemberDefs((defs || []) as RoleDef[]);
        const aMap = new Map<Quarter, RoleAssessment>();
        const mMap = new Map<Quarter, Record<string, number>>();
        ((assmnts || []) as RoleAssessment[]).forEach(a => {
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

  const currentSelfAssessment = myAssessments.get(activeQuarter);
  const isSelfSubmitted = currentSelfAssessment?.self_status === "submitted";
  const currentSelfScores = selfDraft.get(activeQuarter) || {};
  const selfTotal = useMemo(() => calcSelfTotal(myDefs, currentSelfScores), [myDefs, currentSelfScores]);

  const currentMgrAssessment = memberAssessments.get(mgrActiveQuarter);
  const isMgrSubmitted = currentMgrAssessment?.manager_status === "submitted";
  const currentMgrScores = managerDraft.get(mgrActiveQuarter) || {};
  const mgrTotal = useMemo(() => calcManagerTotal(memberDefs, currentMgrScores), [memberDefs, currentMgrScores]);
  const memberSelfScores = currentMgrAssessment?.self_scores || {};
  const memberSelfTotal = useMemo(() => calcSelfTotal(memberDefs, memberSelfScores), [memberDefs, memberSelfScores]);
  const combinedTotal = useMemo(() => {
    if (currentMgrAssessment?.self_status === "submitted" && isMgrSubmitted) {
      return calcCombined(memberDefs, memberSelfScores, currentMgrScores);
    }
    return null;
  }, [memberDefs, memberSelfScores, currentMgrScores, currentMgrAssessment, isMgrSubmitted]);

  const handleSelfScoreChange = (defId: string, value: string, max: number) => {
    if (isSelfSubmitted) return;
    let num = parseInt(value, 10);
    if (isNaN(num) || num < 0) num = 0;
    if (num > max) num = max;
    setSelfDraft(prev => {
      const next = new Map(prev);
      next.set(activeQuarter, { ...(next.get(activeQuarter) || {}), [defId]: num });
      return next;
    });
  };

  const handleMgrScoreChange = (defId: string, value: string, max: number) => {
    if (isMgrSubmitted) return;
    let num = parseInt(value, 10);
    if (isNaN(num) || num < 0) num = 0;
    if (num > max) num = max;
    setManagerDraft(prev => {
      const next = new Map(prev);
      next.set(mgrActiveQuarter, { ...(next.get(mgrActiveQuarter) || {}), [defId]: num });
      return next;
    });
  };

  const handleSaveSelf = async (submit: boolean) => {
    setIsSavingSelf(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      if (submit && !confirm(`Submit your Performance Assessment for ${activeQuarter} ${currentYear}? This cannot be edited after submission.`)) return;

      const scores = selfDraft.get(activeQuarter) || {};
      const total = parseFloat(calcSelfTotal(myDefs, scores).toFixed(2));
      const payload: any = {
        user_id: user.id,
        calendar_year: currentYear,
        quarter: activeQuarter,
        self_scores: scores,
        self_total: total,
        self_status: submit ? "submitted" : "draft",
        updated_at: new Date().toISOString(),
      };
      if (submit) payload.self_submitted_at = new Date().toISOString();

      const existing = myAssessments.get(activeQuarter);
      let result;
      if (existing) {
        result = await (supabase as any).from("kpi_role_assessments")
          .update(payload).eq("id", existing.id).select().single();
      } else {
        result = await (supabase as any).from("kpi_role_assessments")
          .insert(payload).select().single();
      }
      if (result.error) throw result.error;

      setMyAssessments(prev => {
        const next = new Map(prev);
        next.set(activeQuarter, result.data as RoleAssessment);
        return next;
      });
      toast.success(submit ? `${activeQuarter} submitted` : "Draft saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setIsSavingSelf(false);
    }
  };

  const handleSaveManager = async (submit: boolean) => {
    if (!selectedMemberId) return;
    setIsSavingMgr(true);
    try {
      if (submit && !confirm(`Submit manager assessment for ${mgrActiveQuarter} ${currentYear}? This cannot be edited after submission.`)) return;

      const scores = managerDraft.get(mgrActiveQuarter) || {};
      const total = parseFloat(calcManagerTotal(memberDefs, scores).toFixed(2));

      // Calculate combined if self also submitted
      const selfA = memberAssessments.get(mgrActiveQuarter);
      let combined: number | null = null;
      if (submit && selfA?.self_status === "submitted") {
        combined = parseFloat(calcCombined(memberDefs, selfA.self_scores, scores).toFixed(2));
      }

      const payload: any = {
        user_id: selectedMemberId,
        calendar_year: currentYear,
        quarter: mgrActiveQuarter,
        manager_scores: scores,
        manager_total: total,
        manager_status: submit ? "submitted" : "draft",
        updated_at: new Date().toISOString(),
      };
      if (combined !== null) payload.combined_total = combined;
      if (submit) payload.manager_submitted_at = new Date().toISOString();

      const existing = memberAssessments.get(mgrActiveQuarter);
      let result;
      if (existing) {
        result = await (supabase as any).from("kpi_role_assessments")
          .update(payload).eq("id", existing.id).select().single();
      } else {
        result = await (supabase as any).from("kpi_role_assessments")
          .insert(payload).select().single();
      }
      if (result.error) throw result.error;

      setMemberAssessments(prev => {
        const next = new Map(prev);
        next.set(mgrActiveQuarter, result.data as RoleAssessment);
        return next;
      });
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

  const hasSelfDefs = myDefs.length > 0;

  return (
    <div className="container mx-auto py-6 space-y-8 max-w-3xl">
      <PageHeader
        title="Performance Assessment"
        subtitle={`Calendar Year ${currentYear}`}
        icon={ClipboardCheck}
      />

      {/* ── SELF ASSESSMENT ── */}
      {hasSelfDefs && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Self Assessment</h2>

          {/* Quarter tabs */}
          <div className="flex gap-2 flex-wrap">
            {QUARTERS.map(q => {
              const a = myAssessments.get(q);
              const status = a?.self_status === "submitted" ? "submitted" : a ? "draft" : "not_started";
              const cfg = SELF_STATUS[status];
              return (
                <button
                  key={q}
                  onClick={() => setActiveQuarter(q)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    activeQuarter === q
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border"
                  }`}
                >
                  {q}
                  <Badge variant={cfg.variant} className={`text-[10px] px-1.5 py-0 ${cfg.className}`}>
                    {cfg.label}
                  </Badge>
                </button>
              );
            })}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">{activeQuarter} {currentYear}</CardTitle>
                <CardDescription>
                  {isSelfSubmitted
                    ? `Submitted on ${new Date(currentSelfAssessment!.self_submitted_at!).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
                    : "Score each category 0–100"}
                </CardDescription>
              </div>
              {isSelfSubmitted && (
                <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                  <Lock className="h-4 w-4" /> Locked
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {myDefs.map(def => {
                const score = currentSelfScores[def.id] ?? 0;
                const weighted = ((score * def.weightage) / 100).toFixed(2);
                return (
                  <div key={def.id} className="space-y-1">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <span className="text-sm font-medium">{def.category_name}</span>
                        <span className="text-xs text-muted-foreground ml-2">({def.weightage} pts)</span>
                        {def.sub_items.length > 0 && (
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {def.sub_items.map((s, i) => (
                              <span key={i} className="text-[11px] text-muted-foreground">· {s}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Input
                          type="number" min={0} max={100}
                          value={currentSelfScores[def.id] ?? ""}
                          onChange={e => handleSelfScoreChange(def.id, e.target.value, 100)}
                          disabled={isSelfSubmitted}
                          className="w-20 h-8 text-center text-sm"
                          placeholder="0"
                        />
                        <span className="text-xs text-muted-foreground w-8">/ 100</span>
                        <span className="text-xs text-primary w-12 text-right font-medium">{weighted} pts</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total Score</span>
                <span className={`text-lg font-bold ${selfTotal >= 90 ? "text-green-600" : ""}`}>
                  {selfTotal.toFixed(2)} <span className="text-muted-foreground font-normal text-sm">/ 100</span>
                </span>
              </div>

              {!isSelfSubmitted && (
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => handleSaveSelf(false)} disabled={isSavingSelf} className="flex-1">
                    {isSavingSelf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Draft
                  </Button>
                  <Button onClick={() => handleSaveSelf(true)} disabled={isSavingSelf} className="flex-1">
                    {isSavingSelf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
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
            <UserCog className="h-4 w-4" /> Manager Assessment
          </h2>

          {/* Member selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground shrink-0">Member:</span>
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {members.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoadingMember ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : memberDefs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No KPI definitions found for selected member.</p>
          ) : (
            <>
              {/* Quarter tabs for manager */}
              <div className="flex gap-2 flex-wrap">
                {QUARTERS.map(q => {
                  const a = memberAssessments.get(q);
                  const status = a?.manager_status === "submitted" ? "submitted" : a?.manager_status === "draft" ? "draft" : "not_started";
                  const cfg = MGR_STATUS[status];
                  return (
                    <button
                      key={q}
                      onClick={() => setMgrActiveQuarter(q)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        mgrActiveQuarter === q
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted border-border"
                      }`}
                    >
                      {q}
                      <Badge variant={cfg.variant} className={`text-[10px] px-1.5 py-0 ${cfg.className}`}>
                        {cfg.label}
                      </Badge>
                    </button>
                  );
                })}
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-base">
                      {members.find(m => m.user_id === selectedMemberId)?.full_name} — {mgrActiveQuarter} {currentYear}
                    </CardTitle>
                    <CardDescription>
                      {isMgrSubmitted
                        ? `Manager assessment submitted ${new Date(currentMgrAssessment!.manager_submitted_at!).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
                        : "Enter manager scores 0–100 per category"}
                    </CardDescription>
                  </div>
                  {isMgrSubmitted && (
                    <div className="flex items-center gap-1.5 text-blue-600 text-sm font-medium">
                      <Lock className="h-4 w-4" /> Locked
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-2 text-xs text-muted-foreground font-medium pb-1 border-b">
                    <span>Category</span>
                    <span className="text-center">Self</span>
                    <span className="text-center">Manager</span>
                    <span className="text-center">Avg</span>
                    <span className="text-center">Score</span>
                  </div>

                  {memberDefs.map(def => {
                    const selfScore = memberSelfScores[def.id] ?? null;
                    const mgrScore = currentMgrScores[def.id] ?? 0;
                    const avg = selfScore !== null ? ((selfScore + mgrScore) / 2) : null;
                    const weighted = avg !== null ? ((avg * def.weightage) / 100).toFixed(2) : "—";
                    const selfDisplay = selfScore !== null ? selfScore : "—";
                    return (
                      <div key={def.id} className="space-y-1">
                        <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-2 items-center">
                          <div>
                            <span className="text-sm font-medium">{def.category_name}</span>
                            <span className="text-xs text-muted-foreground ml-1">({def.weightage}%)</span>
                            {def.sub_items.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {def.sub_items.map((s, i) => (
                                  <span key={i} className="text-[11px] text-muted-foreground">· {s}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="text-sm text-center text-muted-foreground">{selfDisplay}</span>
                          <Input
                            type="number" min={0} max={100}
                            value={currentMgrScores[def.id] ?? ""}
                            onChange={e => handleMgrScoreChange(def.id, e.target.value, 100)}
                            disabled={isMgrSubmitted}
                            className="h-8 text-center text-sm"
                            placeholder="0"
                          />
                          <span className="text-xs text-center text-muted-foreground">
                            {avg !== null ? avg.toFixed(1) : "—"}
                          </span>
                          <span className="text-xs text-center text-primary font-medium">{weighted}</span>
                        </div>
                      </div>
                    );
                  })}

                  <Separator />
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Self Total</span>
                      <span>{memberSelfTotal.toFixed(2)} / 100</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Manager Total</span>
                      <span>{mgrTotal.toFixed(2)} / 100</span>
                    </div>
                    {combinedTotal !== null && (
                      <div className="flex items-center justify-between font-semibold">
                        <span>Combined Score</span>
                        <span className={`text-lg ${combinedTotal >= 90 ? "text-green-600" : "text-primary"}`}>
                          {combinedTotal.toFixed(2)} <span className="text-muted-foreground font-normal text-sm">/ 100</span>
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
