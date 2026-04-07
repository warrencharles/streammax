import axios from 'axios';

async function extractDRMConfig() {
    try {
        const response = await axios.get('https://www.princetv.online/assets/index-B6WlnDNv.js');
        const content = response.data;
        
        console.log('--- Searching for DRM Configuration ---');
        
        // Find 'com.widevine.alpha' context
        const widevinePos = content.indexOf('com.widevine.alpha');
        if (widevinePos !== -1) {
            console.log('\n--- Widevine Context (500 chars) ---');
            console.log(content.substring(widevinePos - 250, widevinePos + 1000));
        }

        // Search for serverURL or licenseServer
        const serverURLPos = content.indexOf('serverURL');
        if (serverURLPos !== -1) {
            console.log('\n--- serverURL Context ---');
            console.log(content.substring(serverURLPos - 100, serverURLPos + 300));
        }

        // Search for the specific 'laurl' keyword often used in dash.js/shaka
        const laurlPos = content.indexOf('laurl');
        if (laurlPos !== -1) {
            console.log('\n--- laurl Context ---');
            console.log(content.substring(laurlPos - 100, laurlPos + 300));
        }

        // Find common License Acquisition URLs patterns
        const urlRegex = /https?:\/\/[a-z0-9-.]+\/[a-z0-9-._\/]*license[a-z0-9-._\/]*/gi;
        const matches = content.match(urlRegex);
        if (matches) {
            console.log('\n--- Possible License Server URLs ---');
            console.log([...new Set(matches)]);
        }

    } catch (err) {
        console.error('Error fetching JS:', err.message);
    }
}

extractDRMConfig();
