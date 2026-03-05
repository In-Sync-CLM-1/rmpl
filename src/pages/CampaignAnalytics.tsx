import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { logError, getCurrentUserId, getSupabaseErrorMessage } from "@/lib/errorLogger";
import { useToast } from "@/hooks/use-toast";

interface Campaign {
  id: string;
  name: string;
  type: "email" | "sms";
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  unsubscribed_count: number;
}

interface Recipient {
  id: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  error_message: string | null;
  demandcom: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
}

interface Link {
  original_url: string;
  click_count: number;
}

export default function CampaignAnalytics() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchCampaignData();
    }
  }, [id]);

  const fetchCampaignData = async () => {
    try {
      setIsLoading(true);

      const [campaignResult, recipientsResult, linksResult] = await Promise.all([
        supabase.from("campaigns").select("*").eq("id", id).single(),
        supabase
          .from("campaign_recipients")
          .select("*, demandcom(first_name, last_name, email, phone)")
          .eq("campaign_id", id),
        supabase.from("campaign_links").select("original_url, click_count").eq("campaign_id", id),
      ]);

      if (campaignResult.error) throw campaignResult.error;
      if (recipientsResult.error) throw recipientsResult.error;
      if (linksResult.error) throw linksResult.error;

      setCampaign(campaignResult.data as Campaign);
      setRecipients(recipientsResult.data as any || []);
      setLinks(linksResult.data || []);
    } catch (error: any) {
      const userId = await getCurrentUserId(supabase);
      logError(error, {
        component: "CampaignAnalytics",
        operation: "FETCH_DATA",
        userId,
        route: `/campaigns/${id}/analytics`,
        metadata: { campaignId: id },
      });
      toast({
        title: "Error",
        description: getSupabaseErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getPercentage = (value: number, total: number) => {
    if (total === 0) return "0%";
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      sent: "default",
      delivered: "default",
      opened: "default",
      clicked: "default",
      bounced: "destructive",
      failed: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!campaign) {
    return <div className="container mx-auto py-8 px-4">Campaign not found</div>;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{campaign.name}</h1>
          <p className="text-muted-foreground">Campaign Analytics</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Recipients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.total_recipients}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.sent_count}</div>
            <p className="text-xs text-muted-foreground">
              {getPercentage(campaign.sent_count, campaign.total_recipients)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.delivered_count}</div>
            <p className="text-xs text-muted-foreground">
              {getPercentage(campaign.delivered_count, campaign.sent_count)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {campaign.type === "email" ? "Opened" : "Clicked"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaign.type === "email" ? campaign.opened_count : campaign.clicked_count}
            </div>
            <p className="text-xs text-muted-foreground">
              {campaign.type === "email"
                ? getPercentage(campaign.opened_count, campaign.delivered_count)
                : getPercentage(campaign.clicked_count, campaign.delivered_count)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Recipients</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>{campaign.type === "email" ? "Email" : "Phone"}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Delivered</TableHead>
                {campaign.type === "email" && <TableHead>Opened</TableHead>}
                <TableHead>Clicked</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No recipients data
                  </TableCell>
                </TableRow>
              ) : (
                recipients.map((recipient) => (
                  <TableRow key={recipient.id}>
                    <TableCell>
                      {recipient.demandcom.first_name} {recipient.demandcom.last_name}
                    </TableCell>
                    <TableCell>
                      {campaign?.type === "email"
                        ? recipient.demandcom.email
                        : recipient.demandcom.phone}
                    </TableCell>
                    <TableCell>{getStatusBadge(recipient.status)}</TableCell>
                    <TableCell>
                      {recipient.sent_at ? format(new Date(recipient.sent_at), "MMM d, HH:mm") : "-"}
                    </TableCell>
                    <TableCell>
                      {recipient.delivered_at
                        ? format(new Date(recipient.delivered_at), "MMM d, HH:mm")
                        : "-"}
                    </TableCell>
                    {campaign.type === "email" && (
                      <TableCell>
                        {recipient.opened_at
                          ? format(new Date(recipient.opened_at), "MMM d, HH:mm")
                          : "-"}
                      </TableCell>
                    )}
                    <TableCell>
                      {recipient.clicked_at
                        ? format(new Date(recipient.clicked_at), "MMM d, HH:mm")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-destructive text-xs">
                      {recipient.error_message || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {links.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Link Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Clicks</TableHead>
                  <TableHead>Click Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-xs">{link.original_url}</TableCell>
                    <TableCell>{link.click_count}</TableCell>
                    <TableCell>
                      {getPercentage(link.click_count, campaign.delivered_count)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
