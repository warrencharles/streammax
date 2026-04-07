import https from 'https';

const SUPABASE_URL = "https://qwwyyvutthpolokmvjuf.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3d3l5dnV0dGhwb2xva212anVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNDIyNDksImV4cCI6MjA4ODcxODI0OX0.eN5k0NMxwcRT4t3tIKn_aBq2z2MdL0OFz5R_Jf64VO0";

const CHANNEL_IDS = [
  "628b250c-29df-42f2-9cb9-df637f1557db", // Azam Sports 1
  "98b50e2d-dc99-43ef-b387-052637738f61", // Azam Sports 2
];

async function callEdgeFn(channelId) {
  const body = JSON.stringify({ channelId });
  const url = new URL(`${SUPABASE_URL}/functions/v1/get-stream-config`);

  return new Promise((resolve) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
      }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        console.log(`\n[${channelId}] Status: ${res.statusCode}`);
        try { console.log('Response:', JSON.stringify(JSON.parse(data), null, 2).substring(0, 500)); }
        catch { console.log('Raw:', data.substring(0, 500)); }
        resolve(null);
      });
    });
    req.on('error', e => { console.log(`Error: ${e.message}`); resolve(null); });
    req.write(body);
    req.end();
  });
}

for (const id of CHANNEL_IDS) {
  await callEdgeFn(id);
}
