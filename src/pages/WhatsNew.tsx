import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { format } from "date-fns";
import { Megaphone, Sparkles, Bug, Trash2, TrendingUp, ExternalLink, CheckCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

const getAnnouncementIcon = (type: string) => {
  switch (type) {
    case 'new_feature': return <Sparkles className="h-5 w-5 text-primary" />;
    case 'update': return <TrendingUp className="h-5 w-5 text-blue-500" />;
    case 'bug_fix': return <Bug className="h-5 w-5 text-green-500" />;
    case 'removal': return <Trash2 className="h-5 w-5 text-orange-500" />;
    case 'improvement': return <Megaphone className="h-5 w-5 text-purple-500" />;
    default: return <Megaphone className="h-5 w-5" />;
  }
};

const getAnnouncementBadge = (type: string) => {
  switch (type) {
    case 'new_feature': return { label: 'New Feature', variant: 'default' as const };
    case 'update': return { label: 'Update', variant: 'secondary' as const };
    case 'bug_fix': return { label: 'Bug Fix', variant: 'outline' as const };
    case 'removal': return { label: 'Removed', variant: 'destructive' as const };
    case 'improvement': return { label: 'Improvement', variant: 'secondary' as const };
    default: return { label: 'Announcement', variant: 'outline' as const };
  }
};

export default function WhatsNew() {
  const { announcements, viewedAnnouncements, markAsViewed, dismissAnnouncement } = useAnnouncements();
  const [filter, setFilter] = useState<string>("all");

  const filteredAnnouncements = filter === "all" 
    ? announcements 
    : announcements.filter(a => a.announcement_type === filter);

  const isViewed = (announcementId: string) => {
    return viewedAnnouncements.some(v => v.announcement_id === announcementId);
  };

  const handleMarkAsRead = async (announcementId: string) => {
    await markAsViewed(announcementId);
  };

  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Megaphone className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-semibold">What's New</h2>
        </div>
        <p className="text-muted-foreground">
          Stay up to date with the latest features, updates, and improvements
        </p>
      </div>

      <Tabs value={filter} onValueChange={setFilter} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All Updates</TabsTrigger>
          <TabsTrigger value="new_feature">New Features</TabsTrigger>
          <TabsTrigger value="update">Updates</TabsTrigger>
          <TabsTrigger value="improvement">Improvements</TabsTrigger>
          <TabsTrigger value="bug_fix">Bug Fixes</TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredAnnouncements.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Megaphone className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-semibold mb-2">No announcements yet</h3>
            <p className="text-muted-foreground">
              Check back later for new updates and features
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAnnouncements.map((announcement) => {
            const badge = getAnnouncementBadge(announcement.announcement_type);
            const viewed = isViewed(announcement.id);
            
            return (
              <Card key={announcement.id} className={!viewed ? "border-primary/50" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getAnnouncementIcon(announcement.announcement_type)}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-xl">{announcement.title}</CardTitle>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          {!viewed && (
                            <Badge variant="outline" className="text-primary border-primary">
                              New
                            </Badge>
                          )}
                          {announcement.priority === 'high' && (
                            <Badge variant="destructive">High Priority</Badge>
                          )}
                          {announcement.priority === 'critical' && (
                            <Badge variant="destructive">Critical</Badge>
                          )}
                        </div>
                        <CardDescription>
                          {format(new Date(announcement.published_at), "MMMM dd, yyyy 'at' h:mm a")}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {announcement.description}
                  </p>

                  {announcement.image_url && (
                    <img 
                      src={announcement.image_url} 
                      alt={announcement.title}
                      className="w-full rounded-lg border"
                    />
                  )}

                  <div className="flex items-center gap-2">
                    {announcement.link_url && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          if (announcement.link_url!.startsWith('http')) {
                            window.open(announcement.link_url, '_blank');
                          } else {
                            window.location.href = announcement.link_url!;
                          }
                          handleMarkAsRead(announcement.id);
                        }}
                      >
                        {announcement.link_text || 'Learn More'}
                        <ExternalLink className="h-3 w-3 ml-2" />
                      </Button>
                    )}
                    {!viewed && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMarkAsRead(announcement.id)}
                      >
                        <CheckCircle className="h-3 w-3 mr-2" />
                        Mark as Read
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
