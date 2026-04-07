import axios from 'axios';

async function findDRM() {
    try {
        const response = await axios.get('https://www.princetv.online/assets/index-B6WlnDNv.js');
        const content = response.data;
        
        // Search for license server URLs or key systems
        const licenseRegex = /https?:\/\/[^"'\s]*license[^"'\s]*/gi;
        const widevineRegex = /com\.widevine\.alpha/gi;
        const playReadyRegex = /com\.microsoft\.playready/gi;
        
        console.log('License Matches:', content.match(licenseRegex)?.slice(0, 5));
        console.log('Widevine Present:', widevineRegex.test(content));
        
        // Find the configuration object
        const configRegex = /\{[^}]*widevine[^}]*\}/gi;
        console.log('Possible DRM Configs:', content.match(configRegex)?.slice(0, 3));

    } catch (err) {
        console.error(err.message);
    }
}

findDRM();
