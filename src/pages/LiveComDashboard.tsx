import { useState } from "react";
import { useLiveComDashboard } from "@/hooks/useLiveComDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Star, TrendingUp, DollarSign, Award, Building2, ChevronDown, ChevronUp, AlertTriangle, Sparkles, CheckCircle2, BarChart2, Receipt } from "lucide-react";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RefreshDataButton } from "@/components/RefreshDataButton";

export default function LiveComDashboard() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");
  const [showVendorTable, setShowVendorTable] = useState(false);
  const [showEventsTable, setShowEventsTable] = useState(false);
  const [showVendorBillingTable, setShowVendorBillingTable] = useState(false);

  const { data: metrics, isLoading } = useLiveComDashboard(appliedDateFrom, appliedDateTo);

  const handleApplyFilters = () => {
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
  };

  const handleResetFilters = () => {
    setDateFrom("");
    setDateTo("");
    setAppliedDateFrom("");
    setAppliedDateTo("");
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return <span className="text-muted-foreground">-</span>;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3 w-3 ${
              star <= rating ? "fill-yellow-500 text-yellow-500" : "fill-muted text-muted-foreground"
            }`}
          />
        ))}
      </div>
    );
  };

  // Categorize vendors by performance
  const getVendorInsights = () => {
    if (!metrics?.topVendors?.length) return { topPerformers: [], needsAttention: [], rising: [] };
    
    const sorted = [...metrics.topVendors].sort((a, b) => b.event_count - a.event_count);
    const avgRating = sorted.reduce((sum, v) => sum + v.avg_rating, 0) / sorted.length || 3;
    
    const topPerformers = sorted.filter(v => v.avg_rating >= 4 && v.event_count >= 2).slice(0, 3);
    const needsAttention = sorted.filter(v => v.avg_rating < 3 && v.event_count >= 2).slice(0, 3);
    const rising = sorted.filter(v => v.avg_rating >= 4 && v.event_count === 1).slice(0, 3);
    
    return { topPerformers, needsAttention, rising };
  };

  const vendorInsights = getVendorInsights();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header & Filters - Compact */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">LiveCom Dashboard</h1>
            <p className="text-sm text-muted-foreground">Events, vendors & performance overview</p>
          </div>
          <div className="flex gap-2 items-center">
            <RefreshDataButton queryKeys={[["livecom-dashboard"]]} />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-36 h-8 text-sm"
              placeholder="From"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-36 h-8 text-sm"
              placeholder="To"
            />
            <Button size="sm" onClick={handleApplyFilters}>Apply</Button>
            <Button size="sm" variant="outline" onClick={handleResetFilters}>Reset</Button>
          </div>
        </div>

        {/* KPI Cards - Compact Row */}
        <div className="grid grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Events</p>
                <p className="text-2xl font-bold">{metrics?.totalEvents || 0}</p>
              </div>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold">₹{((metrics?.totalCost || 0) / 1000).toFixed(0)}K</p>
              </div>
              <DollarSign className="h-5 w-5 text-muted-foreground" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">LiveCom Rating</p>
                <p className="text-2xl font-bold">{metrics?.avgLiveComRating.toFixed(1) || "0.0"}</p>
              </div>
              {renderStars(Math.round(metrics?.avgLiveComRating || 0))}
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">CSBD Rating</p>
                <p className="text-2xl font-bold">{metrics?.avgCsbdRating.toFixed(1) || "0.0"}</p>
              </div>
              {renderStars(Math.round(metrics?.avgCsbdRating || 0))}
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Completion Rate</p>
                <p className="text-2xl font-bold">{metrics?.completionRate.toFixed(0) || "0"}%</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            </div>
          </Card>
        </div>

        {/* Vendor Insights - Compact Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 border-green-500/30 bg-green-500/5">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">Top Performers</span>
            </div>
            {vendorInsights.topPerformers.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data yet</p>
            ) : (
              <div className="space-y-1.5">
                {vendorInsights.topPerformers.map((v, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[120px]">{v.vendor_name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{v.event_count}</Badge>
                      {renderStars(Math.round(v.avg_rating))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4 border-red-500/30 bg-red-500/5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-700">Needs Attention</span>
            </div>
            {vendorInsights.needsAttention.length === 0 ? (
              <p className="text-xs text-muted-foreground">All vendors performing well</p>
            ) : (
              <div className="space-y-1.5">
                {vendorInsights.needsAttention.map((v, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[120px]">{v.vendor_name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{v.event_count}</Badge>
                      {renderStars(Math.round(v.avg_rating))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4 border-blue-500/30 bg-blue-500/5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">Rising Stars</span>
            </div>
            {vendorInsights.rising.length === 0 ? (
              <p className="text-xs text-muted-foreground">No new standouts</p>
            ) : (
              <div className="space-y-1.5">
                {vendorInsights.rising.map((v, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[120px]">{v.vendor_name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{v.event_count}</Badge>
                      {renderStars(Math.round(v.avg_rating))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Charts - Side by Side */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <p className="text-sm font-medium mb-2">Monthly Trends</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={metrics?.monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="event_count" stroke="hsl(var(--primary))" name="Events" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-4">
            <p className="text-sm font-medium mb-2">Top Vendors by Volume</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={metrics?.topVendors?.slice(0, 5)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="vendor_name" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="event_count" fill="hsl(var(--primary))" name="Events" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Activity Analysis */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Activity Analysis</p>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {/* Services breakdown */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Services Breakdown</p>
              {(metrics?.servicesBreakdown || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No data</p>
              ) : (
                <div className="space-y-2">
                  {(metrics?.servicesBreakdown || []).slice(0, 6).map((s) => (
                    <div key={s.service} className="space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate max-w-[100px]">{s.service}</span>
                        <span className="text-muted-foreground">{s.count} events · ₹{(s.total_cost / 1000).toFixed(0)}K</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (s.count / (metrics?.totalEvents || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Completion rate */}
            <div className="flex flex-col items-center justify-center text-center">
              <p className="text-xs font-medium text-muted-foreground mb-3">Completion Rate</p>
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 100 100" className="-rotate-90 w-24 h-24">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                  <circle
                    cx="50" cy="50" r="40" fill="none"
                    stroke="hsl(142 76% 36%)"
                    strokeWidth="10"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - (metrics?.completionRate || 0) / 100)}`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-green-600">{metrics?.completionRate.toFixed(0) || "0"}%</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {metrics?.recentEvents?.filter(e => (e.project?.number_of_attendees || 0) > 0 && (e.registrations || 0) >= (e.project?.number_of_attendees || 0)).length || 0} of{" "}
                {metrics?.recentEvents?.filter(e => (e.project?.number_of_attendees || 0) > 0).length || 0} events met target
              </p>
            </div>

            {/* Cost distribution */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Cost by Vendor (Top 3)</p>
              {(metrics?.vendorBilling || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No data</p>
              ) : (
                <div className="space-y-2">
                  {(metrics?.vendorBilling || []).slice(0, 3).map((v) => {
                    const pct = metrics?.totalCost ? Math.round((v.total_cost / metrics.totalCost) * 100) : 0;
                    return (
                      <div key={v.vendor_name} className="space-y-0.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="truncate max-w-[110px]">{v.vendor_name}</span>
                          <span className="text-muted-foreground">{pct}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className="bg-amber-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground">₹{v.total_cost.toLocaleString()}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Collapsible Tables */}
        <div className="space-y-2">
          <Collapsible open={showVendorTable} onOpenChange={setShowVendorTable}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  All Vendors ({metrics?.topVendors?.length || 0})
                </span>
                {showVendorTable ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="mt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Events</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics?.topVendors.map((vendor, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{vendor.vendor_name}</TableCell>
                        <TableCell>{vendor.event_count}</TableCell>
                        <TableCell>₹{vendor.total_cost.toLocaleString()}</TableCell>
                        <TableCell>{renderStars(Math.round(vendor.avg_rating))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          {/* Vendor Billing Details */}
          <Collapsible open={showVendorBillingTable} onOpenChange={setShowVendorBillingTable}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Vendor Billing Details ({metrics?.vendorBilling?.length || 0})
                </span>
                {showVendorBillingTable ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="mt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Events</TableHead>
                      <TableHead>Total Billed</TableHead>
                      <TableHead>Cost/Event</TableHead>
                      <TableHead>Services</TableHead>
                      <TableHead>LiveCom ★</TableHead>
                      <TableHead>CSBD ★</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics?.vendorBilling.map((vendor, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{vendor.vendor_name}</TableCell>
                        <TableCell>{vendor.event_count}</TableCell>
                        <TableCell>₹{vendor.total_cost.toLocaleString()}</TableCell>
                        <TableCell>₹{Math.round(vendor.cost_per_event).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {vendor.services.slice(0, 2).map((s, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                            ))}
                            {vendor.services.length > 2 && (
                              <Badge variant="outline" className="text-xs">+{vendor.services.length - 2}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{renderStars(Math.round(vendor.avg_livecom_rating))}</TableCell>
                        <TableCell>{renderStars(Math.round(vendor.avg_csbd_rating))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={showEventsTable} onOpenChange={setShowEventsTable}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Recent Events ({metrics?.recentEvents?.length || 0})
                </span>
                {showEventsTable ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="mt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Registrations</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics?.recentEvents.map((event) => {
                      const target = event.project?.number_of_attendees || 0;
                      const regs = event.registrations || 0;
                      const isCompleted = target > 0 && regs >= target;
                      return (
                        <TableRow key={event.id}>
                          <TableCell>{format(new Date(event.created_at), "dd MMM")}</TableCell>
                          <TableCell>{event.project?.project_number || "-"}</TableCell>
                          <TableCell>{event.vendor_hotel?.vendor_name || "-"}</TableCell>
                          <TableCell>{event.internal_cost_exc_tax ? `₹${event.internal_cost_exc_tax.toLocaleString()}` : "-"}</TableCell>
                          <TableCell>
                            {target > 0 ? `${regs} / ${target}` : regs > 0 ? `${regs}` : "-"}
                          </TableCell>
                          <TableCell>
                            {target > 0 ? (
                              isCompleted ? (
                                <Badge className="bg-green-600 hover:bg-green-700 text-white">Completed</Badge>
                              ) : (
                                <Badge className="bg-amber-500 hover:bg-amber-600 text-white">In Progress</Badge>
                              )
                            ) : (
                              <span className="text-muted-foreground text-xs">No target</span>
                            )}
                          </TableCell>
                          <TableCell>{renderStars(event.rating_by_livecom)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}
