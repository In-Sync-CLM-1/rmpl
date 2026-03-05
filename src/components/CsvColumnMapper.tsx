import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Check, ArrowRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface ColumnMapping {
  csvColumn: string;
  dbColumn: string;
  sampleData: string[];
}

export interface DbColumn {
  name: string;
  label: string;
  type: string;
  required?: boolean;
}

interface CsvColumnMapperProps {
  csvHeaders: string[];
  csvData: any[];
  dbColumns: DbColumn[];
  onMappingConfirmed: (mapping: Record<string, string>) => void;
  onCancel: () => void;
}

export function CsvColumnMapper({
  csvHeaders,
  csvData,
  dbColumns,
  onMappingConfirmed,
  onCancel,
}: CsvColumnMapperProps) {
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<Record<string, string>>({});

  // Auto-detect likely mappings based on column names
  useEffect(() => {
    const autoMappings: Record<string, string> = {};
    
    csvHeaders.forEach((csvHeader) => {
      const normalizedCsvHeader = csvHeader.toLowerCase().trim();
      const csvWithSpaces = normalizedCsvHeader.replace(/_/g, " ");
      
      // Try to find best match with priority order
      const matchedColumn = dbColumns.find((dbCol) => {
        const normalizedDbName = dbCol.name.toLowerCase();
        const normalizedDbLabel = dbCol.label.toLowerCase();
        const dbWithSpaces = normalizedDbName.replace(/_/g, " ");
        
        // Priority 1: Exact match with DB column name (for templates using exact names)
        if (normalizedCsvHeader === normalizedDbName) return true;
        
        // Priority 2: Exact match with DB label
        if (normalizedCsvHeader === normalizedDbLabel) return true;
        
        // Priority 3: Match with underscores replaced by spaces (both directions)
        if (csvWithSpaces === dbWithSpaces) return true;
        if (csvWithSpaces === normalizedDbLabel) return true;
        
        return false;
      });
      
      // If no exact match found, try partial matching as fallback
      const fallbackMatch = !matchedColumn ? dbColumns.find((dbCol) => {
        const normalizedDbName = dbCol.name.toLowerCase();
        const normalizedDbLabel = dbCol.label.toLowerCase();
        
        return (
          normalizedCsvHeader.includes(normalizedDbName) ||
          normalizedDbName.includes(normalizedCsvHeader) ||
          normalizedCsvHeader.includes(normalizedDbLabel) ||
          normalizedDbLabel.includes(normalizedCsvHeader)
        );
      }) : null;
      
      if (matchedColumn) {
        autoMappings[csvHeader] = matchedColumn.name;
      } else if (fallbackMatch) {
        autoMappings[csvHeader] = fallbackMatch.name;
      }
    });
    
    setMappings(autoMappings);
  }, [csvHeaders, dbColumns]);

  // Validate data patterns and generate warnings
  useEffect(() => {
    const newWarnings: Record<string, string> = {};
    
    Object.entries(mappings).forEach(([csvHeader, dbColumnName]) => {
      const dbColumn = dbColumns.find((col) => col.name === dbColumnName);
      if (!dbColumn) return;
      
      // Get sample data for this CSV column
      const csvColumnIndex = csvHeaders.indexOf(csvHeader);
      const sampleValues = csvData
        .slice(0, 5)
        .map((row) => row[csvHeader] || "")
        .filter(Boolean);
      
      // Validate patterns based on column type/name
      if (dbColumnName === "emp_size") {
        // Employee size should contain numbers/ranges, not "Crore"
        const hasInvalidPattern = sampleValues.some(
          (val) =>
            val.toLowerCase().includes("crore") ||
            val.toLowerCase().includes("lakh")
        );
        if (hasInvalidPattern) {
          newWarnings[csvHeader] = "Contains currency values (likely Turnover data)";
        }
      }
      
      if (dbColumnName === "turnover") {
        // Turnover should contain "Crore"/"Lakh", not plain numbers
        const hasInvalidPattern = sampleValues.some(
          (val) =>
            /^\d+\s*to\s*\d+$/i.test(val) ||
            /^\d+(-\d+)?$/.test(val)
        );
        if (hasInvalidPattern) {
          newWarnings[csvHeader] = "Contains employee size ranges (likely Emp Size data)";
        }
      }
    });
    
    setWarnings(newWarnings);
  }, [mappings, csvHeaders, csvData, dbColumns]);

  const handleMappingChange = (csvHeader: string, dbColumnName: string) => {
    setMappings((prev) => ({
      ...prev,
      [csvHeader]: dbColumnName,
    }));
  };

  const getSampleData = (csvHeader: string): string[] => {
    return csvData
      .slice(0, 3)
      .map((row) => row[csvHeader] || "")
      .filter(Boolean);
  };

  const getMappedColumn = (dbColumnName: string): string | undefined => {
    return Object.entries(mappings).find(([_, dbCol]) => dbCol === dbColumnName)?.[0];
  };

  const requiredColumns = dbColumns.filter((col) => col.required);
  const allRequiredMapped = requiredColumns.every((col) => getMappedColumn(col.name));

  const handleConfirm = () => {
    onMappingConfirmed(mappings);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Map CSV Columns to Database Fields</CardTitle>
          <CardDescription>
            Review and adjust how your CSV columns map to the database. We've auto-detected likely matches.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!allRequiredMapped && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please map all required fields: {requiredColumns.filter((col) => !getMappedColumn(col.name)).map((col) => col.label).join(", ")}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4">
            {csvHeaders.map((csvHeader) => {
              const sampleData = getSampleData(csvHeader);
              const warning = warnings[csvHeader];
              const mappedDbColumn = mappings[csvHeader];
              const dbColumn = dbColumns.find((col) => col.name === mappedDbColumn);

              return (
                <Card key={csvHeader} className={warning ? "border-warning" : ""}>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-start">
                      <div>
                        <Label className="text-sm font-semibold mb-2 block">
                          CSV Column: {csvHeader}
                        </Label>
                        <div className="bg-muted/50 p-3 rounded-md">
                          <p className="text-xs text-muted-foreground mb-2">Sample data:</p>
                          <div className="space-y-1">
                            {sampleData.length > 0 ? (
                              sampleData.map((value, idx) => (
                                <div key={idx} className="text-sm truncate" title={value}>
                                  {value}
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground italic">No data</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-center py-4">
                        <ArrowRight className="h-5 w-5 text-muted-foreground" />
                      </div>

                      <div>
                        <Label htmlFor={`mapping-${csvHeader}`} className="text-sm font-semibold mb-2 block">
                          Maps to Database Field
                        </Label>
                        <Select
                          value={mappedDbColumn}
                          onValueChange={(value) => handleMappingChange(csvHeader, value)}
                        >
                          <SelectTrigger id={`mapping-${csvHeader}`}>
                            <SelectValue placeholder="Select field..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_skip">Skip this column</SelectItem>
                            {dbColumns.map((col) => (
                              <SelectItem key={col.name} value={col.name}>
                                {col.label} {col.required && <Badge variant="destructive" className="ml-2">Required</Badge>}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {dbColumn && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Type: {dbColumn.type}
                          </p>
                        )}
                      </div>
                    </div>

                    {warning && (
                      <Alert variant="destructive" className="mt-3">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          ⚠️ {warning}
                        </AlertDescription>
                      </Alert>
                    )}

                    {mappedDbColumn && !warning && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-success">
                        <Check className="h-4 w-4" />
                        <span>Mapping looks good</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} disabled={!allRequiredMapped}>
          Confirm Mapping & Import
        </Button>
      </div>
    </div>
  );
}
