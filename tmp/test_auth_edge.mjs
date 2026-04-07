import https from 'https';

const SUPABASE_URL = "https://qwwyyvutthpolokmvjuf.supabase.co";
// From config:
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3d3l5dnV0dGhwb2xva212anVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNDIyNDksImV4cCI6MjA4ODcxODI0OX0.eN5k0NMxwcRT4t3tIKn_aBq2z2MdL0OFz5R_Jf64VO0";

async function testAuth() {
  const body = JSON.stringify({
    email: 'dhawsen_16c@buyu308.com',
    password: 'okokok'
  });

  const url = new URL(`${SUPABASE_URL}/auth/v1/token?grant_type=password`);

  return new Promise((resolve) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'apikey': ANON_KEY
      }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        console.log(`Auth Status: ${res.statusCode}`);
        try { 
            const json = JSON.parse(data);
            if (json.access_token) {
                console.log('Got Access Token:', json.access_token.substring(0, 50) + "...");
                resolve(json.access_token);
            } else {
                console.log('Error:', json);
                resolve(null);
            }
        }
        catch { 
            console.log('Raw:', data.substring(0, 500)); 
            resolve(null);
        }
      });
    });
    req.on('error', e => { console.log(`Error: ${e.message}`); resolve(null); });
    req.write(body);
    req.end();
  });
}

async function testEdgeFn(channelId, token) {
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
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        console.log(`\n[${channelId}] Stream Config Status: ${res.statusCode}`);
        try { console.log('Response:', JSON.stringify(JSON.parse(data), null, 2)); }
        catch { console.log('Raw:', data); }
        resolve(null);
      });
    });
    req.on('error', e => { console.log(`Error: ${e.message}`); resolve(null); });
    req.write(body);
    req.end();
  });
}

async function run() {
    const token = await testAuth();
    if (token) {
        await testEdgeFn("628b250c-29df-42f2-9cb9-df637f1557db", token);
    }
}
run();
