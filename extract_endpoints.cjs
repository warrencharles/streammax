const axios = require('axios');

async function extractEndpoints() {
    try {
        const response = await axios.get('https://hdtodayz.to/js/group_1/app.min.js?v=0.2', {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://hdtodayz.to/'
            }
        });
        const js = response.data;

        console.log("Searching for get_source pattern...");
        const getSourceMatches = js.match(/get_source\s*=\s*function\s*\(\s*(\w+)\s*\)\s*\{.*?\}/g);
        if (getSourceMatches) {
            getSourceMatches.forEach(m => console.log("Found get_source:", m.substring(0, 200)));
        } else {
            console.log("No explicit get_source function found.");
        }

        console.log("\nSearching for all ajax strings...");
        const ajaxMatches = js.match(/\/ajax\/[\w\/\-]+/g);
        if (ajaxMatches) {
            const unique = [...new Set(ajaxMatches)];
            console.log("Unique AJAX paths found:", unique);
        }

        console.log("\nSearching for GET/POST patterns...");
        const requestMatches = js.match(/\$\.(get|post)\s*\(\s*["']([^"']+)["']/g);
        if (requestMatches) {
            requestMatches.forEach(m => console.log("Request:", m));
        }
    } catch (err) {
        console.error("Error:", err.message);
    }
}

extractEndpoints();
