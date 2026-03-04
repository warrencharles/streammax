import axios from "axios";
import { URL } from "url";

async function proxy(targetUrl) {
    const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);
    const response = await axios.get(targetUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0",
            "Referer": "http://www.fawanews.sc/"
        }
    });

    const lines = response.data.split("\n");
    const modifiedLines = lines.map(line => {
        if (line.trim() === "" || line.startsWith("#")) {
            return line;
        }
        // It's a URL or path
        let resolvedUrl;
        try {
            resolvedUrl = new URL(line, baseUrl).href;
        } catch (e) {
            resolvedUrl = line;
        }
        return `/api/proxy?url=${encodeURIComponent(resolvedUrl)}`;
    });

    return modifiedLines.join("\n");
}

const testUrl = "http://195.178.110.25/hls/ccccQQQ.m3u8";
console.log("Testing proxy for:", testUrl);
proxy(testUrl).then(res => {
    console.log("Modified Manifest Snippet:");
    console.log(res.substring(0, 500));
}).catch(err => {
    console.error("Test failed:", err.message);
});
