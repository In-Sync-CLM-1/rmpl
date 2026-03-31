/**
 * Submit all 6 WhatsApp utility templates to Exotel/Meta for approval.
 * Run: node submit-wa-templates.cjs
 */

const SUPABASE_URL = 'https://ltlvhmwrrsromwuiybwu.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0bHZobXdycnNyb213dWl5Ynd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzk0OTUsImV4cCI6MjA4ODY1NTQ5NX0.VrY_nFei4c-LBWtS_9LP9xtAK2eS2L19Iy0M7V-Vqq0';

// You need a valid user session token. Get one by logging in first.
// Replace this with a valid access_token from a logged-in admin session.
const ACCESS_TOKEN = process.argv[2];

if (!ACCESS_TOKEN) {
  console.error('Usage: node submit-wa-templates.cjs <access_token>');
  console.error('Get your access token from browser DevTools > Application > supabase auth token');
  process.exit(1);
}

const TEMPLATES = [
  {
    name: 'rmpl_daily_project_summary',
    category: 'UTILITY',
    language: 'en',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Daily Project Summary' },
      {
        type: 'BODY',
        text: 'Projects today: {{1}} new, {{2}} updated, {{3}} lost.\n\nActive pipeline: {{4}} projects worth ₹{{5}}.',
        example: { body_text: [['3', '5', '1', '42', '2.5Cr']] },
      },
      { type: 'FOOTER', text: 'RMPL OPM - Redefine Marcom' },
    ],
  },
  {
    name: 'rmpl_daily_cashflow_summary',
    category: 'UTILITY',
    language: 'en',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Daily Cashflow Summary' },
      {
        type: 'BODY',
        text: 'Invoiced: ₹{{1}} | Received: ₹{{2}} | Pending: ₹{{3}}\n\nToday: {{4}} new invoice(s) worth ₹{{5}}.',
        example: { body_text: [['1.2Cr', '80L', '40L', '2', '5L']] },
      },
      { type: 'FOOTER', text: 'RMPL OPM - Redefine Marcom' },
    ],
  },
  {
    name: 'rmpl_daily_demandcom_summary',
    category: 'UTILITY',
    language: 'en',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Daily DemandCom Summary' },
      {
        type: 'BODY',
        text: 'Calls: {{1}} | Registrations: {{2}}\n\nTop performer: {{3}} ({{4}} calls)\nProjects below 50% target: {{5}}',
        example: { body_text: [['320', '45', 'Prateek', '52', '3']] },
      },
      { type: 'FOOTER', text: 'RMPL OPM - Redefine Marcom' },
    ],
  },
  {
    name: 'rmpl_weekly_pipeline_summary',
    category: 'UTILITY',
    language: 'en',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Weekly Pipeline Summary' },
      {
        type: 'BODY',
        text: 'This week: {{1}} new projects\nWon: {{2}} | Lost: {{3}}\n\nActive pipeline: {{4}} projects worth ₹{{5}}.',
        example: { body_text: [['8', '3 (15L)', '2 (8L)', '42', '2.5Cr']] },
      },
      { type: 'FOOTER', text: 'RMPL OPM - Redefine Marcom' },
    ],
  },
  {
    name: 'rmpl_weekly_team_performance',
    category: 'UTILITY',
    language: 'en',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Weekly Team Performance' },
      {
        type: 'BODY',
        text: 'Active team members: {{1}}\nTop project owners: {{2}}\n\nUnassigned clients: {{3}}\nNew clients this week: {{4}}',
        example: { body_text: [['18', 'Gaurav:8, Prateek:6, Pulkit:5', '23', '12']] },
      },
      { type: 'FOOTER', text: 'RMPL OPM - Redefine Marcom' },
    ],
  },
  {
    name: 'rmpl_weekly_overdue_alert',
    category: 'UTILITY',
    language: 'en',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Weekly Attention Required' },
      {
        type: 'BODY',
        text: 'Stale projects (no update 7+ days): {{1}}\nEvent projects without dates: {{2}}\nOverdue tasks: {{3}}\nInvoices pending 30+ days: {{4}}',
        example: { body_text: [['5', '2', '8', '3']] },
      },
      { type: 'FOOTER', text: 'RMPL OPM - Redefine Marcom' },
    ],
  },
];

async function submitTemplate(template) {
  console.log(`\nSubmitting: ${template.name}...`);

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/create-whatsapp-template`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify(template),
  });

  const result = await resp.json();

  if (result.success) {
    console.log(`  ✅ ${template.name} → ID: ${result.templateId} (pending approval)`);
  } else {
    console.log(`  ❌ ${template.name} → ${result.error}`);
    if (result.details) console.log(`     Details:`, JSON.stringify(result.details).slice(0, 200));
  }

  return result;
}

async function main() {
  console.log('=== Submitting 6 WhatsApp Utility Templates ===');
  console.log(`Target: ${SUPABASE_URL}`);
  console.log('');

  const results = [];
  for (const template of TEMPLATES) {
    const result = await submitTemplate(template);
    results.push({ name: template.name, ...result });
    // Small delay between submissions
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n=== Summary ===');
  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`Submitted: ${success} | Failed: ${failed}`);
  console.log('\nTemplates need Meta approval (up to 24h). Check WhatsApp Settings > Templates in the app.');
}

main().catch(console.error);
