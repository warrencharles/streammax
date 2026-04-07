import axios from 'axios';

async function research() {
    try {
        const response = await axios.get('https://www.princetv.online/assets/index-B6WlnDNv.js');
        const content = response.data;
        
        console.log('--- Content Length:', content.length);
        
        // Find URLs
        const urlRegex = /https?:\/\/[a-zA-Z0-9.\/_-]+/g;
        const urls = content.match(urlRegex) || [];
        const uniqueUrls = [...new Set(urls)];
        
        console.log('--- Unique URLs found:', uniqueUrls.length);
        console.log('--- DRM/Player related candidates:');
        uniqueUrls.filter(u => 
            u.includes('license') || 
            u.includes('proxy') || 
            u.includes('widevine') || 
            u.includes('drm') || 
            u.includes('stream') ||
            u.includes('player')
        ).forEach(u => console.log(u));

        // Search for 'com.widevine.alpha' context
        const pos = content.indexOf('com.widevine.alpha');
        if (pos !== -1) {
            console.log('\n--- Widevine Config Context (500 chars) ---');
            console.log(content.substring(pos - 100, pos + 400));
        }

        // Search for 'globalToken' context
        const tPos = content.indexOf('globalToken');
        if (tPos !== -1) {
            console.log('\n--- globalToken Context (500 chars) ---');
            console.log(content.substring(tPos - 100, tPos + 400));
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}

research();
