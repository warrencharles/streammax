const axios = require('axios');

async function probe() {
    try {
        const response = await axios.get('https://www.football-data.org/coverage', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        const html = response.data;
        console.log("HTML Length:", html.length);

        // Look for anything that looks like a token or an API call
        const matches = html.match(/v[0-9]\/competitions\/[A-Z0-9_$]*/g);
        console.log("Competition matches:", matches);

        const scripts = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/g);
        console.log("Found scripts:", scripts ? scripts.length : 0);

        if (scripts) {
            scripts.forEach((s, i) => {
                if (s.includes('token') || s.includes('X-Auth-Token') || s.includes('api.football-data.org')) {
                    console.log(`Script ${i} snippet:`, s.substring(0, 500));
                }
            });
        }

        // Write to file for further inspection
        require('fs').writeFileSync('coverage_source.html', html);
        console.log("Saved to coverage_source.html");

    } catch (error) {
        console.error("Error:", error.message);
    }
}

probe();
