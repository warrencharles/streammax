import axios from 'axios';

async function findTables() {
    try {
        const response = await axios.get('https://www.princetv.online/assets/index-B6WlnDNv.js');
        const content = response.data;
        
        // Pattern for Supabase .from("table")
        const fromMatches = content.match(/\.from\(\s*["']([^"']+)["']\s*\)/g);
        console.log('Found .from() calls:', fromMatches);
        
        // Extract names
        const tableNames = fromMatches ? fromMatches.map(m => m.match(/["']([^"']+)["']/)[1]) : [];
        console.log('Unique table names:', [...new Set(tableNames)]);

        // Look for URLs or API paths
        const fetchMatches = content.match(/fetch\(\s*["']([^"']+)["']\s*\)/g);
        console.log('Found fetch() calls:', fetchMatches ? fetchMatches.slice(0, 5) : 'None');

    } catch (err) {
        console.error(err.message);
    }
}

findTables();
