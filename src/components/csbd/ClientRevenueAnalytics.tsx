import { useState, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ChevronDown, ChevronRight, TrendingUp } from "lucide-react";
import { useClientRevenueAnalytics, ClientRevenue } from "@/hooks/useClientRevenueAnalytics";

export const ClientRevenueAnalytics = () => {
  const { data: clientRevenues, isLoading } = useClientRevenueAnalytics();
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return `₹${value.toFixed(2)}L`;
  };

  const getRevenueTier = (revenue: number, totalRevenue: number) => {
    const percentage = (revenue / totalRevenue) * 100;
    if (percentage >= 20) {
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">Top Tier</Badge>;
    } else if (percentage >= 10) {
      return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">High Value</Badge>;
    } else if (percentage >= 5) {
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Mid Value</Badge>;
    }
    return <Badge variant="outline">Regular</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="md" text="Loading client analytics..." />
      </div>
    );
  }

  if (!clientRevenues || clientRevenues.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">No client revenue data available.</p>
        </CardContent>
      </Card>
    );
  }

  const totalRevenue = clientRevenues.reduce((sum, client) => sum + client.total_revenue, 0);
  const topClients = clientRevenues.slice(0, 10); // Top 10 clients

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-500" />
          <CardTitle>Client Revenue Analytics</CardTitle>
        </div>
        <CardDescription>
          Top clients by revenue (in Lacs) - Total: {formatCurrency(totalRevenue)} from {clientRevenues.length} clients
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 sm:w-10"></TableHead>
                <TableHead className="min-w-[150px]">Client</TableHead>
                <TableHead className="text-right min-w-[100px]">Revenue (in Lacs)</TableHead>
                <TableHead className="text-center min-w-[80px]">Deals</TableHead>
                <TableHead className="min-w-[120px]">Primary Owner</TableHead>
                <TableHead className="text-center min-w-[100px]">Tier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topClients.map((client, index) => {
                const isExpanded = expandedClientId === client.client_id;
                
                return (
                  <Fragment key={client.client_id}>
                    <TableRow
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => setExpandedClientId(isExpanded ? null : client.client_id)}
                    >
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">#{index + 1}</span>
                            <span>{client.client_name}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {((client.total_revenue / totalRevenue) * 100).toFixed(1)}% of total
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">
                        {formatCurrency(client.total_revenue)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{client.deals_closed}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{client.primary_owner_name}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        {getRevenueTier(client.total_revenue, totalRevenue)}
                      </TableCell>
                    </TableRow>
                    
                    {/* Expanded Owner Breakdown */}
                    {isExpanded && client.owner_breakdown.length > 1 && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/30 p-0">
                          <div className="p-4">
                            <div className="text-sm font-medium mb-2">Owner Breakdown:</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {client.owner_breakdown
                                .sort((a, b) => b.revenue - a.revenue)
                                .map((owner) => (
                                  <div 
                                    key={owner.owner_id}
                                    className="flex items-center justify-between border rounded p-2 bg-background"
                                  >
                                    <div className="text-sm">{owner.owner_name}</div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground">
                                        {owner.deals} deal{owner.deals !== 1 ? 's' : ''}
                                      </span>
                                      <span className="font-medium text-emerald-600">
                                        {formatCurrency(owner.revenue)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
