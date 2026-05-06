import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Phone,
  PhoneCall,
  Pause,
  Play,
  SkipForward,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Building2,
  MapPin,
  Clock,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAutoDialer, AutoDialerLead, WRAPUP_SECONDS } from "@/hooks/useAutoDialer";

interface CallDisposition {
  disposition: string;
  subdispositions: string[];
}

interface AutoDialerSessionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: AutoDialerLead[];
  userPhone: string | null;
  onSessionEnd?: () => void;
}

export function AutoDialerSession({ open, onOpenChange, leads, userPhone, onSessionEnd }: AutoDialerSessionProps) {
  const [confirmEnd, setConfirmEnd] = useState(false);

  const { data: dispositions = [] } = useQuery({
    queryKey: ["call-dispositions-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_dispositions")
        .select("*")
        .eq("is_active", true)
        .order("disposition");
      if (error) throw error;
      return (data || []) as CallDisposition[];
    },
    enabled: open,
  });

  const dialer = useAutoDialer({
    leads,
    userPhone,
    onClose: () => {
      onOpenChange(false);
      onSessionEnd?.();
    },
  });

  const {
    currentIndex,
    currentLead,
    total,
    isFinished,
    isCallingNow,
    isPaused,
    wrapUpRemaining,
    outcomes,
    counts,
    handleConnectCall,
    saveDispositionAndNext,
    skipLead,
    skipWrapUp,
    togglePause,
    endSession,
  } = dialer;

  const [disposition, setDisposition] = useState("");
  const [subdisposition, setSubdisposition] = useState("");
  const [remarks, setRemarks] = useState("");
  const [nextCallDate, setNextCallDate] = useState("");

  // Reset form when lead changes
  useEffect(() => {
    if (currentLead) {
      setDisposition(currentLead.latest_disposition || "");
      setSubdisposition(currentLead.latest_subdisposition || "");
      setRemarks(currentLead.remarks || "");
      setNextCallDate(currentLead.next_call_date || "");
    } else {
      setDisposition("");
      setSubdisposition("");
      setRemarks("");
      setNextCallDate("");
    }
  }, [currentLead?.id]);

  const availableSubdispositions =
    dispositions.find((d) => d.disposition === disposition)?.subdispositions || [];

  const handleSaveAndNext = async () => {
    if (!disposition) return;
    await saveDispositionAndNext(
      disposition,
      subdisposition || null,
      remarks || null,
      nextCallDate || null,
    );
  };

  const progressPct = total > 0 ? Math.round((currentIndex / total) * 100) : 0;
  const wrapUpPct =
    wrapUpRemaining !== null ? Math.round(((WRAPUP_SECONDS - wrapUpRemaining) / WRAPUP_SECONDS) * 100) : 0;

  const handleAttemptClose = () => {
    if (isFinished || total === 0) {
      endSession();
    } else {
      setConfirmEnd(true);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleAttemptClose(); }}>
        <DialogContent className="max-w-3xl h-[88vh] flex flex-col p-0 overflow-hidden">
          {/* Header */}
          <div className="border-b px-6 py-4 bg-gradient-to-r from-primary/5 to-primary/10">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <PhoneCall className="h-5 w-5 text-primary" />
                <div>
                  <DialogTitle className="text-lg">Auto-Dialler</DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    {isFinished
                      ? `Session complete — ${total} processed`
                      : `Calling ${Math.min(currentIndex + 1, total)} of ${total}`}
                  </DialogDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Done {counts.done}</Badge>
                {counts.dnd > 0 && <Badge variant="destructive">DND {counts.dnd}</Badge>}
                {counts.skipped > 0 && <Badge variant="outline">Skipped {counts.skipped}</Badge>}
                {counts.failed > 0 && <Badge variant="destructive">Failed {counts.failed}</Badge>}
                {counts.noPhone > 0 && <Badge variant="outline">No phone {counts.noPhone}</Badge>}
              </div>
            </div>
            <Progress value={progressPct} className="mt-3 h-1.5" />
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {isFinished ? (
              <FinishedView counts={counts} total={total} onClose={endSession} />
            ) : currentLead ? (
              <>
                {/* Current contact card */}
                <Card>
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <h2 className="text-xl font-bold truncate">{currentLead.name}</h2>
                        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                          {currentLead.designation && (
                            <div>{currentLead.designation}</div>
                          )}
                          {currentLead.company_name && (
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5" />
                              {currentLead.company_name}
                            </div>
                          )}
                          {currentLead.city && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" />
                              {currentLead.city}
                            </div>
                          )}
                        </div>
                        {currentLead.latest_disposition && (
                          <div className="mt-2">
                            <Badge variant="outline" className="text-xs">
                              Last: {currentLead.latest_disposition}
                              {currentLead.latest_subdisposition && ` · ${currentLead.latest_subdisposition}`}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm text-muted-foreground">Phone</div>
                        <div className="text-lg font-mono font-semibold">{currentLead.mobile_numb || "—"}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <Button
                        size="lg"
                        onClick={handleConnectCall}
                        disabled={isCallingNow || isPaused || !currentLead.mobile_numb || !userPhone || wrapUpRemaining !== null}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        {isCallingNow ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Phone className="h-4 w-4 mr-2" />
                        )}
                        {isCallingNow ? "Connecting..." : "Connect Call"}
                      </Button>
                      <Button variant="outline" size="lg" onClick={skipLead} disabled={isPaused}>
                        <SkipForward className="h-4 w-4 mr-2" />
                        Skip
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Wrap-up timer */}
                {wrapUpRemaining !== null && (
                  <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                    <CardContent className="pt-5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Clock className="h-5 w-5 text-amber-600" />
                          <div>
                            <div className="font-semibold">Wrap-up time</div>
                            <div className="text-xs text-muted-foreground">
                              Auto-advancing in {Math.floor(wrapUpRemaining / 60)}:
                              {String(wrapUpRemaining % 60).padStart(2, "0")}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={skipWrapUp}>
                          Skip wrap-up <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </div>
                      <Progress value={wrapUpPct} className="h-1.5 mt-3" />
                    </CardContent>
                  </Card>
                )}

                {/* Disposition form */}
                {wrapUpRemaining === null && (
                  <Card>
                    <CardContent className="pt-5 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Disposition *</Label>
                          <Select
                            value={disposition}
                            onValueChange={(v) => {
                              setDisposition(v);
                              setSubdisposition("");
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select disposition" />
                            </SelectTrigger>
                            <SelectContent>
                              {dispositions.map((d) => (
                                <SelectItem key={d.disposition} value={d.disposition}>
                                  {d.disposition}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Sub-disposition</Label>
                          <Select
                            value={subdisposition}
                            onValueChange={setSubdisposition}
                            disabled={!disposition || availableSubdispositions.length === 0}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select sub-disposition" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableSubdispositions.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Remarks</Label>
                        <Textarea
                          rows={2}
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder="Notes from the call…"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Next Call Date</Label>
                        <Input
                          type="date"
                          value={nextCallDate ? nextCallDate.slice(0, 10) : ""}
                          onChange={(e) => setNextCallDate(e.target.value)}
                        />
                      </div>
                      <div className="pt-2 flex justify-end">
                        <Button onClick={handleSaveAndNext} disabled={!disposition || isPaused}>
                          Save & Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </div>

          {/* Footer */}
          {!isFinished && (
            <div className="border-t px-6 py-3 flex items-center justify-between bg-muted/30">
              <Button variant="ghost" size="sm" onClick={togglePause}>
                {isPaused ? (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </>
                )}
              </Button>
              <Button variant="destructive" size="sm" onClick={handleAttemptClose}>
                <X className="h-4 w-4 mr-2" />
                End Session
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* End-session confirmation */}
      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End auto-dialler session?</AlertDialogTitle>
            <AlertDialogDescription>
              You have {total - currentIndex} contact{total - currentIndex === 1 ? "" : "s"} remaining.
              Saved dispositions stay saved. Unsaved progress on the current contact will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep going</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmEnd(false);
                endSession();
              }}
            >
              End Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function FinishedView({
  counts,
  total,
  onClose,
}: {
  counts: { done: number; skipped: number; dnd: number; failed: number; noPhone: number };
  total: number;
  onClose: () => void;
}) {
  return (
    <div className="text-center py-8 space-y-4">
      <CheckCircle2 className="h-14 w-14 mx-auto text-emerald-500" />
      <div>
        <h2 className="text-2xl font-bold">All Done</h2>
        <p className="text-muted-foreground mt-1">
          Processed {total} contact{total === 1 ? "" : "s"}.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 max-w-2xl mx-auto">
        <SummaryStat label="Completed" value={counts.done} />
        <SummaryStat label="DND" value={counts.dnd} />
        <SummaryStat label="Skipped" value={counts.skipped} />
        <SummaryStat label="Failed" value={counts.failed} />
        <SummaryStat label="No phone" value={counts.noPhone} />
      </div>
      <Button onClick={onClose} size="lg">
        Close
      </Button>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
