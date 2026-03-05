import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, Download, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";

interface CsvAudienceUploadProps {
  mergeTags: string[];
  onDataLoaded: (data: any[]) => void;
  existingData?: any[];
  disabled?: boolean;
}

export function CsvAudienceUpload({ mergeTags, onDataLoaded, existingData, disabled }: CsvAudienceUploadProps) {
  const { toast } = useToast();
  const [fileName, setFileName] = useState<string>("");
  const [rowCount, setRowCount] = useState<number>(existingData?.length || 0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const generateTemplate = () => {
    if (mergeTags.length === 0) {
      toast({
        title: "No template selected",
        description: "Please select a template first to see required fields",
        variant: "destructive",
      });
      return;
    }

    // Create CSV header from merge tags
    const headers = mergeTags.map(tag => tag.replace(/[{}]/g, ''));
    const csvContent = headers.join(',') + '\n';
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audience_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Template downloaded",
      description: "Fill in the CSV with your audience data",
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid file",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setUploadProgress(10); // Start with initial progress

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        
        setUploadProgress(50); // Parsing complete
        
        if (data.length === 0) {
          toast({
            title: "Empty file",
            description: "The CSV file is empty",
            variant: "destructive",
          });
          setIsProcessing(false);
          return;
        }

        // Validate that required columns exist
        const requiredColumns = mergeTags.map(tag => tag.replace(/[{}]/g, ''));
        const fileColumns = Object.keys(data[0]);
        const missingColumns = requiredColumns.filter(col => !fileColumns.includes(col));

        setUploadProgress(75); // Validation complete

        if (missingColumns.length > 0) {
          toast({
            title: "Missing columns",
            description: `The CSV is missing these required columns: ${missingColumns.join(', ')}`,
            variant: "destructive",
          });
          setIsProcessing(false);
          return;
        }

        setFileName(file.name);
        setRowCount(data.length);
        setUploadProgress(100);
        onDataLoaded(data);
        
        toast({
          title: "File uploaded",
          description: `Loaded ${data.length} recipients`,
        });
        
        setTimeout(() => {
          setIsProcessing(false);
          setUploadProgress(0);
        }, 500);
      },
      error: (error) => {
        toast({
          title: "Parse error",
          description: error.message,
          variant: "destructive",
        });
        setIsProcessing(false);
        setUploadProgress(0);
      }
    });

    // Reset input
    event.target.value = '';
  };

  const clearData = () => {
    setFileName("");
    setRowCount(0);
    onDataLoaded([]);
    toast({
      title: "Cleared",
      description: "Audience data has been cleared",
    });
  };

  return (
    <div className="space-y-4">
      {disabled && existingData && existingData.length > 0 && (
        <div className="p-4 border rounded-lg bg-muted">
          <p className="text-sm font-medium">
            ✓ {existingData.length} participant{existingData.length > 1 ? 's' : ''} pre-selected
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Available fields: {Object.keys(existingData[0] || {})
              .filter(k => !k.startsWith('_') && k !== 'id' && k !== 'created_at' && k !== 'updated_at')
              .slice(0, 8)
              .join(', ')}
            {Object.keys(existingData[0] || {}).length > 8 ? '...' : ''}
          </p>
        </div>
      )}
      
      <div className="space-y-2">
        <Label>Required Fields</Label>
        <div className="flex flex-wrap gap-2">
          {mergeTags.length > 0 ? (
            mergeTags.map((tag) => (
              <span key={tag} className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-sm">
                {tag.replace(/[{}]/g, '')}
              </span>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Select a template to see required fields</p>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={generateTemplate}
          disabled={mergeTags.length === 0 || disabled}
        >
          <Download className="mr-2 h-4 w-4" />
          Download Template
        </Button>

        <Label htmlFor="csv-upload" className={disabled ? "pointer-events-none opacity-50" : "cursor-pointer"}>
          <Button
            type="button"
            variant="outline"
            disabled={mergeTags.length === 0 || disabled}
            asChild
          >
            <span>
              <Upload className="mr-2 h-4 w-4" />
              Upload CSV
            </span>
          </Button>
        </Label>
        <Input
          id="csv-upload"
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileUpload}
          disabled={mergeTags.length === 0 || disabled}
        />
      </div>

      {isProcessing && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Processing CSV...</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300" 
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {rowCount > 0 && !isProcessing && (
        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted">
          <div>
            <p className="text-sm font-medium">{fileName || "Audience data loaded"}</p>
            <p className="text-xs text-muted-foreground">{rowCount} recipients</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearData}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
