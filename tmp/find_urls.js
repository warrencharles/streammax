import axios from 'axios';

async function findUrls() {
    try {
        const response = await axios.get('https://www.princetv.online/assets/index-B6WlnDNv.js');
        const content = response.data;
        
        // Find all URLs
        const urlMatches = content.match(/https?:\/\/[a-z0-9-.]+\.[a-z]{2,}(?:\/[^"'\s]*)?/gi);
        console.log('Unique URLs (subset):', [...new Set(urlMatches)].filter(u => !u.includes('npmjs') && !u.includes('reactjs') && !u.includes('vitejs') && !u.includes('google') && !u.includes('facebook')));
        
    } catch (err) {
        console.error(err.message);
    }
}

findUrls();
