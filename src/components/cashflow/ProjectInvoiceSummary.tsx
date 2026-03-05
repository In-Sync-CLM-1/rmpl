import { Card, CardContent } from "@/components/ui/card";
import { IndianRupee, TrendingUp, Clock } from "lucide-react";

interface ProjectInvoiceSummaryProps {
  totalInvoiced: number;
  totalReceived: number;
  totalPending: number;
}

export function ProjectInvoiceSummary({
  totalInvoiced,
  totalReceived,
  totalPending,
}: ProjectInvoiceSummaryProps) {
  const formatCurrency = (amount: number) => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)}L`;
    }
    return `₹${amount.toLocaleString()}`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <IndianRupee className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Invoiced</p>
              <p className="text-xl font-semibold">{formatCurrency(totalInvoiced)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Received</p>
              <p className="text-xl font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(totalReceived)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-xl font-semibold text-orange-600 dark:text-orange-400">
                {formatCurrency(totalPending)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
