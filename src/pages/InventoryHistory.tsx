import { useInventoryAudit } from "@/hooks/useInventoryAudit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, Package, UserPlus, UserMinus, AlertTriangle, Wrench } from "lucide-react";
import { format } from "date-fns";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const actionIcons = {
  allocated: UserPlus,
  deallocated: UserMinus,
  status_changed: Package,
  condition_changed: AlertTriangle,
  repaired: Wrench,
};

const actionColors = {
  allocated: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  deallocated: "bg-green-500/10 text-green-600 border-green-500/20",
  status_changed: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  condition_changed: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  repaired: "bg-green-500/10 text-green-600 border-green-500/20",
};

export default function InventoryHistory() {
  const { data: auditLogs, isLoading } = useInventoryAudit();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <History className="h-8 w-8" />
            Audit History
          </h1>
          <p className="text-muted-foreground">
            Complete audit trail of all inventory changes
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : auditLogs && auditLogs.length > 0 ? (
            <div className="space-y-4">
              {auditLogs.map((log) => {
                const Icon = actionIcons[log.action as keyof typeof actionIcons] || Package;
                const colorClass = actionColors[log.action as keyof typeof actionColors] || "bg-gray-500/10 text-gray-600 border-gray-500/20";

                return (
                  <div key={log.id} className="flex gap-4 p-4 border rounded-lg">
                    <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${colorClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className={colorClass}>
                          {log.action.replace('_', ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.timestamp), "MMM dd, yyyy HH:mm")}
                        </span>
                      </div>

                      {log.action === 'allocated' && log.user && (
                        <p className="text-sm">
                          Allocated to <strong>{log.user.full_name || 'User'}</strong>
                        </p>
                      )}

                      {log.action === 'deallocated' && log.user && (
                        <p className="text-sm">
                          Returned by <strong>{log.user.full_name || 'User'}</strong>
                        </p>
                      )}

                      {log.action === 'status_changed' && (
                        <p className="text-sm">
                          Status changed from <strong>{log.old_status}</strong> to <strong>{log.new_status}</strong>
                        </p>
                      )}

                      {log.action === 'condition_changed' && (
                        <p className="text-sm">
                          Condition changed from <strong>{log.old_condition}</strong> to <strong>{log.new_condition}</strong>
                        </p>
                      )}

                      {log.notes && (
                        <p className="text-sm text-muted-foreground italic">{log.notes}</p>
                      )}

                      {log.changed_by_profile && (
                        <p className="text-xs text-muted-foreground">
                          By {log.changed_by_profile.full_name}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No audit history available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
