import axios from 'axios';

async function findResolution() {
    try {
        const response = await axios.get('https://www.princetv.online/assets/index-B6WlnDNv.js');
        const content = response.data;
        
        // Find UUID pattern and see context
        const uuidMatch = content.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        console.log('Sample UUID found in JS:', uuidMatch ? uuidMatch[0] : 'None');

        // Look for Supabase queries with filters
        const queries = content.match(/\.from\(\s*["']([^"']+)["']\s*\)(?:\.[a-z]+\([^)]+\))*/g);
        console.log('Discovered Supabase queries (first 10):', queries ? queries.slice(0, 10).map(q => q.substring(0, 100)) : 'None');

        // Look for the specific channel component logic
        const channelLogic = content.match(/watch\/:([a-z0-9_]+)/i);
        console.log('Watch route param name:', channelLogic ? channelLogic[1] : 'Not found');

        // Check for .rpc() calls which are often used for stream resolution
        const rpcCalls = content.match(/\.rpc\(\s*["']([^"']+)["']\s*/g);
        console.log('RPC calls found:', rpcCalls || 'None');

    } catch (err) {
        console.error(err.message);
    }
}

findResolution();
