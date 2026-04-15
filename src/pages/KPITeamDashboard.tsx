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
}

interface CSBDMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

type Quarter = "Q1" | "Q2" | "Q3" | "Q4";
const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

export default function KPITeamDashboard() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [definitions, setDefinitions] = useState<KPIDefinition[]>([]);
  const [members, setMembers] = useState<CSBDMember[]>([]);
  const [allAssessments, setAllAssessments] = useState<KPIAssessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<CSBDMember | null>(null);

  // Check access
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const isRay = user.email === "s.ray@redefine.in";

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isAdmin = roles?.some(r =>
        ["platform_admin", "super_admin", "admin_administration"].includes(r.role)
      );

      setHasAccess(isRay || !!isAdmin);
    };
    check();
  }, []);

  // Load data
  useEffect(() => {
    if (hasAccess === false) return;
    if (hasAccess === null) return;

    const load = async () => {
      setIsLoading(true);
      try {
        // Load definitions
        const { data: defs } = await supabase
          .from("kpi_definitions" as any)
          .select("id, section, item_name, max_points, sort_order")
          .order("sort_order");
        setDefinitions((defs || []) as KPIDefinition[]);

        // Load CSBD members with active targets for selected year
        const { data: targets } = await (supabase as any)
          .from("csbd_targets")
          .select("user_id, profiles:user_id(full_name, email)")
          .eq("fiscal_year", selectedYear)
          .eq("is_active", true);

        const memberList: CSBDMember[] = ((targets || []) as any[]).map((t: any) => ({
          user_id: t.user_id,
          full_name: t.profiles?.full_name || null,
          email: t.profiles?.email || null,
        }));
        setMembers(memberList);

        if (memberList.length === 0) {
          setAllAssessments([]);
          return;
        }

        // Load all assessments for those members this year
        const userIds = memberList.map(m => m.user_id);
        const { data: assmnts } = await (supabase as any)
          .from("kpi_self_assessments")
          .select("id, user_id, quarter, calendar_year, scores, total_score, status, submitted_at")
          .eq("calendar_year", selectedYear)
          .in("user_id", userIds);

        setAllAssessments((assmnts || []) as KPIAssessment[]);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [hasAccess, selectedYear]);

  // Map: user_id -> quarter -> assessment
  const assessmentMap = useMemo(() => {
    const map = new Map<string, Map<Quarter, KPIAssessment>>();
    allAssessments.forEach(a => {
      if (!map.has(a.user_id)) map.set(a.user_id, new Map());
      map.get(a.user_id)!.set(a.quarter as Quarter, a);
    });
    return map;
  }, [allAssessments]);

  const sections = useMemo(() => {
    const map = new Map<string, KPIDefinition[]>();
    definitions.forEach(d => {
      if (!map.has(d.section)) map.set(d.section, []);
      map.get(d.section)!.push(d);
    });
    return map;
  }, [definitions]);

  const maxPossible = definitions.reduce((s, d) => s + d.max_points, 0);

  const renderQuarterCell = (userId: string, q: Quarter) => {
    const a = assessmentMap.get(userId)?.get(q);
    if (!a) return <span className="text-muted-foreground">—</span>;
    if (a.status === "draft") return <Badge variant="secondary" className="text-xs">Draft</Badge>;
    return (
      <span className="font-semibold">
        {a.total_score}
        <span className="text-muted-foreground font-normal text-xs">/{maxPossible}</span>
      </span>
    );
  };

  // Selected member scorecard
  const memberAssessments = selectedMember
    ? assessmentMap.get(selectedMember.user_id) || new Map()
    : new Map();

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  if (hasAccess === null || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (hasAccess === false) {
    return (
      <div className="container mx-auto py-12 text-center">
        <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Team Assessment Dashboard</h2>
        <p className="text-muted-foreground">You don't have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Team KPI Assessment"
          subtitle="CSBD members' self-assessment scores"
          icon={BarChart3}
        />
        <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CSBD Team Scores — {selectedYear}</CardTitle>
          <CardDescription>
            {members.length} member{members.length !== 1 ? "s" : ""} with active targets.
            Click a row to view full scorecard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No CSBD members with active targets found for {selectedYear}.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  {QUARTERS.map(q => <TableHead key={q} className="text-center">{q}</TableHead>)}
                  <TableHead className="w-8"></TableHead>
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
                      <div className="font-medium">{m.full_name || "—"}</div>
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

      {/* Member scorecard dialog */}
      <Dialog open={!!selectedMember} onOpenChange={open => { if (!open) setSelectedMember(null); }}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedMember?.full_name} — Full Scorecard {selectedYear}</DialogTitle>
            <DialogDescription>{selectedMember?.email}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-2">
            {QUARTERS.map(q => {
              const a = memberAssessments.get(q);
              const quarterTotal = a ? a.total_score : null;
              const isSubmitted = a?.status === "submitted";

              return (
                <div key={q}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-semibold text-sm">{q}</span>
                    {a?.status === "submitted" && (
                      <Badge className="bg-green-600 text-xs">Submitted</Badge>
                    )}
                    {a?.status === "draft" && (
                      <Badge variant="secondary" className="text-xs">Draft</Badge>
                    )}
                    {!a && (
                      <Badge variant="outline" className="text-xs">Not Started</Badge>
                    )}
                    {isSubmitted && quarterTotal !== null && (
                      <span className="ml-auto font-bold">
                        {quarterTotal}<span className="text-muted-foreground font-normal text-xs">/{maxPossible}</span>
                      </span>
                    )}
                  </div>

                  {a ? (
                    <div className="space-y-4 pl-4">
                      {Array.from(sections.entries()).map(([sectionName, items]) => (
                        <div key={sectionName}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              {sectionName}
                            </span>
                            <Separator className="flex-1" />
                          </div>
                          <div className="space-y-1">
                            {items.map(def => {
                              const score = a.scores?.[def.id] ?? 0;
                              return (
                                <div key={def.id} className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">{def.item_name}</span>
                                  <span className={`font-medium w-20 text-right ${score === def.max_points ? "text-green-600" : score === 0 ? "text-muted-foreground" : ""}`}>
                                    {score} / {def.max_points}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
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
    </div>
  );
}
