import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import * as cheerio from "cheerio";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API to fetch matches from fawanews.sc
  app.get("/api/matches", async (req, res) => {
    try {
      const response = await axios.get("http://www.fawanews.sc/", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      });
      const $ = cheerio.load(response.data);
      const matches: any[] = [];

      $(".user-item").each((i, el) => {
        const $link = $(el).find("a").first();
        const href = $link.attr("href");
        const name = $(el).find(".user-item__name").text().trim();
        const playing = $(el).find(".user-item__playing").text().trim();
        
        if (href && href.endsWith(".html") && name) {
          matches.push({
            title: playing ? `${name} (${playing})` : name,
            url: href.startsWith("http") ? href : `http://www.fawanews.sc/${href}`
          });
        }
      });

      // Fallback for other links if the above structure isn't found
      if (matches.length === 0) {
        $("a").each((i, el) => {
          const href = $(el).attr("href");
          const text = $(el).text().trim();
          
          if (href && href.endsWith(".html") && text && text.length > 5) {
            if (text.toLowerCase().includes("vs") || text.toLowerCase().includes("cup") || text.toLowerCase().includes("league")) {
              matches.push({
                title: text,
                url: href.startsWith("http") ? href : `http://www.fawanews.sc/${href}`
              });
            }
          }
        });
      }

      // Remove duplicates and clean up
      const uniqueMatches = Array.from(new Set(matches.map(m => m.url)))
        .map(url => matches.find(m => m.url === url));

      res.json(uniqueMatches);
    } catch (error) {
      console.error("Error fetching matches:", error);
      res.status(500).json({ error: "Failed to fetch matches" });
    }
  });

  // API to fetch stream URL from a match page
  app.get("/api/stream", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      });
      const html = response.data;
      const $ = cheerio.load(html);

      // Look for m3u8 in scripts
      let streamUrl = "";
      
      // 1. Check for direct m3u8 links in scripts
      const scripts = $("script").map((i, el) => $(el).html()).get();
      const m3u8Regex = /(?:source|file|url|src|videos)\s*[:=]\s*["'\[\s]*((?:https?:\/\/|\/)[^"']+\.m3u8[^"']*)["'\]\s]*/i;
      
      for (const scriptContent of scripts) {
        if (!scriptContent) continue;
        
        // Try normal regex
        const m3u8Match = scriptContent.match(m3u8Regex);
        if (m3u8Match) {
          let foundUrl = m3u8Match[1];
          if (foundUrl.startsWith("/")) {
            foundUrl = `http://www.fawanews.sc${foundUrl}`;
          }
          streamUrl = foundUrl;
          break;
        }
        
        // Try to decode if it's packed (eval(function(p,a,c,k,e,d)...))
        if (scriptContent.includes("eval(function(p,a,c,k,e,d)")) {
          try {
            // Very basic packer decoder (just extract strings)
            const packedStrings = scriptContent.match(/'[^']+'|"[^"]+"/g);
            if (packedStrings) {
              for (const s of packedStrings) {
                const cleanS = s.slice(1, -1);
                if (cleanS.includes(".m3u8")) {
                  streamUrl = cleanS.startsWith("/") ? `http://www.fawanews.sc${cleanS}` : cleanS;
                  break;
                }
              }
            }
          } catch (e) {
            console.log("Failed to decode packed script");
          }
        }
        if (streamUrl) break;
      }

      // 2. Check for iframes
      if (!streamUrl) {
        const iframes = $("iframe").map((i, el) => $(el).attr("src")).get();
        for (const iframeSrc of iframes) {
          if (!iframeSrc) continue;
          
          if (iframeSrc.includes(".m3u8")) {
            streamUrl = iframeSrc;
            break;
          } else {
             try {
               const fullIframeUrl = iframeSrc.startsWith("http") ? iframeSrc : `http://www.fawanews.sc/${iframeSrc}`;
               const iframeResponse = await axios.get(fullIframeUrl, {
                 headers: { 
                   "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                   "Referer": url
                 }
               });
               const iframeHtml = iframeResponse.data;
               const m3u8MatchIframe = iframeHtml.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
               if (m3u8MatchIframe) {
                 streamUrl = m3u8MatchIframe[1];
                 break;
               }
               
               // Also check for source tags in iframe
               const $iframe = cheerio.load(iframeHtml);
               const sourceSrc = $iframe("source[src*='.m3u8']").attr("src");
               if (sourceSrc) {
                 streamUrl = sourceSrc;
                 break;
               }
             } catch (e) {
               console.log("Could not fetch iframe content from", iframeSrc);
             }
          }
        }
      }

      // 3. Check for source tags in main page
      if (!streamUrl) {
        const sourceSrc = $("source[src*='.m3u8']").attr("src");
        if (sourceSrc) {
          streamUrl = sourceSrc.startsWith("/") ? `http://www.fawanews.sc${sourceSrc}` : sourceSrc;
        }
      }

      // 4. Check for data attributes
      if (!streamUrl) {
        $("[data-config], [data-source], [data-url], [data-file]").each((i, el) => {
          const data = $(el).attr("data-config") || $(el).attr("data-source") || $(el).attr("data-url") || $(el).attr("data-file");
          if (data && data.includes(".m3u8")) {
            const match = data.match(/(https?:\/\/[^"']+\.m3u8[^"']*)/i);
            if (match) {
              streamUrl = match[1];
              return false;
            }
          }
        });
      }

      // 5. Check for embed tags
      if (!streamUrl) {
        $("embed[src*='.m3u8']").each((i, el) => {
          streamUrl = $(el).attr("src") || "";
          if (streamUrl) return false;
        });
      }

      // 6. Final fallback: search entire HTML for any m3u8 link
      if (!streamUrl) {
        const anyM3u8Match = html.match(/(?:https?:\/\/|\/)[^"'\s]+\.m3u8[^"'\s]*/i);
        if (anyM3u8Match) {
          let foundUrl = anyM3u8Match[0];
          if (foundUrl.startsWith("/")) {
            foundUrl = `http://www.fawanews.sc${foundUrl}`;
          }
          streamUrl = foundUrl;
        }
      }

      if (streamUrl) {
        res.json({ streamUrl });
      } else {
        res.status(404).json({ 
          error: "Stream URL not found", 
          debug: {
            scriptCount: $("script").length,
            iframeCount: $("iframe").length,
            htmlSnippet: html.substring(0, 500)
          }
        });
      }
    } catch (error) {
      console.error("Error fetching stream:", error);
      res.status(500).json({ error: "Failed to fetch stream" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
