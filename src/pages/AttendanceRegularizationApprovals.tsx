import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Clock, FileEdit } from "lucide-react";
import { useAttendanceRegularization, RegularizationWithProfile } from "@/hooks/useAttendanceRegularization";

const REGULARIZATION_TYPE_LABELS: Record<string, string> = {
  forgot_signin: 'Forgot Sign In',
  forgot_signout: 'Forgot Sign Out',
  time_correction: 'Time Correction',
  location_issue: 'Location Issue',
  other: 'Other',
};

export default function AttendanceRegularizationApprovals() {
  const { 
    pendingRegularizations, 
    loadingPending, 
    canApprove,
    approveRegularization,
    rejectRegularization,
  } = useAttendanceRegularization();
  
  const [selectedRequest, setSelectedRequest] = useState<RegularizationWithProfile | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return "N/A";
    try {
      return format(parseISO(timeStr), "HH:mm");
    } catch {
      return "N/A";
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    await rejectRegularization.mutateAsync({
      regularizationId: selectedRequest.id,
      reason: rejectionReason,
    });
    setSelectedRequest(null);
    setRejectionReason("");
  };

  if (!canApprove) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              You don't have permission to approve regularization requests. 
              Only reporting managers can approve their team members' requests.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Regularization Approvals</h1>
          <p className="text-muted-foreground">Review and approve pending attendance regularization requests</p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          <Clock className="mr-2 h-4 w-4" />
          {pendingRegularizations?.length || 0} Pending
        </Badge>
      </div>

      {loadingPending ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pendingRegularizations?.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {request.profile?.full_name || "Unknown User"}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{request.profile?.email}</p>
                  </div>
                  <Badge variant="secondary">
                    <FileEdit className="mr-1 h-3 w-3" />
                    {REGULARIZATION_TYPE_LABELS[request.regularization_type]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Date:</span>
                    <span className="font-semibold">
                      {format(parseISO(request.attendance_date), "EEEE, MMM d, yyyy")}
                    </span>
                  </div>
                  
                  {request.original_sign_in_time && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Original Sign In:</span>
                      <span>{formatTime(request.original_sign_in_time)}</span>
                    </div>
                  )}
                  
                  {request.original_sign_out_time && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Original Sign Out:</span>
                      <span>{formatTime(request.original_sign_out_time)}</span>
                    </div>
                  )}
                  
                  {request.requested_sign_in_time && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Requested Sign In:</span>
                      <span className="font-semibold text-primary">{formatTime(request.requested_sign_in_time)}</span>
                    </div>
                  )}
                  
                  {request.requested_sign_out_time && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Requested Sign Out:</span>
                      <span className="font-semibold text-primary">{formatTime(request.requested_sign_out_time)}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Submitted:</span>
                    <span>{format(parseISO(request.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label className="text-sm text-muted-foreground">Reason:</Label>
                  <p className="mt-1">{request.reason}</p>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => approveRegularization.mutate(request.id)}
                    disabled={approveRegularization.isPending}
                    className="flex-1"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setSelectedRequest(request)}
                    className="flex-1"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {!pendingRegularizations?.length && (
            <Card>
              <CardContent className="p-12 text-center">
                <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Pending Requests</h3>
                <p className="text-muted-foreground">
                  There are no pending regularization requests awaiting your approval
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Regularization Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason for Rejection</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                className="mt-2"
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedRequest(null);
                  setRejectionReason("");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectionReason || rejectRegularization.isPending}
                className="flex-1"
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
