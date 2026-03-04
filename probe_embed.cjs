const axios = require('axios');

async function probeEmbed() {
    const embedLink = "https://videostr.net/embed-1/v3/e-1/orwY6N437cn2?z=";
    try {
        console.log(`Probing: ${embedLink}`);
        const response = await axios.get(embedLink, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://hdtodayz.to/"
            }
        });

        console.log("Content length:", response.data.length);
        const m3u8Match = response.data.match(/https?:\/\/[^"']+\.m3u8[^"']*/i);
        if (m3u8Match) {
            console.log("Found m3u8:", m3u8Match[0]);
        } else {
            console.log("No m3u8 found directly in HTML.");
            // Check for scripts or base64
            if (response.data.includes("sources")) {
                console.log("Found 'sources' in HTML.");
            }
        }

        // Let's output some relevant part of the script if it exists
        const scripts = response.data.match(/<script.*?>.*?<\/script>/gs);
        if (scripts) {
            console.log("Number of scripts found:", scripts.length);
            scripts.forEach((s, i) => {
                if (s.includes("m3u8") || s.includes("file") || s.includes("sources")) {
                    console.log(`Script ${i} snippet:\n`, s.substring(0, 500));
                }
            });
        }

    } catch (err) {
        console.error("Error:", err.message);
    }
}

probeEmbed();
