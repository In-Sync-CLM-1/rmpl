import { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export interface DataTableColumn<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => ReactNode;
  className?: string;
  /** Show this column on mobile card view */
  mobileVisible?: boolean;
  /** Use as title in mobile card */
  mobileTitle?: boolean;
  /** Use as subtitle in mobile card */
  mobileSubtitle?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  isLoading?: boolean;
  emptyState?: {
    icon?: LucideIcon;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
  };
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange: (items: number) => void;
  };
  getRowKey: (item: T) => string;
  actions?: (item: T) => ReactNode;
  onRowClick?: (item: T) => void;
  /** Force table view even on mobile */
  forceTableView?: boolean;
  /** Custom mobile card renderer */
  mobileCard?: (item: T, actions?: ReactNode) => ReactNode;
}

export function DataTable<T>({
  data,
  columns,
  isLoading,
  emptyState,
  pagination,
  getRowKey,
  actions,
  onRowClick,
  forceTableView = false,
  mobileCard,
}: DataTableProps<T>) {
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="flex justify-center py-8 sm:py-12">
        <LoadingSpinner size="lg" text="Loading data..." />
      </div>
    );
  }

  if (data.length === 0 && emptyState) {
    return <EmptyState {...emptyState} />;
  }

  // Mobile card view
  if (isMobile && !forceTableView) {
    return (
      <div className="space-y-2">
        {data.map((item) => {
          // Use custom mobile card if provided
          if (mobileCard) {
            return (
              <div key={getRowKey(item)}>
                {mobileCard(item, actions?.(item))}
              </div>
            );
          }

          // Default mobile card
          const titleCol = columns.find(c => c.mobileTitle) || columns[0];
          const subtitleCol = columns.find(c => c.mobileSubtitle) || columns[1];
          const visibleCols = columns.filter(c => c.mobileVisible && !c.mobileTitle && !c.mobileSubtitle);

          const getCellValue = (col: DataTableColumn<T>) => {
            if (col.cell) return col.cell(item);
            if (col.accessorKey) return String(item[col.accessorKey] ?? "N/A");
            return "N/A";
          };

          return (
            <Card 
              key={getRowKey(item)}
              className={onRowClick ? "cursor-pointer hover:bg-muted/50 active:bg-muted transition-colors" : ""}
              onClick={() => onRowClick?.(item)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {getCellValue(titleCol)}
                    </div>
                    {subtitleCol && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {getCellValue(subtitleCol)}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0">
                    {actions && (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {actions(item)}
                      </div>
                    )}
                    {onRowClick && !actions && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
                
                {visibleCols.length > 0 && (
                  <div className="mt-2 pt-2 border-t grid grid-cols-2 gap-x-3 gap-y-1">
                    {visibleCols.slice(0, 4).map((col, idx) => (
                      <div key={idx} className="min-w-0">
                        <div className="text-xs text-muted-foreground truncate">{col.header}</div>
                        <div className="text-xs font-medium truncate">{getCellValue(col)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {pagination && pagination.totalPages > 1 && (
          <PaginationControls {...pagination} />
        )}
      </div>
    );
  }

  // Desktop table view
  return (
    <>
      <div className="bg-card rounded-lg border relative overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column, index) => (
                  <TableHead key={index} className={`whitespace-nowrap ${column.className || ''}`}>
                    {column.header}
                  </TableHead>
                ))}
                {actions && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow 
                  key={getRowKey(item)} 
                  onClick={() => onRowClick?.(item)}
                  className={onRowClick ? "cursor-pointer hover:bg-muted/50" : undefined}
                >
                  {columns.map((column, colIndex) => (
                    <TableCell key={colIndex} className={column.className}>
                      {column.cell
                        ? column.cell(item)
                        : column.accessorKey
                        ? String(item[column.accessorKey] ?? "N/A")
                        : "N/A"}
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 sm:gap-2">{actions(item)}</div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {isLoading && data.length > 0 && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg transition-opacity duration-200">
            <LoadingSpinner size="lg" text="Applying filters..." />
          </div>
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <PaginationControls {...pagination} />
      )}
    </>
  );
}
