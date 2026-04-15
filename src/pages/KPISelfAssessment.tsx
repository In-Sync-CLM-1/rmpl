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

// ── CSBD types ────────────────────────────────────────────────────────────────
interface KPIDef {
  id: string; section: string; item_name: string; max_points: number; sort_order: number;
}
interface KPIAssessment {
  id: string; quarter: string; calendar_year: number;
  scores: Record<string, number>; total_score: number;
  status: "draft" | "submitted"; submitted_at: string | null;
  manager_scores: Record<string, number>;
  manager_status: "not_started" | "draft" | "submitted";
  manager_submitted_at: string | null;
}

// ── Role types ─────────────────────────────────────────────────────────────────
interface RoleDef {
  id: string; user_id: string; category_name: string;
  sub_items: string[]; weightage: number; sort_order: number;
}
interface RoleAssessment {
  id: string; user_id: string; quarter: string; calendar_year: number;
  self_scores: Record<string, number>; self_total: number;
  self_status: "draft" | "submitted"; self_submitted_at: string | null;
  manager_scores: Record<string, number>; manager_total: number;
  manager_status: "not_started" | "draft" | "submitted"; manager_submitted_at: string | null;
  combined_total: number | null;
}
interface Member { user_id: string; full_name: string; email: string; }

type Quarter = "Q1" | "Q2" | "Q3" | "Q4";
const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

function getCurrentQuarter(): Quarter {
  const m = new Date().getMonth();
  if (m <= 2) return "Q1"; if (m <= 5) return "Q2"; if (m <= 8) return "Q3"; return "Q4";
}

const SELF_CFG = {
  submitted: { label: "Submitted", variant: "default" as const, className: "bg-green-600" },
  draft: { label: "Draft", variant: "secondary" as const, className: "" },
  not_started: { label: "Not Started", variant: "outline" as const, className: "" },
};
const MGR_CFG = {
  submitted: { label: "Assessed", variant: "default" as const, className: "bg-blue-600" },
  draft: { label: "Draft", variant: "secondary" as const, className: "" },
  not_started: { label: "Pending", variant: "outline" as const, className: "" },
};

function calcRoleTotal(defs: RoleDef[], scores: Record<string, number>) {
  return defs.reduce((s, d) => s + ((scores[d.id] || 0) * d.weightage) / 100, 0);
}

function QuarterTabs({ quarters, active, setActive, assessmentStatus }: {
  quarters: Quarter[]; active: Quarter; setActive: (q: Quarter) => void;
  assessmentStatus: (q: Quarter) => keyof typeof SELF_CFG | keyof typeof MGR_CFG;
  cfg?: typeof SELF_CFG | typeof MGR_CFG;
}) { return null; } // placeholder — inlined below for flexibility

export default function KPISelfAssessment() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [hasCsbdAccess, setHasCsbdAccess] = useState(false);
  const [hasRoleDefs, setHasRoleDefs] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  // ── CSBD self state ──────────────────────────────────────────────────────────
  const [kpiDefs, setKpiDefs] = useState<KPIDef[]>([]);
  const [csbdAssessments, setCsbdAssessments] = useState<Map<Quarter, KPIAssessment>>(new Map());
  const [csbdDraft, setCsbdDraft] = useState<Map<Quarter, Record<string, number>>>(new Map());
  const [csbdQ, setCsbdQ] = useState<Quarter>(getCurrentQuarter());
  const [isSavingCsbd, setIsSavingCsbd] = useState(false);

  // ── Role self state ──────────────────────────────────────────────────────────
  const [myRoleDefs, setMyRoleDefs] = useState<RoleDef[]>([]);
  const [roleAssessments, setRoleAssessments] = useState<Map<Quarter, RoleAssessment>>(new Map());
  const [roleDraft, setRoleDraft] = useState<Map<Quarter, Record<string, number>>>(new Map());
  const [roleQ, setRoleQ] = useState<Quarter>(getCurrentQuarter());
  const [isSavingRole, setIsSavingRole] = useState(false);

  // ── CSBD manager state ────────────────────────────────────────────────────────
  const [csbdMembers, setCsbdMembers] = useState<Member[]>([]);
  const [selCsbdMember, setSelCsbdMember] = useState("");
  const [csbdMemberAssessments, setCsbdMemberAssessments] = useState<Map<Quarter, KPIAssessment>>(new Map());
  const [csbdMgrDraft, setCsbdMgrDraft] = useState<Map<Quarter, Record<string, number>>>(new Map());
  const [csbdMgrQ, setCsbdMgrQ] = useState<Quarter>(getCurrentQuarter());
  const [isSavingCsbdMgr, setIsSavingCsbdMgr] = useState(false);
  const [isLoadingCsbdMember, setIsLoadingCsbdMember] = useState(false);

  // ── Role manager state ────────────────────────────────────────────────────────
  const [roleMembers, setRoleMembers] = useState<Member[]>([]);
  const [selRoleMember, setSelRoleMember] = useState("");
  const [roleMemberDefs, setRoleMemberDefs] = useState<RoleDef[]>([]);
  const [roleMemberAssessments, setRoleMemberAssessments] = useState<Map<Quarter, RoleAssessment>>(new Map());
  const [roleMgrDraft, setRoleMgrDraft] = useState<Map<Quarter, Record<string, number>>>(new Map());
  const [roleMgrQ, setRoleMgrQ] = useState<Quarter>(getCurrentQuarter());
  const [isSavingRoleMgr, setIsSavingRoleMgr] = useState(false);
  const [isLoadingRoleMember, setIsLoadingRoleMember] = useState(false);

  const [isLoading, setIsLoading] = useState(true);

  // ── Access check ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/dashboard"); return; }
      setCurrentUserId(user.id);
      const [{ data: target }, { data: roles }, { data: rDefs }] = await Promise.all([
        supabase.from("csbd_targets" as any).select("id")
          .eq("user_id", user.id).eq("fiscal_year", currentYear).eq("is_active", true).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        (supabase as any).from("kpi_role_definitions").select("id").eq("user_id", user.id).limit(1),
      ]);
      const isAdmin = roles?.some((r: any) =>
        ["platform_admin", "super_admin", "admin_administration"].includes(r.role));
      const isRay = user.email === "s.ray@redefine.in";
      setHasCsbdAccess(!!target);
      setHasRoleDefs((rDefs?.length || 0) > 0);
      setIsManager(isRay || !!isAdmin);
      setHasAccess(!!target || (rDefs?.length || 0) > 0 || isRay || !!isAdmin);
    };
    check();
  }, []);

  // ── Load CSBD defs + own assessments ──────────────────────────────────────────
  useEffect(() => {
    if (!currentUserId || hasAccess === null || hasAccess === false) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const [{ data: defs }, csbdRes, roleRes] = await Promise.all([
          supabase.from("kpi_definitions" as any)
            .select("id, section, item_name, max_points, sort_order").order("sort_order"),
          hasCsbdAccess
            ? (supabase as any).from("kpi_self_assessments")
                .select("id, quarter, calendar_year, scores, total_score, status, submitted_at, manager_scores, manager_status, manager_submitted_at")
                .eq("user_id", currentUserId).eq("calendar_year", currentYear)
            : Promise.resolve({ data: [] }),
          hasRoleDefs
            ? Promise.all([
                (supabase as any).from("kpi_role_definitions").select("*")
                  .eq("user_id", currentUserId).order("sort_order"),
                (supabase as any).from("kpi_role_assessments").select("*")
                  .eq("user_id", currentUserId).eq("calendar_year", currentYear),
              ])
            : Promise.resolve(null),
        ]);

        setKpiDefs((defs || []) as KPIDef[]);

        const csbdMap = new Map<Quarter, KPIAssessment>();
        const csbdScores = new Map<Quarter, Record<string, number>>();
        ((csbdRes.data || []) as KPIAssessment[]).forEach(a => {
          csbdMap.set(a.quarter as Quarter, a);
          csbdScores.set(a.quarter as Quarter, { ...(a.scores || {}) });
        });
        setCsbdAssessments(csbdMap);
        setCsbdDraft(csbdScores);

        if (roleRes) {
          const [rDefsRes, rAssmntsRes] = roleRes as any;
          setMyRoleDefs((rDefsRes.data || []) as RoleDef[]);
          const rMap = new Map<Quarter, RoleAssessment>();
          const rScores = new Map<Quarter, Record<string, number>>();
          ((rAssmntsRes.data || []) as RoleAssessment[]).forEach(a => {
            rMap.set(a.quarter as Quarter, a);
            rScores.set(a.quarter as Quarter, { ...(a.self_scores || {}) });
          });
          setRoleAssessments(rMap);
          setRoleDraft(rScores);
        }

        if (isManager) {
          // Load CSBD members
          const { data: targets } = await (supabase as any)
            .from("csbd_targets").select("user_id, profiles:user_id(full_name, email)")
            .eq("fiscal_year", currentYear).eq("is_active", true);
          const cList: Member[] = ((targets || []) as any[]).map((t: any) => ({
            user_id: t.user_id, full_name: t.profiles?.full_name || t.profiles?.email, email: t.profiles?.email || "",
          }));
          setCsbdMembers(cList);
          if (cList.length > 0) setSelCsbdMember(cList[0].user_id);

          // Load role members
          const { data: rDefs } = await (supabase as any)
            .from("kpi_role_definitions").select("user_id");
          const uniqueIds = [...new Set((rDefs || []).map((d: any) => d.user_id))];
          if (uniqueIds.length > 0) {
            const { data: profiles } = await supabase
              .from("profiles").select("id, full_name, email").in("id", uniqueIds);
            const rList: Member[] = (profiles || []).map((p: any) => ({
              user_id: p.id, full_name: p.full_name || p.email, email: p.email,
            }));
            setRoleMembers(rList);
            if (rList.length > 0) setSelRoleMember(rList[0].user_id);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [currentUserId, hasAccess, hasCsbdAccess, hasRoleDefs, isManager]);

  // ── Load CSBD member data for manager section ──────────────────────────────
  useEffect(() => {
    if (!isManager || !selCsbdMember) return;
    setIsLoadingCsbdMember(true);
    (supabase as any).from("kpi_self_assessments")
      .select("id, quarter, calendar_year, scores, total_score, status, submitted_at, manager_scores, manager_status, manager_submitted_at")
      .eq("user_id", selCsbdMember).eq("calendar_year", currentYear)
      .then(({ data }: any) => {
        const aMap = new Map<Quarter, KPIAssessment>();
        const mMap = new Map<Quarter, Record<string, number>>();
        ((data || []) as KPIAssessment[]).forEach(a => {
          aMap.set(a.quarter as Quarter, a);
          mMap.set(a.quarter as Quarter, { ...(a.manager_scores || {}) });
        });
        setCsbdMemberAssessments(aMap);
        setCsbdMgrDraft(mMap);
        setIsLoadingCsbdMember(false);
      });
  }, [isManager, selCsbdMember, currentYear]);

  // ── Load role member data for manager section ──────────────────────────────
  useEffect(() => {
    if (!isManager || !selRoleMember) return;
    setIsLoadingRoleMember(true);
    Promise.all([
      (supabase as any).from("kpi_role_definitions").select("*").eq("user_id", selRoleMember).order("sort_order"),
      (supabase as any).from("kpi_role_assessments").select("*").eq("user_id", selRoleMember).eq("calendar_year", currentYear),
    ]).then(([rDefsRes, rAssmntsRes]: any) => {
      setRoleMemberDefs((rDefsRes.data || []) as RoleDef[]);
      const aMap = new Map<Quarter, RoleAssessment>();
      const mMap = new Map<Quarter, Record<string, number>>();
      ((rAssmntsRes.data || []) as RoleAssessment[]).forEach((a: RoleAssessment) => {
        aMap.set(a.quarter as Quarter, a);
        mMap.set(a.quarter as Quarter, { ...(a.manager_scores || {}) });
      });
      setRoleMemberAssessments(aMap);
      setRoleMgrDraft(mMap);
      setIsLoadingRoleMember(false);
    });
  }, [isManager, selRoleMember, currentYear]);

  // ── CSBD self derived ─────────────────────────────────────────────────────────
  const kpiSections = useMemo(() => {
    const map = new Map<string, KPIDef[]>();
    kpiDefs.forEach(d => { if (!map.has(d.section)) map.set(d.section, []); map.get(d.section)!.push(d); });
    return map;
  }, [kpiDefs]);
  const maxPossible = useMemo(() => kpiDefs.reduce((s, d) => s + d.max_points, 0), [kpiDefs]);
  const csbdCurrentA = csbdAssessments.get(csbdQ);
  const isCsbdSubmitted = csbdCurrentA?.status === "submitted";
  const csbdScores = csbdDraft.get(csbdQ) || {};
  const csbdTotal = useMemo(() => kpiDefs.reduce((s, d) => s + (csbdScores[d.id] || 0), 0), [kpiDefs, csbdScores, csbdQ]);

  // ── Role self derived ─────────────────────────────────────────────────────────
  const roleCurrentA = roleAssessments.get(roleQ);
  const isRoleSubmitted = roleCurrentA?.self_status === "submitted";
  const roleScores = roleDraft.get(roleQ) || {};
  const roleTotal = useMemo(() => calcRoleTotal(myRoleDefs, roleScores), [myRoleDefs, roleScores, roleQ]);

  // ── CSBD manager derived ──────────────────────────────────────────────────────
  const csbdMgrCurrentA = csbdMemberAssessments.get(csbdMgrQ);
  const isCsbdMgrSubmitted = csbdMgrCurrentA?.manager_status === "submitted";
  const csbdMgrScores = csbdMgrDraft.get(csbdMgrQ) || {};
  const csbdMemberSelfScores = csbdMgrCurrentA?.scores || {};
  const csbdMgrTotal = useMemo(() => kpiDefs.reduce((s, d) => s + (csbdMgrScores[d.id] || 0), 0), [kpiDefs, csbdMgrScores]);
  const csbdMemberSelfTotal = useMemo(() => kpiDefs.reduce((s, d) => s + (csbdMemberSelfScores[d.id] || 0), 0), [kpiDefs, csbdMemberSelfScores]);
  const csbdCombined = useMemo(() => {
    if (csbdMgrCurrentA?.status === "submitted" && isCsbdMgrSubmitted) {
      return kpiDefs.reduce((s, d) => s + ((csbdMemberSelfScores[d.id] || 0) + (csbdMgrScores[d.id] || 0)) / 2, 0);
    }
    return null;
  }, [kpiDefs, csbdMemberSelfScores, csbdMgrScores, csbdMgrCurrentA, isCsbdMgrSubmitted]);

  // ── Role manager derived ──────────────────────────────────────────────────────
  const roleMgrCurrentA = roleMemberAssessments.get(roleMgrQ);
  const isRoleMgrSubmitted = roleMgrCurrentA?.manager_status === "submitted";
  const roleMgrScores = roleMgrDraft.get(roleMgrQ) || {};
  const roleMemberSelfScores = roleMgrCurrentA?.self_scores || {};
  const roleMgrTotal = useMemo(() => calcRoleTotal(roleMemberDefs, roleMgrScores), [roleMemberDefs, roleMgrScores]);
  const roleMemberSelfTotal = useMemo(() => calcRoleTotal(roleMemberDefs, roleMemberSelfScores), [roleMemberDefs, roleMemberSelfScores]);
  const roleCombined = useMemo(() => {
    if (roleMgrCurrentA?.self_status === "submitted" && isRoleMgrSubmitted) {
      return roleMemberDefs.reduce((s, d) => {
        const avg = ((roleMemberSelfScores[d.id] || 0) + (roleMgrScores[d.id] || 0)) / 2;
        return s + (avg * d.weightage) / 100;
      }, 0);
    }
    return null;
  }, [roleMemberDefs, roleMemberSelfScores, roleMgrScores, roleMgrCurrentA, isRoleMgrSubmitted]);

  // ── Score change handlers ─────────────────────────────────────────────────────
  const handleCsbdChange = (id: string, val: string, max: number) => {
    if (isCsbdSubmitted) return;
    let n = parseInt(val, 10); if (isNaN(n) || n < 0) n = 0; if (n > max) n = max;
    setCsbdDraft(p => { const m = new Map(p); m.set(csbdQ, { ...(m.get(csbdQ) || {}), [id]: n }); return m; });
  };
  const handleRoleChange = (id: string, val: string) => {
    if (isRoleSubmitted) return;
    let n = parseInt(val, 10); if (isNaN(n) || n < 0) n = 0; if (n > 100) n = 100;
    setRoleDraft(p => { const m = new Map(p); m.set(roleQ, { ...(m.get(roleQ) || {}), [id]: n }); return m; });
  };
  const handleCsbdMgrChange = (id: string, val: string, max: number) => {
    if (isCsbdMgrSubmitted) return;
    let n = parseInt(val, 10); if (isNaN(n) || n < 0) n = 0; if (n > max) n = max;
    setCsbdMgrDraft(p => { const m = new Map(p); m.set(csbdMgrQ, { ...(m.get(csbdMgrQ) || {}), [id]: n }); return m; });
  };
  const handleRoleMgrChange = (id: string, val: string) => {
    if (isRoleMgrSubmitted) return;
    let n = parseInt(val, 10); if (isNaN(n) || n < 0) n = 0; if (n > 100) n = 100;
    setRoleMgrDraft(p => { const m = new Map(p); m.set(roleMgrQ, { ...(m.get(roleMgrQ) || {}), [id]: n }); return m; });
  };

  // ── Save handlers ─────────────────────────────────────────────────────────────
  const saveCsbd = async (submit: boolean) => {
    setIsSavingCsbd(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      if (submit && !confirm(`Submit KPI self-assessment for ${csbdQ} ${currentYear}?`)) return;
      const scores = csbdDraft.get(csbdQ) || {};
      const total = kpiDefs.reduce((s, d) => s + (scores[d.id] || 0), 0);
      const payload: any = {
        user_id: user.id, calendar_year: currentYear, quarter: csbdQ,
        scores, total_score: total, status: submit ? "submitted" : "draft", updated_at: new Date().toISOString(),
      };
      if (submit) payload.submitted_at = new Date().toISOString();
      const existing = csbdAssessments.get(csbdQ);
      const result = existing
        ? await (supabase as any).from("kpi_self_assessments").update(payload).eq("id", existing.id).select().single()
        : await (supabase as any).from("kpi_self_assessments").insert(payload).select().single();
      if (result.error) throw result.error;
      setCsbdAssessments(p => { const m = new Map(p); m.set(csbdQ, result.data); return m; });
      toast.success(submit ? `${csbdQ} submitted` : "Draft saved");
    } catch (e: any) { toast.error(e.message || "Failed to save"); }
    finally { setIsSavingCsbd(false); }
  };

  const saveRole = async (submit: boolean) => {
    setIsSavingRole(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      if (submit && !confirm(`Submit performance self-assessment for ${roleQ} ${currentYear}?`)) return;
      const scores = roleDraft.get(roleQ) || {};
      const total = parseFloat(calcRoleTotal(myRoleDefs, scores).toFixed(2));
      const payload: any = {
        user_id: user.id, calendar_year: currentYear, quarter: roleQ,
        self_scores: scores, self_total: total, self_status: submit ? "submitted" : "draft", updated_at: new Date().toISOString(),
      };
      if (submit) payload.self_submitted_at = new Date().toISOString();
      const existing = roleAssessments.get(roleQ);
      const result = existing
        ? await (supabase as any).from("kpi_role_assessments").update(payload).eq("id", existing.id).select().single()
        : await (supabase as any).from("kpi_role_assessments").insert(payload).select().single();
      if (result.error) throw result.error;
      setRoleAssessments(p => { const m = new Map(p); m.set(roleQ, result.data); return m; });
      toast.success(submit ? `${roleQ} submitted` : "Draft saved");
    } catch (e: any) { toast.error(e.message || "Failed to save"); }
    finally { setIsSavingRole(false); }
  };

  const saveCsbdMgr = async (submit: boolean) => {
    if (!selCsbdMember) return;
    setIsSavingCsbdMgr(true);
    try {
      if (submit && !confirm(`Submit CSBD manager assessment for ${csbdMgrQ} ${currentYear}?`)) return;
      const scores = csbdMgrDraft.get(csbdMgrQ) || {};
      const payload: any = { manager_scores: scores, manager_status: submit ? "submitted" : "draft", updated_at: new Date().toISOString() };
      if (submit) payload.manager_submitted_at = new Date().toISOString();
      const existing = csbdMemberAssessments.get(csbdMgrQ);
      const result = existing
        ? await (supabase as any).from("kpi_self_assessments").update(payload).eq("id", existing.id).select().single()
        : await (supabase as any).from("kpi_self_assessments").insert({
            user_id: selCsbdMember, calendar_year: currentYear, quarter: csbdMgrQ,
            scores: {}, total_score: 0, status: "draft", ...payload,
          }).select().single();
      if (result.error) throw result.error;
      setCsbdMemberAssessments(p => { const m = new Map(p); m.set(csbdMgrQ, result.data); return m; });
      toast.success(submit ? `CSBD manager assessment submitted for ${csbdMgrQ}` : "Draft saved");
    } catch (e: any) { toast.error(e.message || "Failed to save"); }
    finally { setIsSavingCsbdMgr(false); }
  };

  const saveRoleMgr = async (submit: boolean) => {
    if (!selRoleMember) return;
    setIsSavingRoleMgr(true);
    try {
      if (submit && !confirm(`Submit manager assessment for ${roleMgrQ} ${currentYear}?`)) return;
      const scores = roleMgrDraft.get(roleMgrQ) || {};
      const total = parseFloat(calcRoleTotal(roleMemberDefs, scores).toFixed(2));
      let combined: number | null = null;
      const selfA = roleMemberAssessments.get(roleMgrQ);
      if (submit && selfA?.self_status === "submitted") {
        combined = parseFloat(roleMemberDefs.reduce((s, d) => {
          const avg = ((selfA.self_scores[d.id] || 0) + (scores[d.id] || 0)) / 2;
          return s + (avg * d.weightage) / 100;
        }, 0).toFixed(2));
      }
      const payload: any = {
        manager_scores: scores, manager_total: total,
        manager_status: submit ? "submitted" : "draft", updated_at: new Date().toISOString(),
        ...(combined !== null ? { combined_total: combined } : {}),
        ...(submit ? { manager_submitted_at: new Date().toISOString() } : {}),
      };
      const existing = roleMemberAssessments.get(roleMgrQ);
      const result = existing
        ? await (supabase as any).from("kpi_role_assessments").update(payload).eq("id", existing.id).select().single()
        : await (supabase as any).from("kpi_role_assessments").insert({
            user_id: selRoleMember, calendar_year: currentYear, quarter: roleMgrQ,
            self_scores: {}, self_total: 0, self_status: "draft", ...payload,
          }).select().single();
      if (result.error) throw result.error;
      setRoleMemberAssessments(p => { const m = new Map(p); m.set(roleMgrQ, result.data); return m; });
      toast.success(submit ? `Manager assessment submitted for ${roleMgrQ}` : "Draft saved");
    } catch (e: any) { toast.error(e.message || "Failed to save"); }
    finally { setIsSavingRoleMgr(false); }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  if (hasAccess === null || isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  if (hasAccess === false) { navigate("/dashboard"); return null; }

  const QTabs = ({ active, setActive, statusFn, cfg }: {
    active: Quarter; setActive: (q: Quarter) => void;
    statusFn: (q: Quarter) => string;
    cfg: Record<string, { label: string; variant: "default" | "secondary" | "outline"; className: string }>;
  }) => (
    <div className="flex gap-2 flex-wrap">
      {QUARTERS.map(q => {
        const s = statusFn(q) as keyof typeof cfg;
        const c = cfg[s] || cfg.not_started;
        return (
          <button key={q} onClick={() => setActive(q)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              active === q ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border"
            }`}
          >
            {q}
            <Badge variant={c.variant} className={`text-[10px] px-1.5 py-0 ${c.className}`}>{c.label}</Badge>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="container mx-auto py-6 space-y-8 max-w-3xl">
      <PageHeader title="Assessment" subtitle={`Calendar Year ${currentYear}`} icon={ClipboardCheck} />

      {/* ════ CSBD SELF ════ */}
      {hasCsbdAccess && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">KPI Self Assessment — CSBD</h2>
          <QTabs active={csbdQ} setActive={setCsbdQ} cfg={SELF_CFG}
            statusFn={q => { const a = csbdAssessments.get(q); return a?.status === "submitted" ? "submitted" : a ? "draft" : "not_started"; }} />
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">{csbdQ} {currentYear}</CardTitle>
                <CardDescription>
                  {isCsbdSubmitted
                    ? `Submitted ${new Date(csbdCurrentA!.submitted_at!).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
                    : "Enter scores (0 – max points per item)"}
                </CardDescription>
              </div>
              {isCsbdSubmitted && <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium"><Lock className="h-4 w-4" /> Locked</div>}
            </CardHeader>
            <CardContent className="space-y-6">
              {Array.from(kpiSections.entries()).map(([sec, items]) => (
                <div key={sec}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{sec}</span>
                    <Separator className="flex-1" />
                    <span className="text-xs text-muted-foreground">{items.reduce((s, d) => s + (csbdScores[d.id] || 0), 0)} / {items.reduce((s, d) => s + d.max_points, 0)}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map(def => (
                      <div key={def.id} className="flex items-center gap-3">
                        <span className="flex-1 text-sm">{def.item_name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Input type="number" min={0} max={def.max_points} value={csbdScores[def.id] ?? ""}
                            onChange={e => handleCsbdChange(def.id, e.target.value, def.max_points)}
                            disabled={isCsbdSubmitted} className="w-20 h-8 text-center text-sm" placeholder="0" />
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
                <span className={`text-lg font-bold ${csbdTotal === maxPossible ? "text-green-600" : ""}`}>
                  {csbdTotal} <span className="text-muted-foreground font-normal text-sm">/ {maxPossible}</span>
                </span>
              </div>
              {!isCsbdSubmitted && (
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => saveCsbd(false)} disabled={isSavingCsbd} className="flex-1">
                    {isSavingCsbd ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save Draft
                  </Button>
                  <Button onClick={() => saveCsbd(true)} disabled={isSavingCsbd} className="flex-1">
                    {isSavingCsbd ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Submit {csbdQ}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* ════ ROLE SELF ════ */}
      {hasRoleDefs && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Performance Self Assessment</h2>
          <QTabs active={roleQ} setActive={setRoleQ} cfg={SELF_CFG}
            statusFn={q => { const a = roleAssessments.get(q); return a?.self_status === "submitted" ? "submitted" : a ? "draft" : "not_started"; }} />
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">{roleQ} {currentYear}</CardTitle>
                <CardDescription>
                  {isRoleSubmitted
                    ? `Submitted ${new Date(roleCurrentA!.self_submitted_at!).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
                    : "Score each category 0–100"}
                </CardDescription>
              </div>
              {isRoleSubmitted && <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium"><Lock className="h-4 w-4" /> Locked</div>}
            </CardHeader>
            <CardContent className="space-y-4">
              {myRoleDefs.map(def => {
                const score = roleScores[def.id] ?? 0;
                return (
                  <div key={def.id} className="space-y-1">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <span className="text-sm font-medium">{def.category_name}</span>
                        <span className="text-xs text-muted-foreground ml-2">({def.weightage} pts)</span>
                        {def.sub_items.length > 0 && (
                          <div className="flex flex-wrap gap-x-3 mt-0.5">
                            {def.sub_items.map((s, i) => <span key={i} className="text-[11px] text-muted-foreground">· {s}</span>)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Input type="number" min={0} max={100} value={roleScores[def.id] ?? ""}
                          onChange={e => handleRoleChange(def.id, e.target.value)}
                          disabled={isRoleSubmitted} className="w-20 h-8 text-center text-sm" placeholder="0" />
                        <span className="text-xs text-muted-foreground w-8">/ 100</span>
                        <span className="text-xs text-primary w-14 text-right font-medium">
                          {((score * def.weightage) / 100).toFixed(2)} pts
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total Score</span>
                <span className={`text-lg font-bold ${roleTotal >= 99.9 ? "text-green-600" : ""}`}>
                  {roleTotal.toFixed(2)} <span className="text-muted-foreground font-normal text-sm">/ 100</span>
                </span>
              </div>
              {!isRoleSubmitted && (
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => saveRole(false)} disabled={isSavingRole} className="flex-1">
                    {isSavingRole ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save Draft
                  </Button>
                  <Button onClick={() => saveRole(true)} disabled={isSavingRole} className="flex-1">
                    {isSavingRole ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Submit {roleQ}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* ════ CSBD MANAGER ════ */}
      {isManager && kpiDefs.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <UserCog className="h-4 w-4" /> Manager Assessment — CSBD
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground shrink-0">Member:</span>
            <Select value={selCsbdMember} onValueChange={setSelCsbdMember}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Select CSBD member" /></SelectTrigger>
              <SelectContent>
                {csbdMembers.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isLoadingCsbdMember
            ? <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            : <>
              <QTabs active={csbdMgrQ} setActive={setCsbdMgrQ} cfg={MGR_CFG}
                statusFn={q => { const a = csbdMemberAssessments.get(q); return a?.manager_status === "submitted" ? "submitted" : a?.manager_status === "draft" ? "draft" : "not_started"; }} />
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-base">
                      {csbdMembers.find(m => m.user_id === selCsbdMember)?.full_name} — {csbdMgrQ} {currentYear}
                    </CardTitle>
                    <CardDescription>
                      {isCsbdMgrSubmitted
                        ? `Submitted ${new Date(csbdMgrCurrentA!.manager_submitted_at!).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
                        : "Enter manager scores (0 – max points per item)"}
                    </CardDescription>
                  </div>
                  {isCsbdMgrSubmitted && <div className="flex items-center gap-1.5 text-blue-600 text-sm font-medium"><Lock className="h-4 w-4" /> Locked</div>}
                </CardHeader>
                <CardContent className="space-y-6">
                  {Array.from(kpiSections.entries()).map(([sec, items]) => (
                    <div key={sec}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{sec}</span>
                        <Separator className="flex-1" />
                      </div>
                      <div className="grid grid-cols-[1fr_70px_70px_70px] gap-2 text-[11px] text-muted-foreground font-medium pb-1">
                        <span>Item</span><span className="text-center">Self</span><span className="text-center">Manager</span><span className="text-center">Avg</span>
                      </div>
                      <div className="space-y-2">
                        {items.map(def => {
                          const self = csbdMemberSelfScores[def.id] ?? null;
                          const mgr = csbdMgrScores[def.id] ?? 0;
                          const avg = self !== null ? (((self + mgr) / 2)).toFixed(1) : "—";
                          return (
                            <div key={def.id} className="grid grid-cols-[1fr_70px_70px_70px] gap-2 items-center">
                              <span className="text-sm">{def.item_name} <span className="text-xs text-muted-foreground">/ {def.max_points}</span></span>
                              <span className="text-sm text-center text-muted-foreground">{self ?? "—"}</span>
                              <Input type="number" min={0} max={def.max_points} value={csbdMgrScores[def.id] ?? ""}
                                onChange={e => handleCsbdMgrChange(def.id, e.target.value, def.max_points)}
                                disabled={isCsbdMgrSubmitted} className="h-8 text-center text-sm" placeholder="0" />
                              <span className="text-xs text-center text-muted-foreground">{avg}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <Separator />
                  <div className="space-y-1">
                    {csbdMgrCurrentA?.status === "submitted" && <div className="flex justify-between text-sm text-muted-foreground"><span>Self Total</span><span>{csbdMemberSelfTotal} / {maxPossible}</span></div>}
                    <div className="flex justify-between text-sm text-muted-foreground"><span>Manager Total</span><span>{csbdMgrTotal} / {maxPossible}</span></div>
                    {csbdCombined !== null && <div className="flex justify-between font-semibold"><span>Combined Score</span><span className="text-lg text-primary">{csbdCombined} <span className="text-muted-foreground font-normal text-sm">/ {maxPossible}</span></span></div>}
                  </div>
                  {!isCsbdMgrSubmitted && (
                    <div className="flex gap-3 pt-2">
                      <Button variant="outline" onClick={() => saveCsbdMgr(false)} disabled={isSavingCsbdMgr} className="flex-1">
                        {isSavingCsbdMgr ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save Draft
                      </Button>
                      <Button onClick={() => saveCsbdMgr(true)} disabled={isSavingCsbdMgr} className="flex-1">
                        {isSavingCsbdMgr ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Submit {csbdMgrQ}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          }
        </section>
      )}

      {/* ════ ROLE MANAGER ════ */}
      {isManager && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <UserCog className="h-4 w-4" /> Manager Assessment — Performance
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground shrink-0">Member:</span>
            <Select value={selRoleMember} onValueChange={setSelRoleMember}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Select member" /></SelectTrigger>
              <SelectContent>
                {roleMembers.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isLoadingRoleMember
            ? <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            : roleMemberDefs.length === 0 ? <p className="text-sm text-muted-foreground">No KPI definitions found for selected member.</p>
            : <>
              <QTabs active={roleMgrQ} setActive={setRoleMgrQ} cfg={MGR_CFG}
                statusFn={q => { const a = roleMemberAssessments.get(q); return a?.manager_status === "submitted" ? "submitted" : a?.manager_status === "draft" ? "draft" : "not_started"; }} />
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-base">
                      {roleMembers.find(m => m.user_id === selRoleMember)?.full_name} — {roleMgrQ} {currentYear}
                    </CardTitle>
                    <CardDescription>
                      {isRoleMgrSubmitted
                        ? `Submitted ${new Date(roleMgrCurrentA!.manager_submitted_at!).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
                        : "Enter manager scores 0–100 per category"}
                    </CardDescription>
                  </div>
                  {isRoleMgrSubmitted && <div className="flex items-center gap-1.5 text-blue-600 text-sm font-medium"><Lock className="h-4 w-4" /> Locked</div>}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-[1fr_70px_70px_60px_70px] gap-2 text-[11px] text-muted-foreground font-medium pb-1 border-b">
                    <span>Category (wt%)</span><span className="text-center">Self</span><span className="text-center">Manager</span><span className="text-center">Avg</span><span className="text-center">Score</span>
                  </div>
                  {roleMemberDefs.map(def => {
                    const self = roleMemberSelfScores[def.id] ?? null;
                    const mgr = roleMgrScores[def.id] ?? 0;
                    const avg = self !== null ? ((self + mgr) / 2) : null;
                    const weighted = avg !== null ? ((avg * def.weightage) / 100).toFixed(2) : "—";
                    return (
                      <div key={def.id} className="grid grid-cols-[1fr_70px_70px_60px_70px] gap-2 items-center">
                        <div>
                          <span className="text-sm font-medium">{def.category_name}</span>
                          <span className="text-xs text-muted-foreground ml-1">({def.weightage}%)</span>
                          {def.sub_items.length > 0 && (
                            <div className="flex flex-wrap gap-x-2 mt-0.5">
                              {def.sub_items.map((s, i) => <span key={i} className="text-[11px] text-muted-foreground">· {s}</span>)}
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-center text-muted-foreground">{self ?? "—"}</span>
                        <Input type="number" min={0} max={100} value={roleMgrScores[def.id] ?? ""}
                          onChange={e => handleRoleMgrChange(def.id, e.target.value)}
                          disabled={isRoleMgrSubmitted} className="h-8 text-center text-sm" placeholder="0" />
                        <span className="text-xs text-center text-muted-foreground">{avg !== null ? avg.toFixed(1) : "—"}</span>
                        <span className="text-xs text-center font-medium text-primary">{weighted}</span>
                      </div>
                    );
                  })}
                  <Separator />
                  <div className="space-y-1">
                    {roleMgrCurrentA?.self_status === "submitted" && <div className="flex justify-between text-sm text-muted-foreground"><span>Self Total</span><span>{roleMemberSelfTotal.toFixed(2)} / 100</span></div>}
                    <div className="flex justify-between text-sm text-muted-foreground"><span>Manager Total</span><span>{roleMgrTotal.toFixed(2)} / 100</span></div>
                    {roleCombined !== null && <div className="flex justify-between font-semibold"><span>Combined Score</span><span className="text-lg text-primary">{roleCombined.toFixed(2)} <span className="text-muted-foreground font-normal text-sm">/ 100</span></span></div>}
                  </div>
                  {!isRoleMgrSubmitted && (
                    <div className="flex gap-3 pt-2">
                      <Button variant="outline" onClick={() => saveRoleMgr(false)} disabled={isSavingRoleMgr} className="flex-1">
                        {isSavingRoleMgr ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save Draft
                      </Button>
                      <Button onClick={() => saveRoleMgr(true)} disabled={isSavingRoleMgr} className="flex-1">
                        {isSavingRoleMgr ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Submit {roleMgrQ}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          }
        </section>
      )}
    </div>
  );
}
