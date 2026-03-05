import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Building2 } from "lucide-react";
import { useZeroRevenueClients } from "@/hooks/useZeroRevenueClients";

export const ZeroRevenueClients = () => {
  const { data: zeroRevenueClients, isLoading } = useZeroRevenueClients();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="md" text="Analyzing clients..." />
      </div>
    );
  }

  if (!zeroRevenueClients || zeroRevenueClients.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-500" />
            <CardTitle>Zero Revenue Clients</CardTitle>
          </div>
          <CardDescription>All clients have generated revenue! 🎉</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-amber-500" />
          <CardTitle>Zero Revenue Clients ({zeroRevenueClients.length})</CardTitle>
        </div>
        <CardDescription>
          Companies with no closed deals
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed">{zeroRevenueClients.join(", ")}</p>
      </CardContent>
    </Card>
  );
};
