import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, TrendingUp, Calendar, Hash } from "lucide-react";

export const PaymentSummaryCards = () => {
  const { data: summaryData } = useQuery({
    queryKey: ["payment-summary"],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

      // Today's payments
      const { data: todayPayments, error: todayError } = await supabase
        .from("payments")
        .select("amount")
        .eq("payment_date", today);

      if (todayError) throw todayError;

      // This month's payments
      const { data: monthPayments, error: monthError } = await supabase
        .from("payments")
        .select("amount")
        .gte("payment_date", firstOfMonth);

      if (monthError) throw monthError;

      const todaysTotal = todayPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const monthsTotal = monthPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const paymentCount = monthPayments.length;

      return {
        todaysTotal,
        monthsTotal,
        paymentCount
      };
    },
  });

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Today's Payments</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">£{summaryData?.todaysTotal?.toLocaleString('en-GB', { minimumFractionDigits: 2 }) || '0.00'}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Month</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">£{summaryData?.monthsTotal?.toLocaleString('en-GB', { minimumFractionDigits: 2 }) || '0.00'}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Payment Count</CardTitle>
          <Hash className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summaryData?.paymentCount || 0}</div>
          <p className="text-xs text-muted-foreground">this month</p>
        </CardContent>
      </Card>
    </div>
  );
};