import { useInventoryStats } from "@/hooks/useInventoryStats";
import { useInventoryAllocations } from "@/hooks/useInventoryAllocation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  PackageCheck, 
  PackageX, 
  AlertTriangle,
  XCircle,
  LayoutDashboard,
  UserPlus,
  PackageMinus
} from "lucide-react";
import { format, isPast, parseISO, isWithinInterval, addDays } from "date-fns";
import { useNavigate } from "react-router-dom";

export default function InventoryDashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useInventoryStats();
  const { data: allocations } = useInventoryAllocations('active');

  const upcomingReturns = allocations?.filter(a => {
    if (!a.expected_return_date) return false;
    const dueDate = parseISO(a.expected_return_date);
    return isWithinInterval(dueDate, {
      start: new Date(),
      end: addDays(new Date(), 7)
    });
  }) || [];

  const overdueReturns = allocations?.filter(a => {
    if (!a.expected_return_date) return false;
    return isPast(parseISO(a.expected_return_date));
  }) || [];

  const recentAllocations = allocations?.slice(0, 5) || [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <LayoutDashboard className="h-8 w-8" />
            Inventory Dashboard
          </h1>
          <p className="text-muted-foreground">
            Overview of your IT inventory allocation
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inventory</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : stats?.total_inventory || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <PackageCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {statsLoading ? "..." : stats?.available_count || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Allocated</CardTitle>
            <UserPlus className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {statsLoading ? "..." : stats?.allocated_count || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Damaged</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {statsLoading ? "..." : stats?.damaged_count || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retired</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {statsLoading ? "..." : stats?.retired_count || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button onClick={() => navigate('/inventory-allocation')}>
            <UserPlus className="h-4 w-4 mr-2" />
            Allocate Item
          </Button>
          <Button variant="outline" onClick={() => navigate('/inventory-returns')}>
            <PackageMinus className="h-4 w-4 mr-2" />
            Process Return
          </Button>
          <Button variant="outline" onClick={() => navigate('/inventory-reports')}>
            <PackageX className="h-4 w-4 mr-2" />
            View Reports
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Overdue Returns */}
        {overdueReturns.length > 0 && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Overdue Returns ({overdueReturns.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {overdueReturns.map((allocation) => (
                <div key={allocation.id} className="flex justify-between items-center p-2 bg-red-50 rounded">
                  <div>
                    <p className="font-medium">{allocation.inventory_item?.items}</p>
                    <p className="text-sm text-muted-foreground">
                      {allocation.user?.full_name || allocation.user?.email}
                    </p>
                  </div>
                  <Badge variant="destructive">
                    Due: {allocation.expected_return_date && format(parseISO(allocation.expected_return_date), "MMM dd")}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Upcoming Returns */}
        {upcomingReturns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Upcoming Returns (Next 7 Days)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcomingReturns.map((allocation) => (
                <div key={allocation.id} className="flex justify-between items-center p-2 bg-muted rounded">
                  <div>
                    <p className="font-medium">{allocation.inventory_item?.items}</p>
                    <p className="text-sm text-muted-foreground">
                      {allocation.user?.full_name || allocation.user?.email}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {allocation.expected_return_date && format(parseISO(allocation.expected_return_date), "MMM dd")}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Allocations */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Allocations</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAllocations.length > 0 ? (
            <div className="space-y-2">
              {recentAllocations.map((allocation) => (
                <div key={allocation.id} className="flex justify-between items-center p-2 border-b last:border-0">
                  <div className="flex-1">
                    <p className="font-medium">{allocation.inventory_item?.items}</p>
                    <p className="text-sm text-muted-foreground">
                      {allocation.user?.full_name || allocation.user?.email}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{format(new Date(allocation.allocation_date), "MMM dd, yyyy")}</p>
                    <Badge variant="outline">{allocation.allocated_condition}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">No recent allocations</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
