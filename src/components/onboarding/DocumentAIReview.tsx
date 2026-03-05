import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, XCircle, Shield } from "lucide-react";

interface Finding {
  category: string;
  severity: "low" | "medium" | "high";
  description: string;
}

interface AIAnalysis {
  risk_score: number;
  findings: Finding[];
  recommendation: "approve" | "review" | "reject";
  summary: string;
}

interface DocumentAIReviewProps {
  analysis: AIAnalysis | null;
}

export function DocumentAIReview({ analysis }: DocumentAIReviewProps) {
  if (!analysis) return null;

  const getRiskColor = (score: number) => {
    if (score <= 30) return "text-green-600";
    if (score <= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getRiskBg = (score: number) => {
    if (score <= 30) return "bg-green-100";
    if (score <= 60) return "bg-yellow-100";
    return "bg-red-100";
  };

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case "approve": return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Approve</Badge>;
      case "review": return <Badge className="bg-yellow-100 text-yellow-800"><AlertTriangle className="h-3 w-3 mr-1" />Needs Review</Badge>;
      case "reject": return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Reject</Badge>;
      default: return null;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "low": return "border-green-200 bg-green-50";
      case "medium": return "border-yellow-200 bg-yellow-50";
      case "high": return "border-red-200 bg-red-50";
      default: return "";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4" />
          AI Document Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`${getRiskBg(analysis.risk_score)} rounded-full w-12 h-12 flex items-center justify-center`}>
              <span className={`text-lg font-bold ${getRiskColor(analysis.risk_score)}`}>{analysis.risk_score}</span>
            </div>
            <div>
              <p className="text-sm font-medium">Risk Score</p>
              <p className="text-xs text-muted-foreground">out of 100</p>
            </div>
          </div>
          {getRecommendationBadge(analysis.recommendation)}
        </div>

        <p className="text-sm text-muted-foreground">{analysis.summary}</p>

        {analysis.findings.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Findings</p>
            {analysis.findings.map((finding, i) => (
              <div key={i} className={`border rounded-md p-3 ${getSeverityColor(finding.severity)}`}>
                <div className="flex justify-between items-start">
                  <span className="text-sm font-medium">{finding.category}</span>
                  <Badge variant="outline" className="text-xs capitalize">{finding.severity}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{finding.description}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
