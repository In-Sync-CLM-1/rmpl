import { useMemo } from 'react';
import { useAllCSBDMetrics, CSBDMetrics } from './useCSBDMetrics';

export interface TeamHierarchy {
  managers: CSBDMetrics[];
  individuals: CSBDMetrics[];
}

export const useCSBDTeamHierarchy = (fiscalYear = 2025) => {
  const { data: allMetrics, isLoading } = useAllCSBDMetrics(fiscalYear);
  
  const hierarchy = useMemo((): TeamHierarchy => {
    if (!allMetrics) return { managers: [], individuals: [] };
    
    // Separate managers (those with team_metrics) from individuals
    const managers = allMetrics.filter(m => m.team_metrics && m.team_metrics.length > 0);
    const individuals = allMetrics.filter(m => !m.team_metrics || m.team_metrics.length === 0);
    
    return { managers, individuals };
  }, [allMetrics]);
  
  return { hierarchy, isLoading, allMetrics };
};
