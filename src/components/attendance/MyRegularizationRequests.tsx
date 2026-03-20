import { format, parseISO } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Clock, CheckCircle, XCircle, FileEdit, User } from "lucide-react";
import { useAttendanceRegularization, AttendanceRegularization } from "@/hooks/useAttendanceRegularization";
import { formatTimeShortIST } from "@/lib/dateUtils";

const REGULARIZATION_TYPE_LABELS: Record<string, string> = {
  forgot_signin: 'Forgot Sign In',
  forgot_signout: 'Forgot Sign Out',
  time_correction: 'Time Correction',
  location_issue: 'Location Issue',
  other: 'Other',
};

const STATUS_CONFIG: Record<string, { variant: "default" | "secondary" | "destructive"; icon: any }> = {
  pending: { variant: "secondary", icon: Clock },
  approved: { variant: "default", icon: CheckCircle },
  rejected: { variant: "destructive", icon: XCircle },
};

interface MyRegularizationRequestsProps {
  showTitle?: boolean;
}

export function MyRegularizationRequests({ showTitle = true }: MyRegularizationRequestsProps) {
  const { myRegularizations, loadingMyRegularizations, deleteRegularization, managerInfo } = useAttendanceRegularization();

  if (loadingMyRegularizations) {
    return <div className="text-center py-4 text-muted-foreground">Loading...</div>;
  }

  if (!myRegularizations?.length) {
    return null;
  }

  // Format time in IST from stored TIMESTAMPTZ
  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return null;
    try {
      return formatTimeShortIST(timeStr);
    } catch {
      return null;
    }
  };

  return (
    <Card>
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileEdit className="h-5 w-5" />
            My Regularization Requests
          </CardTitle>
          <CardDescription>Track the status of your submitted requests</CardDescription>
        </CardHeader>
      )}
      <CardContent className={showTitle ? "" : "pt-6"}>
        {managerInfo && (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Approval by:</span>
            <span className="font-medium">{managerInfo.full_name || managerInfo.email}</span>
          </div>
        )}
        <div className="space-y-3">
          {myRegularizations.map((request) => {
            const statusConfig = STATUS_CONFIG[request.status];
            const StatusIcon = statusConfig.icon;
            const signInTime = formatTime(request.requested_sign_in_time);
            const signOutTime = formatTime(request.requested_sign_out_time);
            
            // Determine which times to show based on regularization type
            const showSignIn = ['forgot_signin', 'time_correction', 'location_issue', 'other'].includes(request.regularization_type);
            const showSignOut = ['forgot_signout', 'time_correction', 'location_issue', 'other'].includes(request.regularization_type);
            
            return (
              <div 
                key={request.id} 
                className="flex items-start justify-between p-3 border rounded-lg"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {format(parseISO(request.attendance_date), "EEE, MMM d, yyyy")}
                    </span>
                    <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {request.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {REGULARIZATION_TYPE_LABELS[request.regularization_type]}
                  </div>
                  <div className="text-sm">
                    {showSignIn && signInTime && (
                      <span className="mr-4">In: {signInTime}</span>
                    )}
                    {showSignOut && signOutTime && (
                      <span>Out: {signOutTime}</span>
                    )}
                    {((!showSignIn || !signInTime) && (!showSignOut || !signOutTime)) && (
                      <span className="text-muted-foreground">No time specified</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{request.reason}</p>
                  {request.status === 'rejected' && request.rejection_reason && (
                    <p className="text-xs text-destructive mt-1">
                      Rejection reason: {request.rejection_reason}
                    </p>
                  )}
                </div>
                {request.status === 'pending' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteRegularization.mutate(request.id)}
                    disabled={deleteRegularization.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
