import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";

const LOGO_URL = "https://redefine.in/assets/img/logo.png";
const SUPABASE_URL = "https://ltlvhmwrrsromwuiybwu.supabase.co";

const ERROR_MESSAGES: Record<string, { title: string; message: string }> = {
  invalid_link: { title: "Invalid Link", message: "This approval link is invalid or malformed. Please check your email or log in to RMPL OPM." },
  expired: { title: "Link Expired", message: "This approval link has expired (72-hour limit). Please log in to RMPL OPM to take action." },
  already_processed: { title: "Already Processed", message: "This request has already been processed. No further action is needed." },
  not_found: { title: "Request Not Found", message: "The original request could not be found. It may have been deleted." },
  failed: { title: "Action Failed", message: "Something went wrong while processing your action. Please try again or log in to RMPL OPM." },
};

function Header() {
  return (
    <CardHeader className="p-0">
      <div className="bg-gradient-to-r from-[#1e3a5f] to-[#0d2137] py-6 px-8 text-center rounded-t-lg">
        <img src={LOGO_URL} alt="RMPL" className="h-10 mx-auto" />
      </div>
    </CardHeader>
  );
}

function Footer() {
  return (
    <CardFooter className="bg-gray-50 border-t py-4 flex justify-center rounded-b-lg">
      <p className="text-xs text-muted-foreground">
        <strong>RMPL OPM</strong> &mdash; Operations &amp; Project Management
      </p>
    </CardFooter>
  );
}

export default function ApprovalResult() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");
  const error = searchParams.get("error");
  const action = searchParams.get("action");
  const token = searchParams.get("token");
  const name = searchParams.get("name");
  const type = searchParams.get("type");

  const [rejectionReason, setRejectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ status: string; name: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const typeLabel = type === "leave" ? "leave application" : "attendance regularization";

  // Rejection form
  if (action === "reject" && token && !submitResult) {
    const handleReject = async () => {
      if (!rejectionReason.trim()) {
        setSubmitError("Please enter a reason for rejection.");
        return;
      }
      setSubmitting(true);
      setSubmitError(null);
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/handle-approval`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, action: "reject", reason: rejectionReason.trim() }),
        });
        const data = await res.json();
        if (data.success) {
          setSubmitResult({ status: "rejected", name: data.name || "the employee" });
        } else {
          setSubmitError(data.error || "Failed to process rejection.");
        }
      } catch {
        setSubmitError("An error occurred. Please try again.");
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <Header />
          <CardContent className="pt-8 pb-6 px-8">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-red-600 text-center mb-2">Reject Request</h2>
            <p className="text-muted-foreground text-sm text-center mb-6">
              Please provide a reason for rejection. This will be shared with the employee.
            </p>
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700">
                Reason for Rejection <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                rows={4}
              />
              {submitError && <p className="text-sm text-red-500">{submitError}</p>}
              <Button
                variant="destructive"
                className="w-full"
                disabled={submitting}
                onClick={handleReject}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                ) : (
                  "Confirm Rejection"
                )}
              </Button>
            </div>
          </CardContent>
          <Footer />
        </Card>
      </div>
    );
  }

  // Show result (from redirect or after rejection submission)
  const displayStatus = submitResult?.status || status;
  const displayName = submitResult?.name || name;
  const displayType = submitResult ? typeLabel : (type === "leave" ? "leave application" : "attendance regularization");

  // Error page
  if (error) {
    const errorInfo = ERROR_MESSAGES[error] || { title: "Error", message: "An unexpected error occurred." };
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <Header />
          <CardContent className="pt-8 pb-6 px-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-amber-600" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-amber-600 mb-2">{errorInfo.title}</h2>
            <p className="text-muted-foreground text-sm">{errorInfo.message}</p>
            <p className="text-xs text-muted-foreground mt-4">
              You can log in to <strong>RMPL OPM</strong> to take action.
            </p>
          </CardContent>
          <Footer />
        </Card>
      </div>
    );
  }

  // Success page (approved or rejected)
  if (displayStatus === "approved" || displayStatus === "rejected") {
    const isApproved = displayStatus === "approved";
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <Header />
          <CardContent className="pt-8 pb-6 px-8 text-center">
            <div className="flex justify-center mb-4">
              <div className={`w-16 h-16 rounded-full ${isApproved ? "bg-green-100" : "bg-red-100"} flex items-center justify-center`}>
                {isApproved ? (
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-600" />
                )}
              </div>
            </div>
            <h2 className={`text-xl font-bold ${isApproved ? "text-green-600" : "text-red-600"} mb-2`}>
              Request {isApproved ? "Approved" : "Rejected"}
            </h2>
            <p className="text-muted-foreground text-sm">
              You have successfully {isApproved ? "approved" : "rejected"} the {displayType} for{" "}
              <strong>{displayName || "the employee"}</strong>. They will be notified via email.
            </p>
          </CardContent>
          <Footer />
        </Card>
      </div>
    );
  }

  // Fallback / loading
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg text-center p-8">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        <p className="text-muted-foreground text-sm mt-2">Loading...</p>
      </Card>
    </div>
  );
}
