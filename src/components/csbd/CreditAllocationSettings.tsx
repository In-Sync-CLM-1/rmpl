import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Save, Users, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface CreditRule {
  id?: string;
  created_by_user_id: string;
  credit_to_user_id: string;
  percentage: number;
}

interface CSBDMember {
  id: string;
  full_name: string;
  email: string;
}

export function CreditAllocationSettings() {
  const queryClient = useQueryClient();
  const [newRules, setNewRules] = useState<Omit<CreditRule, 'id'>[]>([]);

  // Fetch CSBD members (users with active targets for current year)
  const { data: csbdMembers = [] } = useQuery({
    queryKey: ['csbd-members-for-credits'],
    queryFn: async () => {
      const { data } = await supabase
        .from('csbd_targets')
        .select('user_id, profiles(id, full_name, email)')
        .eq('fiscal_year', 2026)
        .eq('is_active', true);
      
      return (data || []).map((t: any) => ({
        id: t.user_id,
        full_name: t.profiles?.full_name || 'Unknown',
        email: t.profiles?.email || '',
      })) as CSBDMember[];
    },
  });

  // Fetch existing credit allocation rules
  const { data: existingRules = [], isLoading } = useQuery({
    queryKey: ['csbd-credit-allocations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('csbd_credit_allocations')
        .select('*');
      if (error) throw error;
      return data as CreditRule[];
    },
  });

  // Group rules by created_by_user_id
  const rulesByCreator = [...existingRules, ...newRules.map(r => ({ ...r, id: undefined }))].reduce((acc, rule) => {
    const key = rule.created_by_user_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(rule);
    return acc;
  }, {} as Record<string, CreditRule[]>);

  // Validate percentages per creator
  const getPercentageTotal = (creatorId: string) => {
    const rules = rulesByCreator[creatorId] || [];
    return rules.reduce((sum, r) => sum + Number(r.percentage), 0);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Validate all creators have <=100%
      for (const [creatorId, rules] of Object.entries(rulesByCreator)) {
        const total = rules.reduce((s, r) => s + Number(r.percentage), 0);
        if (total > 100) {
          const member = csbdMembers.find(m => m.id === creatorId);
          throw new Error(`${member?.full_name || 'Unknown'} has ${total}% allocated (max 100%)`);
        }
      }

      if (newRules.length > 0) {
        const { error } = await supabase
          .from('csbd_credit_allocations')
          .insert(newRules);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setNewRules([]);
      queryClient.invalidateQueries({ queryKey: ['csbd-credit-allocations'] });
      toast.success('Credit allocations saved');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('csbd_credit_allocations')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['csbd-credit-allocations'] });
      toast.success('Rule deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, percentage }: { id: string; percentage: number }) => {
      const { error } = await supabase
        .from('csbd_credit_allocations')
        .update({ percentage })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['csbd-credit-allocations'] });
      toast.success('Updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const addNewRule = () => {
    setNewRules(prev => [...prev, {
      created_by_user_id: '',
      credit_to_user_id: '',
      percentage: 50,
    }]);
  };

  const updateNewRule = (index: number, field: keyof Omit<CreditRule, 'id'>, value: string | number) => {
    setNewRules(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const removeNewRule = (index: number) => {
    setNewRules(prev => prev.filter((_, i) => i !== index));
  };

  const getMemberName = (id: string) => csbdMembers.find(m => m.id === id)?.full_name || 'Unknown';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Credit Allocation Rules
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Define how project credits are split. If no rule exists for a creator, they get 100% credit.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={addNewRule}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Rule
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Project Created By</TableHead>
                <TableHead className="text-xs">Credit Goes To</TableHead>
                <TableHead className="text-xs text-center w-28">Percentage</TableHead>
                <TableHead className="text-xs text-center w-24">Total</TableHead>
                <TableHead className="text-xs text-center w-16">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {existingRules.map((rule) => {
                const total = getPercentageTotal(rule.created_by_user_id);
                return (
                  <TableRow key={rule.id}>
                    <TableCell className="text-sm font-medium">{getMemberName(rule.created_by_user_id)}</TableCell>
                    <TableCell className="text-sm">{getMemberName(rule.credit_to_user_id)}</TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        defaultValue={rule.percentage}
                        className="w-20 h-7 text-center text-sm mx-auto"
                        onBlur={(e) => {
                          const val = Number(e.target.value);
                          if (val !== rule.percentage && val > 0 && val <= 100) {
                            updateMutation.mutate({ id: rule.id!, percentage: val });
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={total > 100 ? "destructive" : total === 100 ? "default" : "secondary"} className="text-xs">
                        {total}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteMutation.mutate(rule.id!)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}

              {newRules.map((rule, idx) => {
                const total = rule.created_by_user_id ? getPercentageTotal(rule.created_by_user_id) : 0;
                return (
                  <TableRow key={`new-${idx}`} className="bg-primary/5">
                    <TableCell>
                      <Select value={rule.created_by_user_id} onValueChange={(v) => updateNewRule(idx, 'created_by_user_id', v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select creator..." />
                        </SelectTrigger>
                        <SelectContent>
                          {csbdMembers.map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={rule.credit_to_user_id} onValueChange={(v) => updateNewRule(idx, 'credit_to_user_id', v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select recipient..." />
                        </SelectTrigger>
                        <SelectContent>
                          {csbdMembers.map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={rule.percentage}
                        onChange={(e) => updateNewRule(idx, 'percentage', Number(e.target.value))}
                        className="w-20 h-7 text-center text-sm mx-auto"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      {rule.created_by_user_id && (
                        <Badge variant={total > 100 ? "destructive" : "secondary"} className="text-xs">
                          {total}%
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeNewRule(idx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}

              {existingRules.length === 0 && newRules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    No credit allocation rules defined. All creators receive 100% credit for their projects.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Warnings for over-allocated */}
        {Object.entries(rulesByCreator).filter(([, rules]) => rules.reduce((s, r) => s + Number(r.percentage), 0) > 100).map(([creatorId]) => (
          <div key={creatorId} className="flex items-center gap-2 mt-2 text-destructive text-xs">
            <AlertTriangle className="h-3.5 w-3.5" />
            {getMemberName(creatorId)} has over 100% allocated
          </div>
        ))}

        {newRules.length > 0 && (
          <div className="flex justify-end mt-3">
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || newRules.some(r => !r.created_by_user_id || !r.credit_to_user_id)}>
              <Save className="h-3.5 w-3.5 mr-1" />
              {saveMutation.isPending ? 'Saving...' : 'Save New Rules'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
