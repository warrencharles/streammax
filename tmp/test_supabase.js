import axios from 'axios';

const SUPABASE_URL = "https://qwwyyvutthpolokmvjuf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3d3l5dnV0dGhwb2xva212anVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNDIyNDksImV4cCI6MjA4ODcxODI0OX0.eN5k0NMxwcRT4t3tIKn_aBq2z2MdL0OFz5R_Jf64VO0";

async function testFetch() {
    const tables = ["matches", "channels", "sports"];
    for (const table of tables) {
        try {
            console.log(`Testing table: ${table}...`);
            const response = await axios.get(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": `Bearer ${SUPABASE_KEY}`
                },
                timeout: 5000
            });
            console.log(`Table ${table} returned ${response.data.length} items.`);
            if (response.data.length > 0) {
                console.log('First item sample:', response.data[0]);
            }
        } catch (e) {
            console.error(`Table ${table} failed: ${e.message}`);
        }
    }
}

testFetch();
