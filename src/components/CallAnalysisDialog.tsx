import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  Loader2,
  Star,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertCircle,
  Target,
  ArrowRight,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CallAnalysis {
  status: string;
  overall_score?: number;
  sentiment?: string;
  call_summary?: string;
  strengths?: string[];
  improvement_areas?: string[];
  key_topics?: string[];
  customer_interest_level?: string;
  next_steps?: string;
  error?: string;
  analyzed_at?: string;
}

interface CallAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callLogId: string;
  recordingUrl: string | null;
  existingTranscript?: string | null;
  existingAnalysis?: CallAnalysis | null;
}

const sentimentConfig: Record<string, { color: string; label: string }> = {
  positive: { color: "bg-green-100 text-green-700", label: "Positive" },
  neutral: { color: "bg-yellow-100 text-yellow-700", label: "Neutral" },
  negative: { color: "bg-red-100 text-red-700", label: "Negative" },
};

const interestConfig: Record<string, { color: string; label: string }> = {
  high: { color: "bg-green-100 text-green-700", label: "High Interest" },
  medium: { color: "bg-yellow-100 text-yellow-700", label: "Medium Interest" },
  low: { color: "bg-red-100 text-red-700", label: "Low Interest" },
  not_applicable: { color: "bg-gray-100 text-gray-700", label: "N/A" },
};

export function CallAnalysisDialog({
  open,
  onOpenChange,
  callLogId,
  recordingUrl,
  existingTranscript,
  existingAnalysis,
}: CallAnalysisDialogProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(existingTranscript || null);
  const [analysis, setAnalysis] = useState<CallAnalysis | null>(existingAnalysis || null);
  const [showTranscript, setShowTranscript] = useState(false);

  const handleAnalyze = async () => {
    if (!recordingUrl) {
      toast.error("No recording available for this call");
      return;
    }

    setIsAnalyzing(true);
    setAnalysis({ status: "processing" });

    try {
      const { data, error } = await supabase.functions.invoke("analyze-call-recording", {
        body: { callLogId },
      });

      if (error) throw error;

      if (data.transcript) setTranscript(data.transcript);
      if (data.analysis) {
        setAnalysis(data.analysis);
      } else {
        setAnalysis({ status: "completed", error: data.message || "No analysis available" });
      }

      toast.success("Call analysis complete");
    } catch (err: any) {
      console.error("Analysis error:", err);
      toast.error("Analysis failed: " + (err.message || "Unknown error"));
      setAnalysis(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 8) return "text-green-600";
    if (score >= 5) return "text-yellow-600";
    return "text-red-600";
  };

  const hasAnalysis = analysis && analysis.status === "completed" && !analysis.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-500" />
            AI Call Analysis
          </DialogTitle>
        </DialogHeader>

        {!hasAnalysis && !isAnalyzing && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <Brain className="h-16 w-16 text-muted-foreground" />
            {analysis?.error ? (
              <>
                <p className="text-sm text-muted-foreground text-center">{analysis.error}</p>
                <Button onClick={handleAnalyze} disabled={!recordingUrl}>
                  <Brain className="h-4 w-4 mr-2" />
                  Retry Analysis
                </Button>
              </>
            ) : existingAnalysis && existingAnalysis.status === "completed" ? (
              <p className="text-sm text-muted-foreground">Analysis data loaded.</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  AI will transcribe the recording and analyze call quality,
                  <br />
                  providing scores, strengths, and improvement suggestions.
                </p>
                <Button onClick={handleAnalyze} disabled={!recordingUrl} size="lg">
                  <Brain className="h-4 w-4 mr-2" />
                  Analyze Call
                </Button>
                {!recordingUrl && (
                  <p className="text-xs text-destructive">No recording available for this call</p>
                )}
              </>
            )}
          </div>
        )}

        {isAnalyzing && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-violet-500" />
            <p className="text-sm font-medium">Analyzing call recording...</p>
            <p className="text-xs text-muted-foreground">
              Transcribing audio and evaluating call quality
            </p>
            <Progress value={undefined} className="w-64 h-2" />
          </div>
        )}

        {hasAnalysis && (
          <div className="space-y-5">
            {/* Score + Sentiment Header */}
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <div className={`text-3xl font-bold ${scoreColor(analysis.overall_score!)}`}>
                  {analysis.overall_score}
                  <span className="text-sm font-normal text-muted-foreground">/10</span>
                </div>
                <p className="text-xs text-muted-foreground">Quality Score</p>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  {analysis.sentiment && (
                    <Badge className={sentimentConfig[analysis.sentiment]?.color || ""}>
                      {sentimentConfig[analysis.sentiment]?.label || analysis.sentiment}
                    </Badge>
                  )}
                  {analysis.customer_interest_level && (
                    <Badge className={interestConfig[analysis.customer_interest_level]?.color || ""}>
                      <Target className="h-3 w-3 mr-1" />
                      {interestConfig[analysis.customer_interest_level]?.label || analysis.customer_interest_level}
                    </Badge>
                  )}
                </div>
                <Progress value={(analysis.overall_score! / 10) * 100} className="h-2" />
              </div>
            </div>

            {/* Call Summary */}
            {analysis.call_summary && (
              <div>
                <h4 className="text-sm font-medium flex items-center gap-1.5 mb-1.5">
                  <FileText className="h-4 w-4" /> Summary
                </h4>
                <p className="text-sm text-muted-foreground bg-muted rounded-lg p-3">
                  {analysis.call_summary}
                </p>
              </div>
            )}

            {/* Key Topics */}
            {analysis.key_topics && analysis.key_topics.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-1.5">Key Topics</h4>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.key_topics.map((topic, i) => (
                    <Badge key={i} variant="secondary">{topic}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Strengths */}
            {analysis.strengths && analysis.strengths.length > 0 && (
              <div>
                <h4 className="text-sm font-medium flex items-center gap-1.5 mb-1.5 text-green-700">
                  <TrendingUp className="h-4 w-4" /> Strengths
                </h4>
                <ul className="space-y-1.5">
                  {analysis.strengths.map((s, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Improvement Areas */}
            {analysis.improvement_areas && analysis.improvement_areas.length > 0 && (
              <div>
                <h4 className="text-sm font-medium flex items-center gap-1.5 mb-1.5 text-amber-700">
                  <TrendingDown className="h-4 w-4" /> Areas for Improvement
                </h4>
                <ul className="space-y-1.5">
                  {analysis.improvement_areas.map((a, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next Steps */}
            {analysis.next_steps && (
              <div>
                <h4 className="text-sm font-medium flex items-center gap-1.5 mb-1.5">
                  <ArrowRight className="h-4 w-4" /> Recommended Next Steps
                </h4>
                <p className="text-sm text-muted-foreground bg-blue-50 rounded-lg p-3 border border-blue-100">
                  {analysis.next_steps}
                </p>
              </div>
            )}

            {/* Transcript Toggle */}
            {transcript && (
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTranscript(!showTranscript)}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  {showTranscript ? "Hide" : "Show"} Transcript
                </Button>
                {showTranscript && (
                  <pre className="mt-2 text-xs text-muted-foreground bg-muted rounded-lg p-3 whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {transcript}
                  </pre>
                )}
              </div>
            )}

            {/* Re-analyze */}
            <div className="flex justify-between items-center pt-2 border-t">
              {analysis.analyzed_at && (
                <p className="text-xs text-muted-foreground">
                  Analyzed: {new Date(analysis.analyzed_at).toLocaleString()}
                </p>
              )}
              <Button variant="outline" size="sm" onClick={handleAnalyze}>
                <Brain className="h-4 w-4 mr-1" />
                Re-analyze
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
