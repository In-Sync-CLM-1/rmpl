/**
 * Run this script once to register all 6 WhatsApp utility templates with Exotel/Meta.
 * Templates must be approved by Meta before they can be used for sending.
 *
 * Usage: Call the create-whatsapp-template edge function for each template.
 * This file documents the template definitions. Use the UI or API to submit them.
 */

export const TEMPLATES = [
  {
    name: 'rmpl_daily_project_summary',
    category: 'UTILITY' as const,
    language: 'en',
    components: [
      {
        type: 'HEADER' as const,
        format: 'TEXT',
        text: 'Daily Project Summary',
      },
      {
        type: 'BODY' as const,
        text: 'Projects today: {{1}} new, {{2}} updated, {{3}} lost.\n\nActive pipeline: {{4}} projects worth ₹{{5}}.',
        example: {
          body_text: [['3', '5', '1', '42', '2.5Cr']],
        },
      },
      {
        type: 'FOOTER' as const,
        text: 'RMPL OPM - Redefine Marcom',
      },
    ],
  },
  {
    name: 'rmpl_daily_cashflow_summary',
    category: 'UTILITY' as const,
    language: 'en',
    components: [
      {
        type: 'HEADER' as const,
        format: 'TEXT',
        text: 'Daily Cashflow Summary',
      },
      {
        type: 'BODY' as const,
        text: 'Invoiced: ₹{{1}} | Received: ₹{{2}} | Pending: ₹{{3}}\n\nToday: {{4}} new invoice(s) worth ₹{{5}}.',
        example: {
          body_text: [['1.2Cr', '80L', '40L', '2', '5L']],
        },
      },
      {
        type: 'FOOTER' as const,
        text: 'RMPL OPM - Redefine Marcom',
      },
    ],
  },
  {
    name: 'rmpl_daily_demandcom_summary',
    category: 'UTILITY' as const,
    language: 'en',
    components: [
      {
        type: 'HEADER' as const,
        format: 'TEXT',
        text: 'Daily DemandCom Summary',
      },
      {
        type: 'BODY' as const,
        text: 'Calls: {{1}} | Registrations: {{2}}\n\nTop performer: {{3}} ({{4}} calls)\nProjects below 50% target: {{5}}',
        example: {
          body_text: [['320', '45', 'Prateek', '52', '3']],
        },
      },
      {
        type: 'FOOTER' as const,
        text: 'RMPL OPM - Redefine Marcom',
      },
    ],
  },
  {
    name: 'rmpl_weekly_pipeline_summary',
    category: 'UTILITY' as const,
    language: 'en',
    components: [
      {
        type: 'HEADER' as const,
        format: 'TEXT',
        text: 'Weekly Pipeline Summary',
      },
      {
        type: 'BODY' as const,
        text: 'This week: {{1}} new projects\nWon: {{2}} | Lost: {{3}}\n\nActive pipeline: {{4}} projects worth ₹{{5}}.',
        example: {
          body_text: [['8', '3 (15L)', '2 (8L)', '42', '2.5Cr']],
        },
      },
      {
        type: 'FOOTER' as const,
        text: 'RMPL OPM - Redefine Marcom',
      },
    ],
  },
  {
    name: 'rmpl_weekly_team_performance',
    category: 'UTILITY' as const,
    language: 'en',
    components: [
      {
        type: 'HEADER' as const,
        format: 'TEXT',
        text: 'Weekly Team Performance',
      },
      {
        type: 'BODY' as const,
        text: 'Active team members: {{1}}\nTop project owners: {{2}}\n\nUnassigned clients: {{3}}\nNew clients this week: {{4}}',
        example: {
          body_text: [['18', 'Gaurav:8, Prateek:6, Pulkit:5', '23', '12']],
        },
      },
      {
        type: 'FOOTER' as const,
        text: 'RMPL OPM - Redefine Marcom',
      },
    ],
  },
  {
    name: 'rmpl_weekly_overdue_alert',
    category: 'UTILITY' as const,
    language: 'en',
    components: [
      {
        type: 'HEADER' as const,
        format: 'TEXT',
        text: 'Weekly Attention Required',
      },
      {
        type: 'BODY' as const,
        text: 'Stale projects (no update 7+ days): {{1}}\nEvent projects without dates: {{2}}\nOverdue tasks: {{3}}\nInvoices pending 30+ days: {{4}}',
        example: {
          body_text: [['5', '2', '8', '3']],
        },
      },
      {
        type: 'FOOTER' as const,
        text: 'RMPL OPM - Redefine Marcom',
      },
    ],
  },
];
