import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { StarBadge } from "./StarBadge";
import { LeaderboardEntry, STAR_TIERS } from "@/hooks/useUserPoints";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  teamFilter?: string | null;
  title?: string;
  maxHeight?: string;
}

const RankIcon = ({ rank }: { rank: number }) => {
  switch (rank) {
    case 1:
      return <Crown className="w-6 h-6 text-yellow-500 fill-yellow-500" />;
    case 2:
      return <Medal className="w-5 h-5 text-slate-400" />;
    case 3:
      return <Award className="w-5 h-5 text-amber-700" />;
    default:
      return (
        <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-muted-foreground">
          {rank}
        </span>
      );
  }
};

export function Leaderboard({ 
  entries, 
  currentUserId, 
  teamFilter,
  title = "Leaderboard",
  maxHeight = "400px"
}: LeaderboardProps) {
  const filteredEntries = teamFilter 
    ? entries.filter(e => e.team_name === teamFilter)
    : entries;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="w-5 h-5 text-yellow-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea style={{ maxHeight }} className="pr-4">
          <div className="space-y-2">
            {filteredEntries.map((entry, index) => {
              const isCurrentUser = entry.user_id === currentUserId;
              const displayRank = teamFilter ? index + 1 : entry.rank;
              
              return (
                <div
                  key={entry.user_id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg transition-all",
                    displayRank <= 3 && "bg-gradient-to-r from-yellow-50/50 to-transparent dark:from-yellow-900/10",
                    isCurrentUser && "ring-2 ring-primary ring-offset-2",
                    !isCurrentUser && "hover:bg-muted/50"
                  )}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-8 flex justify-center">
                    <RankIcon rank={displayRank} />
                  </div>
                  
                  {/* Avatar */}
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={entry.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {entry.full_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Name & Team */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "font-medium truncate",
                      isCurrentUser && "text-primary"
                    )}>
                      {entry.full_name}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs text-muted-foreground">(You)</span>
                      )}
                    </p>
                    {entry.team_name && (
                      <p className="text-xs text-muted-foreground truncate">
                        {entry.team_name}
                      </p>
                    )}
                  </div>
                  
                  {/* Star Badge */}
                  <StarBadge 
                    tier={entry.star_tier as keyof typeof STAR_TIERS} 
                    size="sm" 
                  />
                  
                  {/* Points */}
                  <div className="flex-shrink-0 text-right">
                    <p className="font-bold text-lg">{entry.total_points}</p>
                    <p className="text-xs text-muted-foreground">points</p>
                  </div>
                </div>
              );
            })}
            
            {filteredEntries.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No entries yet</p>
                <p className="text-sm">Start earning points to appear here!</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
