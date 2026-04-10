const fs = require('fs');
const https = require('https');

const PROJECT_REF = 'ltlvhmwrrsromwuiybwu';
const SBP_TOKEN = 'sbp_68e70c187e18c25ba82fc27a13585372ef8c7ad2';

const sql = fs.readFileSync('./supabase/migrations/20260329160000_unify_project_checklists.sql', 'utf8');

const body = JSON.stringify({ query: sql });

const options = {
  hostname: 'api.supabase.com',
  path: `/v1/projects/${PROJECT_REF}/database/query`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SBP_TOKEN}`,
    'Content-Length': Buffer.byteLength(body),
  },
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
    } catch {
      console.log(data);
    }
  });
});

req.on('error', (err) => console.error('Request error:', err.message));
req.write(body);
req.end();
