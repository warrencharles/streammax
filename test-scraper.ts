import axios from "axios";
import * as cheerio from "cheerio";

async function testScraper() {
    const url = "https://hdtodayz.to/movie/watch-the-bluff-hd-145971";
    console.log(`[Test] Started for URL: ${url}`);

    try {
        let targetUrl = url;
        if (url.includes("/watch-")) {
            const id = url.split("-").pop();
            const type = url.includes("/tv/") ? "tv" : "movie";
            targetUrl = `https://hdtodayz.to/${type}/${id}`;
        }

        console.log(`[Test] Target info URL: ${targetUrl}`);

        const response = await axios.get(targetUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });

        console.log(`[Test] Response status: ${response.status}`);
        const $ = cheerio.load(response.data);

        const title = $(".heading-name").text().trim() || $("h2.heading-name").text().trim() || "Unknown Title";
        console.log(`[Test] Extracted Title: ${title}`);

        let showId = $("#watch-now").attr("data-id") || $(".btn-play").attr("data-id");
        console.log(`[Test] Initial showId: ${showId}`);

        if (!showId) {
            showId = targetUrl.split("/").pop()?.split("-").pop();
            console.log(`[Test] Fallback showId: ${showId}`);
        }

        process.exit(0);
    } catch (error: any) {
        console.error("[Test] Failed:", error.message);
        process.exit(1);
    }
}

testScraper();
