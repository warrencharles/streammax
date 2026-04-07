import axios from 'axios';

async function deepSearch() {
    try {
        const response = await axios.get('https://www.princetv.online/assets/index-B6WlnDNv.js');
        const content = response.data;
        
        console.log('--- Deep Search for Player/Embed/Proxy ---');
        
        // Find URLs containing key providers
        const urlRegex = /https?:\/\/[a-z0-9-.]+(?:\/|:[0-9]+)[a-z0-9-._\/]*/gi;
        const urls = content.match(urlRegex) || [];
        const interestingUrls = [...new Set(urls)].filter(u => 
            u.includes('proxy') || 
            u.includes('license') || 
            u.includes('widevine') || 
            u.includes('azam') || 
            u.includes('stream') || 
            u.includes('player') ||
            u.includes('embed')
        );
        
        console.log('Interesting URLs found:', interestingUrls);

        // Find string templates or paths
        const paths = content.match(/["']\/[a-z0-9._\/]*["']/gi) || [];
        const interestingPaths = [...new Set(paths)].filter(p => 
            p.includes('embed') || 
            p.includes('player') || 
            p.includes('stream') || 
            p.includes('watch')
        );
        
        console.log('Interesting Paths found:', interestingPaths);

        // Search for the license configuration object segment
        // looking for com.widevine.alpha with a serverURL
        const wvIndex = content.indexOf('com.widevine.alpha');
        if (wvIndex !== -1) {
            console.log('\n--- com.widevine.alpha context (1000 chars) ---');
            console.log(content.substring(wvIndex - 200, wvIndex + 800));
        }

    } catch (err) {
        console.error(err.message);
    }
}

deepSearch();
