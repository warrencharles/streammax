import axios from 'axios';

async function research() {
    try {
        const response = await axios.get('https://www.princetv.online/assets/index-B6WlnDNv.js');
        const content = response.data;
        
        console.log('--- Content Length:', content.length);
        
        // Find all URLs
        const urlRegex = /https?:\/\/[a-zA-Z0-9.\/_-]+/g;
        const urls = content.match(urlRegex) || [];
        const uniqueUrls = [...new Set(urls)];
        
        console.log('--- Unique URLs found:', uniqueUrls.length);
        console.log('--- DRM/Player related URLs:');
        uniqueUrls.filter(u => u.includes('player') || u.includes('drm') || u.includes('license') || u.includes('widevine') || u.includes('stream')).forEach(u => console.log(u));

        // Find common player keywords
        const keywords = ['dashjs', 'shaka', 'clappr', 'player', 'videojs', 'laurl', 'widevine', 'robustness'];
        console.log('--- Keyword Contexts:');
        keywords.forEach(kw => {
            const index = content.toLowerCase().indexOf(kw.toLowerCase());
            if (index !== -1) {
                console.log(`[${kw}] found at ${index}: ${content.substring(index - 50, index + 100)}`);
            }
        });

    } catch (err) {
        console.error('Error:', err.message);
    }
}

research();
