const https = require('https');

const auth = Buffer.from('c8db90a5c6402bd34af37520847a4fef3ef6bcdd4e342c9c:b06e159031e0a55e71a599ac003d56ea62a91cf18f1c6b3b').toString('base64');
const wabaId = '861418006766311';
const sid = 'ecrtechnicalinnovations1';

const templates = [
  {
    name: 'leave_request_submitted',
    category: 'UTILITY',
    body: 'Hi {{1}}, {{2}} has applied for {{3}} leave from {{4}} to {{5}}. Please review and approve/reject.',
    examples: ['Rahul', 'Priya Sharma', 'casual', '01-Apr-2026', '03-Apr-2026']
  },
  {
    name: 'leave_approved',
    category: 'UTILITY',
    body: 'Hi {{1}}, your {{2}} leave from {{3}} to {{4}} has been approved by {{5}}.',
    examples: ['Priya', 'casual', '01-Apr-2026', '03-Apr-2026', 'Rahul Kumar']
  },
  {
    name: 'leave_rejected',
    category: 'UTILITY',
    body: 'Hi {{1}}, your {{2}} leave from {{3}} to {{4}} has been rejected by {{5}}. Reason: {{6}}',
    examples: ['Priya', 'casual', '01-Apr-2026', '03-Apr-2026', 'Rahul Kumar', 'Insufficient leave balance']
  },
  {
    name: 'regularization_submitted',
    category: 'UTILITY',
    body: 'Hi {{1}}, {{2}} has submitted an attendance regularization request for {{3}}. Please review.',
    examples: ['Rahul', 'Priya Sharma', '28-Mar-2026']
  },
  {
    name: 'regularization_approved',
    category: 'UTILITY',
    body: 'Hi {{1}}, your attendance regularization for {{2}} has been approved by {{3}}.',
    examples: ['Priya', '28-Mar-2026', 'Rahul Kumar']
  },
  {
    name: 'regularization_rejected',
    category: 'UTILITY',
    body: 'Hi {{1}}, your attendance regularization for {{2}} has been rejected by {{3}}. Reason: {{4}}',
    examples: ['Priya', '28-Mar-2026', 'Rahul Kumar', 'No valid reason provided']
  },
  {
    name: 'late_coming_alert',
    category: 'UTILITY',
    body: 'Hi {{1}}, you signed in at {{2}} on {{3}} which is past the scheduled time. Please regularize if needed.',
    examples: ['Priya', '10:15 AM', '31-Mar-2026']
  },
  {
    name: 'salary_slip_ready',
    category: 'UTILITY',
    body: 'Hi {{1}}, your salary slip for {{2}} is now available. Please log in to the portal to view and download it.',
    examples: ['Priya', 'March 2026']
  },
  {
    name: 'task_assigned',
    category: 'UTILITY',
    body: 'Hi {{1}}, a new task has been assigned to you: *{{2}}*. Priority: {{3}}. Due: {{4}}.',
    examples: ['Priya', 'Complete vendor onboarding', 'High', '05-Apr-2026']
  },
  {
    name: 'task_due_reminder',
    category: 'UTILITY',
    body: 'Hi {{1}}, your task *{{2}}* is due in 24 hours ({{3}}). Please ensure it is completed on time.',
    examples: ['Priya', 'Complete vendor onboarding', '05-Apr-2026']
  },
  {
    name: 'task_overdue',
    category: 'UTILITY',
    body: 'Hi {{1}}, your task *{{2}}* was due on {{3}} and is now overdue. Please update the status.',
    examples: ['Priya', 'Complete vendor onboarding', '05-Apr-2026']
  },
  {
    name: 'task_completed_notification',
    category: 'UTILITY',
    body: 'Hi {{1}}, the task *{{2}}* assigned to {{3}} has been marked as completed.',
    examples: ['Rahul', 'Complete vendor onboarding', 'Priya Sharma']
  },
  {
    name: 'project_team_added',
    category: 'UTILITY',
    body: 'Hi {{1}}, you have been added to the project *{{2}}* as {{3}}. Log in to view project details.',
    examples: ['Priya', 'Website Redesign', 'Developer']
  },
  {
    name: 'lead_assigned',
    category: 'UTILITY',
    body: 'Hi {{1}}, a new lead has been assigned to you: *{{2}}* from {{3}}. Contact: {{4}}.',
    examples: ['Priya', 'Amit Sengupta', 'Redefine Marcom', '9876543210']
  },
  {
    name: 'followup_reminder',
    category: 'UTILITY',
    body: 'Hi {{1}}, you have a follow-up due today with *{{2}}* ({{3}}). Last disposition: {{4}}.',
    examples: ['Priya', 'Amit Sengupta', 'Redefine Marcom', 'Interested']
  },
  {
    name: 'call_summary_notification',
    category: 'UTILITY',
    body: 'Hi {{1}}, your call with {{2}} ({{3}} mins) has been analyzed. Sentiment: {{4}}. Summary: {{5}}',
    examples: ['Priya', 'Amit Sengupta', '5', 'Positive', 'Client interested in premium plan']
  },
  {
    name: 'quotation_sent_notification',
    category: 'UTILITY',
    body: 'Hi {{1}}, a quotation ({{2}}) worth Rs. {{3}} has been sent to {{4}} for project {{5}}.',
    examples: ['Priya', 'QT-2026-001', '50000', 'Redefine Marcom', 'Website Redesign']
  },
  {
    name: 'payment_received',
    category: 'UTILITY',
    body: 'Hi {{1}}, payment of Rs. {{2}} received for project {{3}} from {{4}}. Total paid: Rs. {{5}}.',
    examples: ['Priya', '25000', 'Website Redesign', 'Redefine Marcom', '50000']
  },
  {
    name: 'expense_submitted',
    category: 'UTILITY',
    body: 'Hi {{1}}, {{2}} has submitted a travel expense claim of Rs. {{3}} for {{4}}. Please review.',
    examples: ['Rahul', 'Priya Sharma', '5000', 'Client visit to Mumbai']
  },
  {
    name: 'expense_approved',
    category: 'UTILITY',
    body: 'Hi {{1}}, your expense claim of Rs. {{2}} for {{3}} has been {{4}} by {{5}}.',
    examples: ['Priya', '5000', 'Client visit to Mumbai', 'approved', 'Rahul Kumar']
  },
  {
    name: 'welcome_onboarding',
    category: 'UTILITY',
    body: 'Welcome to {{1}}, {{2}}! Your account has been created. Please complete your onboarding at {{3}}.',
    examples: ['Redefine Marcom', 'Priya Sharma', 'https://portal.example.com']
  },
  {
    name: 'password_reset_notification',
    category: 'UTILITY',
    body: 'Hi {{1}}, your password has been reset successfully. If you did not request this, please contact your admin immediately.',
    examples: ['Priya']
  },
  {
    name: 'document_verified',
    category: 'UTILITY',
    body: 'Hi {{1}}, your document *{{2}}* has been verified successfully.',
    examples: ['Priya', 'Aadhaar Card']
  },
  {
    name: 'holiday_announcement',
    category: 'UTILITY',
    body: 'Hi {{1}}, please note that {{2}} is a company holiday on {{3}}. Enjoy your day off!',
    examples: ['Priya', 'Holi', '14-Mar-2026']
  },
  {
    name: 'company_announcement',
    category: 'UTILITY',
    body: 'Hi {{1}}, new announcement from {{2}}: *{{3}}*. Log in to the portal for details.',
    examples: ['Priya', 'Redefine Marcom', 'Q1 Town Hall Meeting']
  }
];

function submitTemplate(template) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      whatsapp: {
        templates: [{
          template: {
            category: template.category,
            name: template.name,
            language: 'en',
            components: [
              {
                type: 'BODY',
                text: template.body,
                example: {
                  body_text: [template.examples]
                }
              }
            ]
          }
        }]
      }
    });

    const req = https.request({
      hostname: 'api.exotel.com',
      path: `/v2/accounts/${sid}/templates?waba_id=${wabaId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + auth,
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const tmpl = parsed?.response?.whatsapp?.templates?.[0];
          const id = tmpl?.data?.id || 'N/A';
          const status = tmpl?.data?.status || tmpl?.status || 'unknown';
          const error = tmpl?.error_data?.description || tmpl?.error_data?.message || '';
          if (error) {
            console.log(`FAIL  ${template.name}: ${error}`);
          } else {
            console.log(`OK    ${template.name}: id=${id} status=${status}`);
          }
        } catch(e) {
          console.log(`ERROR ${template.name}: ${data.substring(0, 200)}`);
        }
        resolve();
      });
    });
    req.on('error', e => { console.log(`NET_ERROR ${template.name}: ${e.message}`); resolve(); });
    req.write(payload);
    req.end();
  });
}

(async () => {
  console.log(`Submitting ${templates.length} templates to WABA ${wabaId}...\n`);
  for (const t of templates) {
    await submitTemplate(t);
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('\nDone!');
})();
