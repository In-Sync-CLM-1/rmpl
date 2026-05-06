import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AutoDialerLead {
  id: string;
  name: string;
  mobile_numb: string | null;
  company_name?: string | null;
  designation?: string | null;
  city?: string | null;
  latest_disposition?: string | null;
  latest_subdisposition?: string | null;
  next_call_date?: string | null;
  remarks?: string | null;
}

export type LeadStatus =
  | "pending"
  | "calling"
  | "wrap-up"
  | "done"
  | "skipped"
  | "dnd"
  | "failed"
  | "no-phone";

export interface LeadOutcome {
  status: LeadStatus;
  disposition?: string | null;
  subdisposition?: string | null;
  remarks?: string | null;
  error?: string | null;
}

export const WRAPUP_SECONDS = 120;

// Dispositions that indicate no real conversation happened — skip the wrap-up.
export const NO_WRAPUP_DISPOSITIONS = new Set<string>([
  "DND",
  "NR ( No Response )",
  "NR 1",
  "NR 2",
  "NR 3",
  "NR 4",
  "Wrong Number",
  "Company Closed",
  "Deceased",
  "Duplicate",
  "IVC (invalid criteria)",
  "CPNF",
]);

export function shouldWrapUp(disposition: string | null | undefined): boolean {
  if (!disposition) return true; // no disposition picked → safe default: wrap up
  return !NO_WRAPUP_DISPOSITIONS.has(disposition);
}

interface UseAutoDialerOptions {
  leads: AutoDialerLead[];
  userPhone: string | null;
  onClose: () => void;
}

export function useAutoDialer({ leads, userPhone, onClose }: UseAutoDialerOptions) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Record<string, LeadOutcome>>({});
  const [isCallingNow, setIsCallingNow] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [wrapUpRemaining, setWrapUpRemaining] = useState<number | null>(null);
  const wrapUpTimer = useRef<number | null>(null);

  const total = leads.length;
  const currentLead = leads[currentIndex] ?? null;
  const isFinished = currentIndex >= total;

  const counts = useMemo(() => {
    const c = { done: 0, skipped: 0, dnd: 0, failed: 0, noPhone: 0 };
    for (const id of Object.keys(outcomes)) {
      const o = outcomes[id];
      if (o.status === "done") c.done++;
      else if (o.status === "skipped") c.skipped++;
      else if (o.status === "dnd") c.dnd++;
      else if (o.status === "failed") c.failed++;
      else if (o.status === "no-phone") c.noPhone++;
    }
    return c;
  }, [outcomes]);

  const clearWrapUp = useCallback(() => {
    if (wrapUpTimer.current !== null) {
      window.clearInterval(wrapUpTimer.current);
      wrapUpTimer.current = null;
    }
    setWrapUpRemaining(null);
  }, []);

  const advance = useCallback(() => {
    clearWrapUp();
    setCurrentIndex((i) => i + 1);
  }, [clearWrapUp]);

  const startWrapUp = useCallback(() => {
    clearWrapUp();
    setWrapUpRemaining(WRAPUP_SECONDS);
    wrapUpTimer.current = window.setInterval(() => {
      setWrapUpRemaining((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (wrapUpTimer.current !== null) {
            window.clearInterval(wrapUpTimer.current);
            wrapUpTimer.current = null;
          }
          // Defer advance to next tick to avoid setState during render
          setTimeout(() => setCurrentIndex((i) => i + 1), 0);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearWrapUp]);

  // Pause/resume the wrap-up timer
  useEffect(() => {
    if (!isPaused) return;
    if (wrapUpTimer.current !== null) {
      window.clearInterval(wrapUpTimer.current);
      wrapUpTimer.current = null;
    }
  }, [isPaused]);

  const resumeWrapUp = useCallback(() => {
    if (wrapUpRemaining === null || wrapUpRemaining <= 0) return;
    if (wrapUpTimer.current !== null) return;
    wrapUpTimer.current = window.setInterval(() => {
      setWrapUpRemaining((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (wrapUpTimer.current !== null) {
            window.clearInterval(wrapUpTimer.current);
            wrapUpTimer.current = null;
          }
          setTimeout(() => setCurrentIndex((i) => i + 1), 0);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [wrapUpRemaining]);

  const togglePause = useCallback(() => {
    setIsPaused((p) => {
      const next = !p;
      if (!next && wrapUpRemaining !== null && wrapUpRemaining > 0) {
        // Resume the timer
        setTimeout(resumeWrapUp, 0);
      }
      return next;
    });
  }, [wrapUpRemaining, resumeWrapUp]);

  // Auto-skip leads with no phone
  useEffect(() => {
    if (isFinished || !currentLead || isPaused) return;
    if (!currentLead.mobile_numb) {
      setOutcomes((o) => ({
        ...o,
        [currentLead.id]: { status: "no-phone", error: "No phone number on file" },
      }));
      const t = window.setTimeout(() => setCurrentIndex((i) => i + 1), 600);
      return () => window.clearTimeout(t);
    }
  }, [currentLead, isFinished, isPaused]);

  const handleConnectCall = useCallback(async () => {
    if (!currentLead || !currentLead.mobile_numb || !userPhone) {
      toast.error("Missing phone number");
      return;
    }
    setIsCallingNow(true);
    try {
      const { data, error } = await supabase.functions.invoke("exotel-make-call", {
        body: {
          from_number: userPhone,
          to_number: currentLead.mobile_numb,
          demandcom_id: currentLead.id,
        },
      });

      if (error) {
        toast.error("Failed to initiate call");
        setOutcomes((o) => ({
          ...o,
          [currentLead.id]: { status: "failed", error: error.message },
        }));
        return;
      }

      if (data?.dnd) {
        // Auto-mark as DND, no wrap-up
        await supabase
          .from("demandcom")
          .update({
            latest_disposition: "DND",
            latest_subdisposition: "DND - Exotel Reported",
          })
          .eq("id", currentLead.id);

        setOutcomes((o) => ({
          ...o,
          [currentLead.id]: {
            status: "dnd",
            disposition: "DND",
            subdisposition: "DND - Exotel Reported",
          },
        }));
        toast.info(`${currentLead.name} marked DND — moving on`);
        setTimeout(advance, 600);
        return;
      }

      if (data && !data.success) {
        toast.error(data.error || "Call failed");
        setOutcomes((o) => ({
          ...o,
          [currentLead.id]: { status: "failed", error: data.error },
        }));
        return;
      }

      toast.success("Call connecting — pick up your phone");
    } catch (err: any) {
      toast.error("Call error: " + (err?.message || "unknown"));
      setOutcomes((o) => ({
        ...o,
        [currentLead.id]: { status: "failed", error: err?.message },
      }));
    } finally {
      setIsCallingNow(false);
    }
  }, [currentLead, userPhone, advance]);

  const saveDispositionAndNext = useCallback(
    async (disposition: string, subdisposition: string | null, remarks: string | null, nextCallDate: string | null) => {
      if (!currentLead) return;
      const update: any = {
        latest_disposition: disposition,
        latest_subdisposition: subdisposition,
      };
      if (remarks !== null) update.remarks = remarks;
      if (nextCallDate !== null) update.next_call_date = nextCallDate;

      const { error } = await supabase.from("demandcom").update(update).eq("id", currentLead.id);
      if (error) {
        toast.error("Failed to save: " + error.message);
        return;
      }

      setOutcomes((o) => ({
        ...o,
        [currentLead.id]: {
          status: "done",
          disposition,
          subdisposition,
          remarks,
        },
      }));

      if (shouldWrapUp(disposition)) {
        startWrapUp();
      } else {
        setTimeout(advance, 400);
      }
    },
    [currentLead, advance, startWrapUp]
  );

  const skipLead = useCallback(() => {
    if (!currentLead) return;
    setOutcomes((o) => ({
      ...o,
      [currentLead.id]: { status: "skipped" },
    }));
    advance();
  }, [currentLead, advance]);

  const skipWrapUp = useCallback(() => {
    if (wrapUpRemaining === null) return;
    advance();
  }, [wrapUpRemaining, advance]);

  const endSession = useCallback(() => {
    clearWrapUp();
    onClose();
  }, [clearWrapUp, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wrapUpTimer.current !== null) {
        window.clearInterval(wrapUpTimer.current);
      }
    };
  }, []);

  return {
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
  };
}
