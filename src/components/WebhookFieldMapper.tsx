import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";

export interface FieldMapping {
  id: string;
  sourceField: string;
  targetField: string;
  transform: string;
}

interface WebhookFieldMapperProps {
  mappings: FieldMapping[];
  onChange: (mappings: FieldMapping[]) => void;
  targetTable: string;
}

const TABLE_COLUMNS: Record<string, { field: string; label: string; type: string }[]> = {
  demandcom: [
    { field: "first_name", label: "First Name", type: "text" },
    { field: "last_name", label: "Last Name", type: "text" },
    { field: "email", label: "Email", type: "email" },
    { field: "phone", label: "Phone", type: "text" },
    { field: "specialty", label: "Specialty", type: "text" },
    { field: "location_city", label: "City", type: "text" },
    { field: "location_state", label: "State", type: "text" },
    { field: "location_zip", label: "ZIP Code", type: "text" },
    { field: "license_type", label: "License Type", type: "text" },
    { field: "license_number", label: "License Number", type: "text" },
    { field: "license_state", label: "License State", type: "text" },
    { field: "years_experience", label: "Years Experience", type: "number" },
    { field: "availability", label: "Availability", type: "text" },
  ],
  projects: [
    { field: "title", label: "Project Title", type: "text" },
    { field: "description", label: "Description", type: "text" },
    { field: "specialty", label: "Specialty", type: "text" },
    { field: "location_city", label: "City", type: "text" },
    { field: "location_state", label: "State", type: "text" },
    { field: "location_zip", label: "ZIP Code", type: "text" },
    { field: "salary_min", label: "Minimum Salary", type: "number" },
    { field: "salary_max", label: "Maximum Salary", type: "number" },
    { field: "license_required", label: "License Required", type: "text" },
  ],
  master: [
    { field: "mobile_numb", label: "Mobile Number", type: "text" },
    { field: "name", label: "Name", type: "text" },
    { field: "designation", label: "Designation", type: "text" },
    { field: "company_name", label: "Company Name", type: "text" },
    { field: "personal_email_id", label: "Personal Email", type: "email" },
    { field: "generic_email_id", label: "Generic Email", type: "email" },
    { field: "official", label: "Official Email", type: "email" },
    { field: "city", label: "City", type: "text" },
    { field: "state", label: "State", type: "text" },
    { field: "pincode", label: "Pincode", type: "text" },
  ],
};

const TRANSFORM_OPTIONS = [
  { value: "none", label: "None" },
  { value: "lowercase", label: "Lowercase" },
  { value: "uppercase", label: "Uppercase" },
  { value: "trim", label: "Trim Whitespace" },
  { value: "trim_lowercase", label: "Trim & Lowercase" },
];

export function WebhookFieldMapper({ mappings, onChange, targetTable }: WebhookFieldMapperProps) {
  const availableColumns = TABLE_COLUMNS[targetTable] || [];

  const addMapping = () => {
    const newMapping: FieldMapping = {
      id: crypto.randomUUID(),
      sourceField: "",
      targetField: availableColumns[0]?.field || "",
      transform: "none",
    };
    onChange([...mappings, newMapping]);
  };

  const removeMapping = (id: string) => {
    onChange(mappings.filter((m) => m.id !== id));
  };

  const updateMapping = (id: string, field: keyof FieldMapping, value: string) => {
    onChange(
      mappings.map((m) =>
        m.id === id ? { ...m, [field]: value } : m
      )
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Field Mappings</Label>
        <Button type="button" onClick={addMapping} size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Add Mapping
        </Button>
      </div>

      {mappings.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
          No field mappings yet. Click "Add Mapping" to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {mappings.map((mapping, index) => (
            <div key={mapping.id} className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Mapping {index + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMapping(mapping.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Source Field (from webhook)</Label>
                  <Input
                    placeholder="e.g., firstName, user.email, contact.address.city, data[0].name"
                    value={mapping.sourceField}
                    onChange={(e) => updateMapping(mapping.id, "sourceField", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    💡 Use dot notation for nested fields: <code className="bg-muted px-1 rounded">user.email</code> or arrays: <code className="bg-muted px-1 rounded">data[0].name</code>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Target Field (database column)</Label>
                  <Select
                    value={mapping.targetField}
                    onValueChange={(value) => updateMapping(mapping.id, "targetField", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableColumns.map((col) => (
                        <SelectItem key={col.field} value={col.field}>
                          {col.label} ({col.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Transform</Label>
                  <Select
                    value={mapping.transform}
                    onValueChange={(value) => updateMapping(mapping.id, "transform", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSFORM_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Map fields from the incoming webhook payload to your database columns. Transformations are applied to clean the data.
      </p>
    </div>
  );
}
