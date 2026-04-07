import axios from 'axios';

async function deepSearch() {
    try {
        const response = await axios.get('https://www.princetv.online/assets/index-B6WlnDNv.js');
        const content = response.data;
        
        const patterns = [
            'licenseServer',
            'serverURL',
            'com.widevine.alpha',
            'laurl',
            'keySystem',
            'clearkey',
            'streamUrl',
            'azam'
        ];

        for (const p of patterns) {
            let pos = -1;
            let count = 0;
            while ((pos = content.indexOf(p, pos + 1)) !== -1 && count < 5) {
                count++;
                console.log(`\n--- [${p}] @ ${pos} ---`);
                console.log(content.substring(Math.max(0, pos - 80), pos + 200));
            }
        }

    } catch (err) {
        console.error(err.message);
    }
}

deepSearch();
