import axios from 'axios';

async function findQueries() {
    try {
        const response = await axios.get('https://www.princetv.online/assets/index-B6WlnDNv.js');
        const content = response.data;
        
        const patterns = [
            /\.from\s*\(\s*["']([^"']+)["']\s*\)\s*\.select\s*\(\s*["']([^"']+)["']\s*\)/g,
            /\.allTiles\.(?:filter|map)\s*\(\s*([^)]+)\s*\)/g
        ];
        
        for (const pattern of patterns) {
            const matches = content.match(pattern);
            console.log(`Pattern ${pattern} matches:`, matches ? matches.slice(0, 10) : 'None');
        }

    } catch (err) {
        console.error(err.message);
    }
}

findQueries();
