import axios from "axios";

const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "http://www.fawanews.sc/"
};

const matchesRes = await axios.get("http://localhost:3000/api/matches", { timeout: 8000 });
const matches = matchesRes.data;
console.log("Total matches:", matches.length);
if (!matches.length) { console.log("No matches found"); process.exit(0); }

const matchUrl = matches[0].url;
console.log("Probing URL:", matchUrl);

const r = await axios.get(matchUrl, { headers, timeout: 12000 });
const html = r.data;

console.log("X-Frame-Options:", r.headers["x-frame-options"] || "NOT SET");
console.log("CSP:", (r.headers["content-security-policy"] || "NOT SET").substring(0, 300));

// Find iframes
const iframeRe = /iframe[^>]+src=["']([^"']+)["']/gi;
let m;
const iframes = [];
while ((m = iframeRe.exec(html)) !== null) iframes.push(m[1]);
console.log("\nIFRAMEs found:", iframes.length, iframes);

// Find video-related scripts
const sRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
while ((m = sRe.exec(html)) !== null) {
    const s = m[1];
    if (s.match(/stream|player|m3u8|source|setup|embed|jwplayer|hls|file:/i)) {
        console.log("\n--- SCRIPT ---", s.substring(0, 800));
    }
}

const idx = html.search(/video|player|jwplayer|embedUrl/i);
if (idx > -1) {
    console.log("\nHTML near video keyword:", html.substring(Math.max(0, idx - 100), idx + 600));
}

// Also print a raw snippet of the page body
const bodyIdx = html.indexOf("<body");
if (bodyIdx > -1) {
    console.log("\nBody start:", html.substring(bodyIdx, bodyIdx + 1500));
}
