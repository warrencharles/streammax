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

  // API to fetch trending content
  app.get("/api/trending", async (req, res) => {
    try {
      const response = await axios.get("https://hdtodayz.to/home", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      const $ = cheerio.load(response.data);
      const trending: any[] = [];

      $("#trending-movies .flw-item, #trending-tv .flw-item").each((i, el) => {
        const $link = $(el).find("a").first();
        const href = $link.attr("href");
        const title = $(el).find(".film-name").text().trim() || $(el).find("a").attr("title") || "";
        const poster = $(el).find("img").attr("data-src") || $(el).find("img").attr("src");
        const type = href?.includes("/movie/") ? "movie" : "tv";

        if (href && title) {
          trending.push({
            id: href.split("-").pop(),
            title,
            poster,
            url: href.startsWith("http") ? href : `https://hdtodayz.to${href}`,
            type
          });
        }
      });

      res.json(trending);
    } catch (error) {
      console.error("Error fetching trending:", error);
      res.status(500).json({ error: "Failed to fetch trending" });
    }
  });

  // API to search content
  app.get("/api/search", async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);
    try {
      const response = await axios.get(`https://hdtodayz.to/search/${encodeURIComponent(q as string)}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      const $ = cheerio.load(response.data);
      const results: any[] = [];

      $(".flw-item").each((i, el) => {
        const $link = $(el).find("a").first();
        const href = $link.attr("href");
        const title = $(el).find(".film-name").text().trim() || $(el).find("a").attr("title") || "";
        const poster = $(el).find("img").attr("data-src") || $(el).find("img").attr("src");
        const type = href?.includes("/movie/") ? "movie" : "tv";

        if (href && title) {
          results.push({
            id: href.split("-").pop(),
            title,
            poster,
            url: href.startsWith("http") ? href : `https://hdtodayz.to${href}`,
            type
          });
        }
      });

      res.json(results);
    } catch (error) {
      console.error("Error searching:", error);
      res.status(500).json({ error: "Failed to search" });
    }
  });

  // API to fetch by genre
  app.get("/api/genre/:genre", async (req, res) => {
    const { genre } = req.params;
    try {
      const response = await axios.get(`https://hdtodayz.to/genre/${genre}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      const $ = cheerio.load(response.data);
      const items: any[] = [];

      $(".flw-item").each((i, el) => {
        const $link = $(el).find("a").first();
        const href = $link.attr("href");
        const title = $(el).find(".film-name").text().trim() || $(el).find("a").attr("title") || "";
        const poster = $(el).find("img").attr("data-src") || $(el).find("img").attr("src");
        const type = href?.includes("/movie/") ? "movie" : "tv";

        if (href && title) {
          items.push({
            id: href.split("-").pop(),
            title,
            poster,
            url: href.startsWith("http") ? href : `https://hdtodayz.to${href}`,
            type
          });
        }
      });

      res.json(items);
    } catch (error) {
      console.error("Error fetching genre:", error);
      res.status(500).json({ error: "Failed to fetch genre" });
    }
  });

  // API to fetch movies from hdtodayz.to
  app.get("/api/movies", async (req, res) => {
    try {
      const response = await axios.get("https://hdtodayz.to/movie", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      const $ = cheerio.load(response.data);
      const movies: any[] = [];

      $(".flw-item").each((i, el) => {
        const $link = $(el).find("a").first();
        const href = $link.attr("href");
        const title = $(el).find(".film-name").text().trim() || $(el).find("a").attr("title") || "";
        const poster = $(el).find("img").attr("data-src") || $(el).find("img").attr("src");
        const quality = $(el).find(".pick.hl-2").text().trim();

        if (href && title) {
          movies.push({
            id: href.split("-").pop(),
            title,
            poster,
            url: href.startsWith("http") ? href : `https://hdtodayz.to${href}`,
            type: "movie",
            quality: quality || "HD"
          });
        }
      });

      res.json(movies);
    } catch (error) {
      console.error("Error fetching movies:", error);
      res.status(500).json({ error: "Failed to fetch movies" });
    }
  });

  // API to fetch TV shows from hdtodayz.to
  app.get("/api/tv-shows", async (req, res) => {
    try {
      const response = await axios.get("https://hdtodayz.to/tv-show", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      const $ = cheerio.load(response.data);
      const shows: any[] = [];

      $(".flw-item").each((i, el) => {
        const $link = $(el).find("a").first();
        const href = $link.attr("href");
        const title = $(el).find(".film-name").text().trim() || $(el).find("a").attr("title") || "";
        const poster = $(el).find("img").attr("data-src") || $(el).find("img").attr("src");

        if (href && title) {
          shows.push({
            id: href.split("-").pop(),
            title,
            poster,
            url: href.startsWith("http") ? href : `https://hdtodayz.to${href}`,
            type: "tv",
            quality: "HD"
          });
        }
      });

      res.json(shows);
    } catch (error) {
      console.error("Error fetching TV shows:", error);
      res.status(500).json({ error: "Failed to fetch TV shows" });
    }
  });

  // API to fetch details (seasons/episodes) for a TV show or movie
  app.get("/api/details", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      // Ensure we are hitting the info page
      let targetUrl = url;
      if (url.includes("/watch-")) {
        const parts = url.split("/");
        const lastPart = parts[parts.length - 1];
        const id = lastPart.split("-").pop();
        const type = url.includes("/tv/") ? "tv" : "movie";
        targetUrl = `https://hdtodayz.to/${type}/${id}`;
      }

      const response = await axios.get(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      const $ = cheerio.load(response.data);
      
      const title = $(".heading-name").text().trim() || $("h2.heading-name").text().trim();
      const description = $(".description").text().trim() || $(".detail-description").text().trim();
      const poster = $(".film-poster-img").attr("src") || $(".film-poster img").attr("src");
      const showId = $("#watch-now").attr("data-id") || $(".btn-play").attr("data-id") || targetUrl.split("/").pop()?.split("-").pop();
      
      // Extract metadata
      let year = "N/A";
      let duration = "N/A";
      let quality = "HD";
      let rating = "N/A";

      $(".row-line").each((i, el) => {
        const text = $(el).text();
        if (text.includes("Released:")) year = text.replace("Released:", "").trim().split("-")[0];
        if (text.includes("Duration:")) duration = text.replace("Duration:", "").trim();
        if (text.includes("Quality:")) quality = text.replace("Quality:", "").trim();
        if (text.includes("IMDb:")) rating = text.replace("IMDb:", "").trim();
      });

      const seasons: any[] = [];
      const type = url.includes("/tv/") ? "tv" : "movie";

      if (type === "tv" && showId) {
        try {
          // Fetch seasons via AJAX
          const seasonsResponse = await axios.get(`https://hdtodayz.to/ajax/v2/tv/seasons/${showId}`, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "X-Requested-With": "XMLHttpRequest"
            }
          });
          const $seasons = cheerio.load(seasonsResponse.data);
          const seasonLinks = $seasons(".dropdown-item, a");

          for (const el of seasonLinks.toArray()) {
            const seasonId = $(el).attr("data-id");
            const seasonName = $(el).text().trim();
            
            if (seasonId) {
              // Fetch episodes for this season
              const epsResponse = await axios.get(`https://hdtodayz.to/ajax/v2/season/episodes/${seasonId}`, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                  "X-Requested-With": "XMLHttpRequest"
                }
              });
              const $eps = cheerio.load(epsResponse.data);
              const episodes: any[] = [];
              
              $eps(".nav-item a, .episode-item").each((i, epEl) => {
                const epId = $(epEl).attr("data-id");
                const epName = $(epEl).text().trim();
                const epTitle = $(epEl).attr("title") || epName;
                if (epId) {
                  episodes.push({
                    id: epId,
                    title: epTitle,
                    name: epName
                  });
                }
              });
              
              if (episodes.length > 0) {
                seasons.push({
                  id: seasonId,
                  name: seasonName,
                  episodes
                });
              }
            }
          }
        } catch (e) {
          console.error("Error fetching seasons/episodes via AJAX:", e);
        }
      }

      const result = { 
        id: showId, 
        title, 
        description, 
        poster, 
        type, 
        year, 
        duration, 
        quality, 
        rating,
        seasons: seasons.length > 0 ? seasons : undefined
      };

      res.json(result);
    } catch (error) {
      console.error("Error fetching details:", error);
      res.status(500).json({ error: "Failed to fetch details" });
    }
  });

  // API to get the embed source
  app.get("/api/source", async (req, res) => {
    const { id } = req.query; // This is the episode ID or movie ID
    if (!id) return res.status(400).json({ error: "ID is required" });

    try {
      // 1. Get servers for this ID
      const serversResponse = await axios.get(`https://hdtodayz.to/ajax/v2/episode/servers/${id}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "X-Requested-With": "XMLHttpRequest"
        }
      });
      const $ = cheerio.load(serversResponse.data);
      const servers = $(".nav-item a").map((i, el) => ({
        id: $(el).attr("data-id"),
        name: $(el).text().trim()
      })).get();
      
      if (servers.length === 0) return res.status(404).json({ error: "No servers found" });

      // Try servers to find a direct link or valid iframe
      for (const server of servers) {
        try {
          const sourceResponse = await axios.get(`https://hdtodayz.to/ajax/v2/episode/sources/${server.id}`, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "X-Requested-With": "XMLHttpRequest"
            }
          });
          
          const embedLink = sourceResponse.data.link;
          if (!embedLink) continue;

          // Try to see if we can find an m3u8 directly in the embed page
          try {
            const embedPage = await axios.get(embedLink, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://hdtodayz.to/"
              },
              timeout: 5000
            });
            
            const m3u8Match = embedPage.data.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
            if (m3u8Match) {
              return res.json({ type: "m3u8", link: m3u8Match[1] });
            }
          } catch (e) {
            // Ignore error and fallback to iframe
          }

          return res.json({ type: "iframe", link: embedLink });
        } catch (e) {
          continue;
        }
      }

      res.status(404).json({ error: "No playable source found" });
    } catch (error) {
      console.error("Error fetching source:", error);
      res.status(500).json({ error: "Failed to fetch source" });
    }
  });

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
