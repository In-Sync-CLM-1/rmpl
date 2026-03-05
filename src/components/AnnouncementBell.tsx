import { Bell, Megaphone, Sparkles, Bug, Trash2, TrendingUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";

const getAnnouncementIcon = (type: string) => {
  switch (type) {
    case 'new_feature': return <Sparkles className="h-4 w-4 text-primary" />;
    case 'update': return <TrendingUp className="h-4 w-4 text-blue-500" />;
    case 'bug_fix': return <Bug className="h-4 w-4 text-green-500" />;
    case 'removal': return <Trash2 className="h-4 w-4 text-orange-500" />;
    case 'improvement': return <Megaphone className="h-4 w-4 text-purple-500" />;
    default: return <Bell className="h-4 w-4" />;
  }
};

const getAnnouncementBadge = (type: string) => {
  switch (type) {
    case 'new_feature': return { label: 'New', variant: 'default' as const };
    case 'update': return { label: 'Update', variant: 'secondary' as const };
    case 'bug_fix': return { label: 'Fix', variant: 'outline' as const };
    case 'removal': return { label: 'Removed', variant: 'destructive' as const };
    case 'improvement': return { label: 'Improved', variant: 'secondary' as const };
    default: return { label: 'Info', variant: 'outline' as const };
  }
};

export function AnnouncementBell() {
  const { unreadAnnouncements, unreadCount, markAsViewed, dismissAnnouncement } = useAnnouncements();
  const navigate = useNavigate();

  const handleAnnouncementClick = async (announcement: any) => {
    await markAsViewed(announcement.id);
    if (announcement.link_url) {
      if (announcement.link_url.startsWith('http')) {
        window.open(announcement.link_url, '_blank');
      } else {
        navigate(announcement.link_url);
      }
    }
  };

  const handleDismiss = async (e: React.MouseEvent, announcementId: string) => {
    e.stopPropagation();
    await dismissAnnouncement(announcementId);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Megaphone className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">What's New</h3>
          </div>
          {unreadCount > 0 && (
            <Badge variant="secondary">{unreadCount} new</Badge>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {unreadAnnouncements.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No new announcements</p>
              <Button 
                variant="link" 
                size="sm" 
                onClick={() => navigate('/whats-new')}
                className="mt-2"
              >
                View all updates
              </Button>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {unreadAnnouncements.map((announcement) => {
                const badge = getAnnouncementBadge(announcement.announcement_type);
                return (
                  <Card
                    key={announcement.id}
                    className="p-3 hover:bg-accent cursor-pointer transition-colors relative group"
                    onClick={() => handleAnnouncementClick(announcement)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="group-hover:text-accent-foreground">
                        {getAnnouncementIcon(announcement.announcement_type)}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm group-hover:text-accent-foreground">{announcement.title}</p>
                          <Badge variant={badge.variant} className="text-xs">
                            {badge.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground group-hover:text-accent-foreground/80 line-clamp-2">
                          {announcement.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground group-hover:text-accent-foreground/70">
                            {format(new Date(announcement.published_at), "MMM dd, yyyy")}
                          </p>
                          {announcement.link_url && (
                            <span className="text-xs text-primary group-hover:text-accent-foreground flex items-center gap-1">
                              {announcement.link_text || 'Learn more'}
                              <ExternalLink className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 group-hover:text-accent-foreground"
                        onClick={(e) => handleDismiss(e, announcement.id)}
                      >
                        ×
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="p-3 border-t">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => navigate('/whats-new')}
          >
            View All Updates
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
