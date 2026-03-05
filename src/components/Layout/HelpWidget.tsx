import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface HelpWidgetProps {
  userName?: string;
  userEmail?: string;
  companyName?: string;
}

export function HelpWidget({ userName, userEmail, companyName }: HelpWidgetProps) {
  const queryClient = useQueryClient();
  const interceptSetup = useRef(false);

  useEffect(() => {
    // Auto-fill widget fields when it's ready
    const fillWidget = () => {
      const widget = document.querySelector('[data-source="redefine"]') as HTMLElement;
      if (!widget) return;

      // Try to fill form fields after a delay (widget may load async)
      setTimeout(() => {
        const nameInput = document.querySelector('input[name="name"], input[placeholder*="name" i]') as HTMLInputElement;
        const emailInput = document.querySelector('input[name="email"], input[placeholder*="email" i]') as HTMLInputElement;
        const companyInput = document.querySelector('input[name="company"], input[placeholder*="company" i]') as HTMLInputElement;

        if (nameInput && userName) nameInput.value = userName;
        if (emailInput && userEmail) emailInput.value = userEmail;
        if (companyInput && companyName) companyInput.value = companyName;
      }, 1000);
    };

    fillWidget();

    // Intercept fetch to detect ticket creation
    if (!interceptSetup.current) {
      interceptSetup.current = true;
      const originalFetch = window.fetch;

      window.fetch = async function (...args) {
        const response = await originalFetch.apply(this, args);

        try {
          const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url;
          if (url && url.includes('submit-help-ticket')) {
            // Clone response to read body without consuming it
            const clone = response.clone();
            const data = await clone.json();

            if (data && data.id) {
              // Sync ticket locally
              syncTicketLocally(data);
            }
          }
        } catch {
          // Silently ignore intercept errors
        }

        return response;
      };

      return () => {
        window.fetch = originalFetch;
      };
    }
  }, [userName, userEmail, companyName]);

  const syncTicketLocally = async (ticketData: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.functions.invoke('sync-help-ticket', {
        body: { ticketData },
      });

      // Invalidate tickets cache for instant refresh
      queryClient.invalidateQueries({ queryKey: ['crm-tickets'] });
    } catch (error) {
      console.error('Failed to sync ticket locally:', error);
    }
  };

  // The widget is already loaded via index.html script tag
  // This component only handles auto-fill and fetch interception
  return null;
}
