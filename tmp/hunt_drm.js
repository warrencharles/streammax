import axios from 'axios';

async function huntDRM() {
    try {
        const response = await axios.get('https://www.princetv.online/assets/index-B6WlnDNv.js');
        const content = response.data;
        
        console.log('--- Searching for License/Token Patterns ---');
        
        // Find where the token is used with widevine
        const widevinePos = content.indexOf('com.widevine.alpha');
        if (widevinePos !== -1) {
            console.log('\nWidevine Config Context:');
            console.log(content.substring(widevinePos - 300, widevinePos + 1000));
        }

        // Search for license server URLs
        const licenseRegex = /https?:\/\/[a-z0-9-.]+\/[a-z0-9-._\/]*license[a-z0-9-._\/]*/gi;
        console.log('\nPossible License URLs:', [...new Set(content.match(licenseRegex))]);

        // Find the API call that returns the token
        const fetchPos = content.indexOf('globalToken');
        if (fetchPos !== -1) {
            console.log('\nToken Acquisition Context:');
            console.log(content.substring(fetchPos - 500, fetchPos + 500));
        }

    } catch (err) {
        console.error(err.message);
    }
}

huntDRM();
