import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useOperationsInventoryDashboard } from "@/hooks/useOperationsInventoryDashboard";
import { Package, TrendingUp, MapPin, BarChart3, AlertTriangle } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

function OperationsInventoryDashboard() {
  const { inventoryStats, distributionStats, valueByItem, isLoading } = useOperationsInventoryDashboard();

  if (isLoading) {
    return (
      <div className="w-full px-6 py-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map(i => <Skeleton key={i} className="h-96" />)}
        </div>
      </div>
    );
  }

  const statusData = [
    { name: "Available", value: inventoryStats?.available || 0, color: "#00C49F" },
    { name: "Allocated", value: inventoryStats?.allocated || 0, color: "#0088FE" },
    { name: "Damaged", value: inventoryStats?.damaged || 0, color: "#FF8042" },
    { name: "Retired", value: inventoryStats?.retired || 0, color: "#FFBB28" },
  ].filter(item => item.value > 0);

  const usageData = [
    { name: "Dispatched", value: distributionStats?.totalDispatched || 0 },
    { name: "Used", value: distributionStats?.totalUsage || 0 },
    { name: "Damaged/Lost", value: distributionStats?.totalDamaged || 0 },
    { name: "Balance", value: distributionStats?.totalBalance || 0 },
  ];

  return (
    <div className="w-full px-6 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Package className="h-8 w-8" />
        <h1 className="text-3xl font-bold">Operations Inventory Dashboard</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inventoryStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              Operations category
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{(inventoryStats?.totalValue || 0).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground">
              Investment value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inventoryStats?.available || 0}</div>
            <p className="text-xs text-muted-foreground">
              Ready for distribution
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Allocated</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inventoryStats?.allocated || 0}</div>
            <p className="text-xs text-muted-foreground">
              Currently in use
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inventory Status */}
        <Card>
          <CardHeader>
            <CardTitle>Inventory Status Distribution</CardTitle>
            <CardDescription>Breakdown by item status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Usage Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Usage Statistics</CardTitle>
            <CardDescription>Distribution and usage overview</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={usageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#0088FE" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Stock Location & Top Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Locations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Stock Locations
            </CardTitle>
            <CardDescription>Items distributed by location</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {distributionStats?.locationData.slice(0, 8).map((loc, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm font-medium">{loc.location}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline">{loc.count} dispatches</Badge>
                    <span className="text-sm text-muted-foreground">
                      Qty: {loc.quantity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Value Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Top Value Items
            </CardTitle>
            <CardDescription>Highest investment items</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {valueByItem?.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant={item.status === "Available" ? "default" : "secondary"}
                    >
                      {item.status}
                    </Badge>
                    <span className="text-sm font-semibold">
                      ₹{item.value.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribution Type Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Distribution Type Breakdown</CardTitle>
          <CardDescription>Items distributed by type</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={distributionStats?.typeData || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#00C49F" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

export default OperationsInventoryDashboard;
