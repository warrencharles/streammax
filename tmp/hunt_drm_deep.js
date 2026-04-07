import axios from 'axios';

async function huntDRM() {
    try {
        const response = await axios.get('https://www.princetv.online/assets/index-B6WlnDNv.js');
        const content = response.data;
        
        console.log('--- Searching for DRM Proxy/License Patterns ---');
        
        const patterns = [
            'license',
            'widevine',
            'proxy',
            'laurl',
            'com.widevine.alpha',
            'keySystems',
            'authorization',
            'bearer'
        ];

        patterns.forEach(p => {
            let pos = -1;
            while ((pos = content.indexOf(p, pos + 1)) !== -1) {
                // Get context
                const context = content.substring(Math.max(0, pos - 100), pos + 300);
                if (context.includes('https://') || context.includes('dashjs') || context.includes('player')) {
                    console.log(`\n--- [${p}] @ ${pos} ---`);
                    console.log(context);
                }
            }
        });

    } catch (err) {
        console.error(err.message);
    }
}

huntDRM();
