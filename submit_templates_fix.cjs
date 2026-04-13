const https = require('https');

const auth = Buffer.from('c8db90a5c6402bd34af37520847a4fef3ef6bcdd4e342c9c:b06e159031e0a55e71a599ac003d56ea62a91cf18f1c6b3b').toString('base64');
const wabaId = '861418006766311';
const sid = 'ecrtechnicalinnovations1';

// Fixed templates - resolved "variables at start/end" and "too many variables" issues
const templates = [
  {
    name: 'leave_approved',
    category: 'UTILITY',
    body: 'Hi {{1}}, your {{2}} leave request from {{3}} to {{4}} has been approved. Approved by {{5}}. No further action is needed.',
    examples: ['Priya', 'casual', '01-Apr-2026', '03-Apr-2026', 'Rahul Kumar']
  },
  {
    name: 'leave_rejected',
    category: 'UTILITY',
    body: 'Hi {{1}}, your {{2}} leave request from {{3}} to {{4}} has been rejected. Rejected by {{5}}. Please contact your manager for more details.',
    examples: ['Priya', 'casual', '01-Apr-2026', '03-Apr-2026', 'Rahul Kumar']
  },
  {
    name: 'regularization_approved',
    category: 'UTILITY',
    body: 'Hi {{1}}, your attendance regularization request for {{2}} has been approved by {{3}}. Your attendance has been updated.',
    examples: ['Priya', '28-Mar-2026', 'Rahul Kumar']
  },
  {
    name: 'regularization_rejected',
    category: 'UTILITY',
    body: 'Hi {{1}}, your attendance regularization request for {{2}} has been rejected by {{3}}. Please contact your manager for details.',
    examples: ['Priya', '28-Mar-2026', 'Rahul Kumar']
  },
  {
    name: 'task_assigned',
    category: 'UTILITY',
    body: 'Hi {{1}}, a new task has been assigned to you: *{{2}}*. Priority: {{3}}. Due date: {{4}}. Please log in to view details.',
    examples: ['Priya', 'Complete vendor onboarding', 'High', '05-Apr-2026']
  },
  {
    name: 'lead_assigned',
    category: 'UTILITY',
    body: 'Hi {{1}}, a new lead has been assigned to you - *{{2}}* from {{3}}. Contact number: {{4}}. Please follow up at the earliest.',
    examples: ['Priya', 'Amit Sengupta', 'Redefine Marcom', '9876543210']
  },
  {
    name: 'followup_reminder',
    category: 'UTILITY',
    body: 'Hi {{1}}, you have a follow-up due today with *{{2}}* from {{3}}. Last disposition: {{4}}. Please take action.',
    examples: ['Priya', 'Amit Sengupta', 'Redefine Marcom', 'Interested']
  },
  {
    name: 'call_summary_notification',
    category: 'UTILITY',
    body: 'Hi {{1}}, your call with {{2}} lasting {{3}} minutes has been analyzed. Sentiment: {{4}}. Please log in to view the full summary.',
    examples: ['Priya', 'Amit Sengupta', '5', 'Positive']
  },
  {
    name: 'quotation_sent_notification',
    category: 'UTILITY',
    body: 'Hi {{1}}, quotation {{2}} worth Rs. {{3}} has been sent to {{4}}. Please track the payment status in the portal.',
    examples: ['Priya', 'QT-2026-001', '50000', 'Redefine Marcom']
  },
  {
    name: 'payment_received',
    category: 'UTILITY',
    body: 'Hi {{1}}, a payment of Rs. {{2}} has been received for project {{3}} from {{4}}. Please verify in the portal.',
    examples: ['Priya', '25000', 'Website Redesign', 'Redefine Marcom']
  },
  {
    name: 'expense_approved',
    category: 'UTILITY',
    body: 'Hi {{1}}, your expense claim of Rs. {{2}} for {{3}} has been reviewed by {{4}}. Please check the portal for the updated status.',
    examples: ['Priya', '5000', 'Client visit to Mumbai', 'Rahul Kumar']
  },
  {
    name: 'welcome_onboarding',
    category: 'UTILITY',
    body: 'Welcome to the team, {{1}}! Your account at {{2}} has been created. Please visit the portal to complete your onboarding process.',
    examples: ['Priya Sharma', 'Redefine Marcom']
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
  console.log(`Resubmitting ${templates.length} fixed templates...\n`);
  for (const t of templates) {
    await submitTemplate(t);
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('\nDone!');
})();
