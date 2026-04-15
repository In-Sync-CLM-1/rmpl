import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ClipboardCheck, Loader2, Lock, Save, Send } from "lucide-react";
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

export default function KPISelfAssessment() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [definitions, setDefinitions] = useState<KPIDefinition[]>([]);
  const [assessments, setAssessments] = useState<Map<Quarter, KPIAssessment>>(new Map());
  const [draftScores, setDraftScores] = useState<Map<Quarter, Record<string, number>>>(new Map());
  const [activeQuarter, setActiveQuarter] = useState<Quarter>(getCurrentQuarter());
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check access: must have active csbd_targets for current year
  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const { data: target } = await supabase
        .from("csbd_targets" as any)
        .select("id")
        .eq("user_id", user.id)
        .eq("fiscal_year", currentYear)
        .eq("is_active", true)
        .maybeSingle();

      // Also allow admins to view
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isAdmin = roles?.some(r =>
        ["platform_admin", "super_admin", "admin_administration"].includes(r.role)
      );

      setHasAccess(!!target || !!isAdmin);
    };
    checkAccess();
  }, []);

  // Load definitions + assessments for current year
  useEffect(() => {
    if (hasAccess === false) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [{ data: defs }, { data: assmnts }] = await Promise.all([
          supabase
            .from("kpi_definitions" as any)
            .select("id, section, item_name, max_points, sort_order")
            .order("sort_order"),
          supabase
            .from("kpi_self_assessments" as any)
            .select("id, quarter, calendar_year, scores, total_score, status, submitted_at")
            .eq("user_id", user.id)
            .eq("calendar_year", currentYear),
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
      } finally {
        setIsLoading(false);
      }
    };
    if (hasAccess !== null) load();
  }, [hasAccess]);

  const sections = useMemo(() => {
    const map = new Map<string, KPIDefinition[]>();
    definitions.forEach(d => {
      if (!map.has(d.section)) map.set(d.section, []);
      map.get(d.section)!.push(d);
    });
    return map;
  }, [definitions]);

  const currentAssessment = assessments.get(activeQuarter);
  const isSubmitted = currentAssessment?.status === "submitted";
  const currentScores = draftScores.get(activeQuarter) || {};

  const totalScoreForQuarter = useMemo(() =>
    definitions.reduce((sum, d) => sum + (currentScores[d.id] || 0), 0),
    [definitions, currentScores, activeQuarter]
  );

  const maxPossible = useMemo(() =>
    definitions.reduce((sum, d) => sum + d.max_points, 0),
    [definitions]
  );

  const handleScoreChange = (defId: string, value: string, maxPoints: number) => {
    if (isSubmitted) return;
    let num = parseInt(value, 10);
    if (isNaN(num) || num < 0) num = 0;
    if (num > maxPoints) num = maxPoints;
    setDraftScores(prev => {
      const next = new Map(prev);
      const q = next.get(activeQuarter) || {};
      next.set(activeQuarter, { ...q, [defId]: num });
      return next;
    });
  };

  const handleSave = async (submit: boolean) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (submit && !confirm(
        `Submit your KPI self-assessment for ${activeQuarter} ${currentYear}? This cannot be edited after submission.`
      )) {
        return;
      }

      const scores = draftScores.get(activeQuarter) || {};
      const total = definitions.reduce((sum, d) => sum + (scores[d.id] || 0), 0);

      const payload: any = {
        user_id: user.id,
        calendar_year: currentYear,
        quarter: activeQuarter,
        scores,
        total_score: total,
        status: submit ? "submitted" : "draft",
        updated_at: new Date().toISOString(),
      };
      if (submit) payload.submitted_at = new Date().toISOString();

      const existing = assessments.get(activeQuarter);
      let result;
      if (existing) {
        result = await (supabase as any)
          .from("kpi_self_assessments")
          .update(payload)
          .eq("id", existing.id)
          .select()
          .single();
      } else {
        result = await (supabase as any)
          .from("kpi_self_assessments")
          .insert(payload)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      setAssessments(prev => {
        const next = new Map(prev);
        next.set(activeQuarter, result.data as KPIAssessment);
        return next;
      });

      toast.success(submit ? `${activeQuarter} submitted successfully` : "Draft saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setIsSaving(false);
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
    <div className="container mx-auto py-6 space-y-6 max-w-3xl">
      <PageHeader
        title="KPI Self Assessment"
        subtitle={`Calendar Year ${currentYear} — 100 points total`}
        icon={ClipboardCheck}
      />

      {/* Quarter tabs */}
      <div className="flex gap-2 flex-wrap">
        {QUARTERS.map(q => {
          const a = assessments.get(q);
          const status = a?.status === "submitted" ? "submitted" : a?.status === "draft" ? "draft" : "not_started";
          const cfg = STATUS_CONFIG[status];
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
              <Badge
                variant={cfg.variant}
                className={`text-[10px] px-1.5 py-0 ${cfg.className}`}
              >
                {cfg.label}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Quarter form */}
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
              <Lock className="h-4 w-4" />
              Locked
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {Array.from(sections.entries()).map(([sectionName, items]) => (
            <div key={sectionName}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {sectionName}
                </span>
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
                      <Input
                        type="number"
                        min={0}
                        max={def.max_points}
                        value={currentScores[def.id] ?? ""}
                        onChange={e => handleScoreChange(def.id, e.target.value, def.max_points)}
                        disabled={isSubmitted}
                        className="w-20 h-8 text-center text-sm"
                        placeholder="0"
                      />
                      <span className="text-xs text-muted-foreground w-12">/ {def.max_points}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Total row */}
          <Separator />
          <div className="flex items-center justify-between">
            <span className="font-semibold">Total Score</span>
            <span className={`text-lg font-bold ${totalScoreForQuarter === maxPossible ? "text-green-600" : ""}`}>
              {totalScoreForQuarter} <span className="text-muted-foreground font-normal text-sm">/ {maxPossible}</span>
            </span>
          </div>

          {/* Actions */}
          {!isSubmitted && (
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => handleSave(false)}
                disabled={isSaving}
                className="flex-1"
              >
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Draft
              </Button>
              <Button
                onClick={() => handleSave(true)}
                disabled={isSaving}
                className="flex-1"
              >
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Submit {activeQuarter}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
