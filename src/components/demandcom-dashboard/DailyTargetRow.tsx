import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { TableRow, TableCell } from "@/components/ui/table";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

interface DailyTargetRowProps {
  userId: string;
  userName: string;
  isTeamLeader?: boolean;
  callTarget: number;
  regTarget: number;
  dbUpdateTarget: number;
  actualCalls?: number;
  actualRegistrations?: number;
  actualDatabaseUpdates?: number;
  onTargetChange: (
    userId: string,
    callTarget: number,
    registrationTarget: number,
    databaseUpdateTarget: number
  ) => void;
  canEdit: boolean;
  isUpdating?: boolean;
  hasAttendance?: boolean;
}

function AchievementBadge({ percentage }: { percentage: number }) {
  const colorClass = percentage >= 80 
    ? "bg-green-500/20 text-green-700 dark:text-green-400" 
    : percentage >= 50 
      ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" 
      : "bg-red-500/20 text-red-700 dark:text-red-400";
  
  return (
    <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", colorClass)}>
      {percentage.toFixed(0)}%
    </span>
  );
}

export function DailyTargetRow({
  userId,
  userName,
  isTeamLeader = false,
  callTarget,
  regTarget,
  dbUpdateTarget,
  actualCalls = 0,
  actualRegistrations = 0,
  actualDatabaseUpdates = 0,
  onTargetChange,
  canEdit,
  isUpdating,
  hasAttendance = false,
}: DailyTargetRowProps) {
  const [localCallTarget, setLocalCallTarget] = useState(callTarget);
  const [localRegTarget, setLocalRegTarget] = useState(regTarget);
  const [localDbUpdateTarget, setLocalDbUpdateTarget] = useState(dbUpdateTarget);

  useEffect(() => {
    setLocalCallTarget(callTarget);
    setLocalRegTarget(regTarget);
    setLocalDbUpdateTarget(dbUpdateTarget);
  }, [callTarget, regTarget, dbUpdateTarget]);

  const handleBlur = () => {
    if (localCallTarget !== callTarget || localRegTarget !== regTarget || localDbUpdateTarget !== dbUpdateTarget) {
      onTargetChange(userId, localCallTarget, localRegTarget, localDbUpdateTarget);
    }
  };

  const callAchievementPct = localCallTarget > 0 ? (actualCalls / localCallTarget) * 100 : 0;
  const regAchievementPct = localRegTarget > 0 ? (actualRegistrations / localRegTarget) * 100 : 0;
  const dbUpdateAchievementPct = localDbUpdateTarget > 0 ? (actualDatabaseUpdates / localDbUpdateTarget) * 100 : 0;

  if (isTeamLeader) {
    return (
      <TableRow className="bg-muted/50 font-medium hover:bg-muted/50">
        <TableCell className="py-1.5">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-sm">{userName}</span>
            <span className="text-[10px] text-muted-foreground">(Team Leader)</span>
          </div>
        </TableCell>
        <TableCell className="text-center text-muted-foreground text-xs py-1.5">-</TableCell>
        <TableCell className="text-center text-muted-foreground text-xs py-1.5">-</TableCell>
        <TableCell className="text-center text-muted-foreground text-xs py-1.5">-</TableCell>
        <TableCell className="text-center text-muted-foreground text-xs py-1.5">-</TableCell>
        <TableCell className="text-center text-muted-foreground text-xs py-1.5">-</TableCell>
        <TableCell className="text-center text-muted-foreground text-xs py-1.5">-</TableCell>
        <TableCell className="text-center text-muted-foreground text-xs py-1.5">-</TableCell>
        <TableCell className="text-center text-muted-foreground text-xs py-1.5">-</TableCell>
        <TableCell className="text-center text-muted-foreground text-xs py-1.5">-</TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell className="py-1 pl-8">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground text-xs">└</span>
          <span className={cn(
            "text-sm",
            hasAttendance && "text-green-600 dark:text-green-400"
          )}>{userName}</span>
        </div>
      </TableCell>
      {/* Call Target */}
      <TableCell className="text-center py-1">
        {canEdit ? (
          <Input
            type="number"
            min={0}
            value={localCallTarget}
            onChange={(e) => setLocalCallTarget(parseInt(e.target.value) || 0)}
            onBlur={handleBlur}
            className="w-16 h-7 mx-auto text-center text-sm"
            disabled={isUpdating}
          />
        ) : (
          <span className="font-medium text-sm">{callTarget}</span>
        )}
      </TableCell>
      {/* Actual Calls */}
      <TableCell className="text-center font-medium bg-blue-500/10 py-1 text-sm">
        {actualCalls}
      </TableCell>
      {/* Call Achievement % */}
      <TableCell className="text-center py-1">
        {localCallTarget > 0 ? (
          <AchievementBadge percentage={callAchievementPct} />
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )}
      </TableCell>
      {/* Reg Target */}
      <TableCell className="text-center py-1 border-l">
        {canEdit ? (
          <Input
            type="number"
            min={0}
            value={localRegTarget}
            onChange={(e) => setLocalRegTarget(parseInt(e.target.value) || 0)}
            onBlur={handleBlur}
            className="w-16 h-7 mx-auto text-center text-sm"
            disabled={isUpdating}
          />
        ) : (
          <span className="font-medium text-sm">{regTarget}</span>
        )}
      </TableCell>
      {/* Actual Registrations */}
      <TableCell className="text-center font-medium bg-green-500/10 py-1 text-sm">
        {actualRegistrations}
      </TableCell>
      {/* Reg Achievement % */}
      <TableCell className="text-center py-1">
        {localRegTarget > 0 ? (
          <AchievementBadge percentage={regAchievementPct} />
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )}
      </TableCell>
      {/* Database Update Target */}
      <TableCell className="text-center py-1 border-l">
        {canEdit ? (
          <Input
            type="number"
            min={0}
            value={localDbUpdateTarget}
            onChange={(e) => setLocalDbUpdateTarget(parseInt(e.target.value) || 0)}
            onBlur={handleBlur}
            className="w-16 h-7 mx-auto text-center text-sm"
            disabled={isUpdating}
          />
        ) : (
          <span className="font-medium text-sm">{dbUpdateTarget}</span>
        )}
      </TableCell>
      {/* Actual Database Updates */}
      <TableCell className="text-center font-medium bg-cyan-500/10 py-1 text-sm">
        {actualDatabaseUpdates}
      </TableCell>
      {/* Database Update Achievement % */}
      <TableCell className="text-center py-1">
        {localDbUpdateTarget > 0 ? (
          <AchievementBadge percentage={dbUpdateAchievementPct} />
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )}
      </TableCell>
    </TableRow>
  );
}
