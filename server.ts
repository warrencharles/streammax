import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import * as cheerio from "cheerio";
import cors from "cors";

// ─────────────────────────────────────────────────────────────────────────────
// Sports data in-memory cache
// Populated at startup and refreshed every 30 minutes automatically.
// ─────────────────────────────────────────────────────────────────────────────

const LEAGUES = ['PL', 'CL', 'BL1', 'SA', 'PD', 'FL1'];
const CACHE_REFRESH_MS = 30 * 60 * 1000; // 30 minutes

const sportsCache: Record<string, {
  standings: any[];
  matches: any[];
  lastUpdated: Date | null;
}> = {};

for (const league of LEAGUES) {
  sportsCache[league] = { standings: [], matches: [], lastUpdated: null };
}

// Shared UA and encoding helpers for sports scraping
const SPORTS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function decodeSportsBuffer(buf: Buffer): string {
  const hasUtf16Bom = buf[0] === 0xff && buf[1] === 0xfe;
  const hasHighNullFrequency = buf.length > 10 && buf.slice(0, 100).filter(b => b === 0).length > 20;
  return (hasUtf16Bom || hasHighNullFrequency) ? buf.toString('utf16le') : buf.toString('utf8');
}

function parseStandings(html: string): any[] {
  const $ = cheerio.load(html);
  const standings: any[] = [];

  $('table').each((i, table) => {
    const ths = $(table).find('th').map((j, th) => $(th).text().trim()).get();
    const isStandings = ths.includes('Pos') && (ths.includes('Team') || ths.includes('Equipe'));

    if (isStandings && standings.length === 0) {
      $(table).find('tbody tr').each((j, tr) => {
        const tds = $(tr).find('td');
        if (tds.length >= 4) {
          const teamRaw = $(tds[1]).text().trim();
          const teamClean = teamRaw.split('\n')[0].trim();
          standings.push({
            rank: $(tds[0]).text().trim().replace('.', ''),
            team: teamClean,
            played: $(tds[2]).text().trim(),
            points: $(tds[3]).text().trim(),
            logo: $(tds[1]).find('img').attr('src')
          });
        }
      });
      return false;
    }
  });
  return standings;
}

function parseMatches(html: string): any[] {
  const $ = cheerio.load(html);

  const extractTeamName = (td: any, side: 'first' | 'last') => {
    const spans = $(td).find('span.md\\:inline-block');
    const span = side === 'first' ? spans.first() : spans.last();
    return span.text().trim().replace(/\s*\(\d+\)\s*/g, '').trim();
  };

  const parseMatchDate = (raw: string): Date | null => {
    const m = raw.trim().match(/(\d{4})\/(\d{2})\/(\d{2}),\s*(\d{1,2})h(\d{2})/);
    if (!m) return null;
    const [, year, month, day, hour, min] = m;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(min));
  };

  const formatDate = (d: Date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const upcomingMatches: any[] = [];
  $('tr[id^="next-"], tr[id^="last-"]').each((_j: number, tr: any) => {
    const id = $(tr).attr('id');
    const isPrevMatch = id?.startsWith('last-');

    const dateRaw = $(tr).find('th').first().text().trim();
    const matchDate = parseMatchDate(dateRaw);
    if (!matchDate) return;

    const tds = $(tr).find('td');
    if (tds.length < 1) return;

    const team1 = extractTeamName(tds[0], 'first');
    const team2 = extractTeamName(tds[0], 'last');
    if (!team1 || !team2) return;

    let score = null;
    let status = isPrevMatch ? 'finished' : 'upcoming';

    if (tds.length >= 2) {
      const scoreText = $(tds[1]).find('div.rounded-full').text().trim();
      if (scoreText) score = scoreText;
    }

    const matchTimeMs = matchDate.getTime();
    const nowMs = new Date().getTime();
    const diffMinutes = (nowMs - matchTimeMs) / (1000 * 60);

    if (!isPrevMatch && score) {
      status = 'live';
    } else if (!isPrevMatch && diffMinutes > 0 && diffMinutes < 120) {
      status = 'live';
    }

    upcomingMatches.push({
      id,
      date: formatDate(matchDate),
      rawDate: matchDate.toISOString(),
      homeTeam: team1,
      awayTeam: team2,
      score,
      status
    });
  });

  return upcomingMatches;
}

async function fetchLeagueData(league: string, retries = 2): Promise<void> {
  const fetchWithRetry = async (url: string): Promise<Buffer> => {
    let lastErr: any;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await axios.get(url, {
          responseType: 'arraybuffer',
          headers: { 'User-Agent': SPORTS_UA },
          timeout: 15000
        });
        return Buffer.from(res.data);
      } catch (err: any) {
        lastErr = err;
        if (attempt < retries) {
          // Wait 3s before retrying
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }
    throw lastErr;
  };

  try {
    const [standingsBuf, fixturesBuf] = await Promise.all([
      fetchWithRetry(`https://native-stats.org/competition/${league}/`),
      fetchWithRetry(`https://native-stats.org/competition/${league}/fixtures/`)
    ]);

    const standingsHtml = decodeSportsBuffer(standingsBuf);
    const fixturesHtml = decodeSportsBuffer(fixturesBuf);

    const standings = parseStandings(standingsHtml);
    const matches = parseMatches(fixturesHtml);

    sportsCache[league] = {
      standings,
      matches,
      lastUpdated: new Date()
    };

    console.log(`[Cache] ✓ ${league}: ${standings.length} standings, ${matches.length} fixtures`);
  } catch (err: any) {
    const prev = sportsCache[league]?.lastUpdated ? ` (keeping data from ${sportsCache[league].lastUpdated?.toISOString()})` : ' (no cached data)';
    console.error(`[Cache] ✗ ${league} fetch failed: ${err.message}${prev}`);
  }
}

async function refreshAllLeagues(): Promise<void> {
  console.log('[Cache] Refreshing all league data...');
  await Promise.allSettled(LEAGUES.map(l => fetchLeagueData(l)));
  console.log('[Cache] Refresh complete.');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Kick off initial data fetch (non-blocking — server starts immediately)
  refreshAllLeagues().catch(e => console.error('[Cache] Initial fetch error:', e));

  // Auto-refresh every 30 minutes
  setInterval(() => {
    refreshAllLeagues().catch(e => console.error('[Cache] Auto-refresh error:', e));
  }, CACHE_REFRESH_MS);


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

  // ---------------------------------------------------------
  // Sports Data — served from in-memory cache
  // ---------------------------------------------------------
  app.get('/api/sports/standings/:league', async (req, res) => {
    const { league } = req.params;
    const cached = sportsCache[league];

    // If cache is empty (e.g. very first request during startup), do a live fetch
    if (!cached || (!cached.lastUpdated && cached.standings.length === 0)) {
      try {
        await fetchLeagueData(league);
      } catch (e: any) {
        return res.status(500).json({ error: 'Failed to fetch standings', message: e.message });
      }
    }

    const data = sportsCache[league];
    console.log(`[Sports] Serving ${league} standings from cache (${data.lastUpdated?.toISOString() ?? 'uncached'})`);
    res.json(data.standings);
  });

  app.get('/api/sports/matches/:league', async (req, res) => {
    const { league } = req.params;
    const cached = sportsCache[league];

    // If cache is empty (e.g. very first request during startup), do a live fetch
    if (!cached || (!cached.lastUpdated && cached.matches.length === 0)) {
      try {
        await fetchLeagueData(league);
      } catch (e: any) {
        return res.status(500).json({ error: 'Failed to fetch matches', message: e.message });
      }
    }

    const data = sportsCache[league];
    console.log(`[Sports] Serving ${league} fixtures from cache (${data.lastUpdated?.toISOString() ?? 'uncached'}): ${data.matches.length} matches`);
    res.json(data.matches);
  });

  // Search historical results — served from the standings page cache
  app.get('/api/sports/results/:league', async (req, res) => {
    const { league } = req.params;
    const { q } = req.query as { q?: string };

    // We use the cached matches (which include 'finished' status) for results
    const cached = sportsCache[league];
    if (!cached || (!cached.lastUpdated && cached.matches.length === 0)) {
      try {
        await fetchLeagueData(league);
      } catch (e: any) {
        return res.status(500).json({ error: 'Failed to fetch results', message: e.message });
      }
    }

    let results = (sportsCache[league]?.matches ?? []).filter((m: any) => m.status === 'finished');

    if (q) {
      const query = (q as string).toLowerCase();
      results = results.filter((m: any) =>
        m.homeTeam.toLowerCase().includes(query) || m.awayTeam.toLowerCase().includes(query)
      );
    }

    res.json(results);
  });

  // Cache status — useful for debugging: shows when each league was last fetched
  app.get('/api/sports/cache-status', (_req, res) => {
    const status = Object.fromEntries(
      Object.entries(sportsCache).map(([league, data]) => [
        league,
        {
          standings: data.standings.length,
          matches: data.matches.length,
          lastUpdated: data.lastUpdated?.toISOString() ?? 'never'
        }
      ])
    );
    res.json(status);
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
    const { type } = req.query; // 'movie' or 'tv'

    const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    const extractItems = ($: ReturnType<typeof cheerio.load>, typeFilter?: string) => {
      const items: any[] = [];
      $(".flw-item").each((_i: number, el: any) => {
        const $link = $(el).find("a").first();
        const href = $link.attr("href");
        const title = $(el).find(".film-name").text().trim() || $(el).find("a").attr("title") || "";
        const poster = $(el).find("img").attr("data-src") || $(el).find("img").attr("src");
        const itemType = href?.includes("/movie/") ? "movie" : "tv";

        if (href && title) {
          if (!typeFilter || itemType === typeFilter) {
            items.push({
              id: href.split("-").pop(),
              title,
              poster,
              url: href.startsWith("http") ? href : `https://hdtodayz.to${href}`,
              type: itemType
            });
          }
        }
      });
      return items;
    };

    try {
      const typeFilter = type as string | undefined;
      // The correct URL pattern is /genre/:slug (not /filter?genre=)
      // Fetch 5 pages in parallel to get ~160+ items
      const pagesToFetch = [1, 2, 3, 4, 5];
      const pageResults = await Promise.all(
        pagesToFetch.map(page =>
          axios.get(`https://hdtodayz.to/genre/${genre}?page=${page}`, {
            headers: { "User-Agent": UA },
            timeout: 10000
          })
            .then(r => extractItems(cheerio.load(r.data), typeFilter))
            .catch((err: any) => {
              console.warn(`[Genre] Page ${page} failed: ${err.message}`);
              return [];
            })
        )
      );

      // Flatten and deduplicate by ID
      const allItems = pageResults.flat();
      const seen = new Set<string>();
      const unique = allItems.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });

      console.log(`[Genre] /genre/${genre} → ${unique.length} unique items (type: ${typeFilter || 'all'})`);
      res.json(unique);
    } catch (error: any) {
      console.error("Error fetching genre:", error.message);
      res.status(500).json({ error: "Failed to fetch genre" });
    }
  });

  // API to fetch movies from hdtodayz.to - Prioritize latest released
  app.get("/api/movies", async (req, res) => {
    try {
      let response;
      try {
        response = await axios.get("https://hdtodayz.to/filter?type=movie&sort=released_at", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          },
          timeout: 8000
        });
      } catch (e) {
        console.log("[Movies] Filter failed, falling back to home trending");
        response = await axios.get("https://hdtodayz.to/home", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });
      }

      const $ = cheerio.load(response.data);
      const movies: any[] = [];

      // Try filter items first, then trending/latest as fallback
      let selector = ".flw-item";
      if (response.request.path.includes("home")) {
        // Precise home page selectors
        selector = ".block_area:has(.cat-heading:contains('Latest Movies')) .flw-item";
        if ($(selector).length === 0) selector = "#trending-movies .flw-item";
      }

      $(selector).each((i, el) => {
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
    } catch (error: any) {
      console.error("Error fetching movies:", error.message);
      res.status(500).json({ error: "Failed to fetch movies", details: error.message });
    }
  });

  // API to fetch TV shows from hdtodayz.to - Prioritize latest released
  app.get("/api/tv-shows", async (req, res) => {
    try {
      let response;
      try {
        console.log("[TV] Fetching filtered list...");
        response = await axios.get("https://hdtodayz.to/filter?type=tv&sort=released_at", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          },
          timeout: 8000
        });
      } catch (e: any) {
        console.log(`[TV] Filter failed: ${e.message}, falling back to home trending`);
        response = await axios.get("https://hdtodayz.to/home", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          },
          timeout: 10000
        });
      }

      const $ = cheerio.load(response.data);
      const shows: any[] = [];

      // Try filter items first, then trending/latest as fallback
      let selector = ".flw-item";
      if (response.request.path.includes("home")) {
        // Precise home page selectors
        selector = ".block_area:has(.cat-heading:contains('Latest TV Shows')) .flw-item";
        if ($(selector).length === 0) selector = "#trending-tv .flw-item";
      }

      $(selector).each((i, el) => {
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

      console.log(`[TV] Scraped ${shows.length} shows`);
      res.json(shows);
    } catch (error: any) {
      console.error("Error fetching TV shows:", error.message);
      res.status(500).json({ error: "Failed to fetch TV shows", details: error.message });
    }
  });

  // API to fetch details (seasons/episodes) for a TV show or movie
  app.get("/api/details", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    console.log(`[Details] Incoming URL: ${url}`);

    try {
      // Normalize watch-links to info-page links
      // e.g. https://hdtodayz.to/movie/watch-mercy-hd-142159
      //   -> https://hdtodayz.to/movie/mercy-142159
      let targetUrl = url;
      if (url.includes("/watch-")) {
        const parts = url.split("/");
        const slug = parts[parts.length - 1];
        const cleanSlug = slug
          .replace(/^watch-/, "")
          .replace(/-hd-/g, "-")
          .replace(/-ultra-/g, "-")
          .replace(/-full-/g, "-")
          .replace(/-sd-/g, "-");
        parts[parts.length - 1] = cleanSlug;
        targetUrl = parts.join("/");
      }

      console.log(`[Details] Fetching: ${targetUrl}`);

      const response = await axios.get(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://hdtodayz.to/"
        },
        maxRedirects: 5,
        timeout: 12000
      });

      const $ = cheerio.load(response.data);

      const title = $(".heading-name a").text().trim() ||
        $(".heading-name").text().trim() ||
        $("h2").first().text().trim() ||
        "Unknown Title";

      const description = $(".description").text().trim() ||
        $(".detail-description").text().trim() ||
        "";

      const poster = $(".film-poster-img").attr("src") ||
        $(".film-poster img").attr("src") ||
        $(".film-poster img").attr("data-src") ||
        "";

      // Extract media ID from HTML — most reliable method
      let showId: string | undefined;
      const idMatch = (response.data as string).match(/data-id=["'](\d+)["']/);
      if (idMatch) showId = idMatch[1];
      if (!showId) showId = $("#watch-now").attr("data-id") || $(".btn-play").attr("data-id");
      if (!showId) showId = targetUrl.split("-").pop();

      console.log(`[Details] Title: "${title}", ID: ${showId}`);

      // Metadata
      let year = "N/A", duration = "N/A", quality = "HD", rating = "N/A";
      $(".row-line").each((_, el) => {
        const text = $(el).text().trim();
        if (text.startsWith("Released:")) year = text.replace("Released:", "").trim().split(" ")[0];
        if (text.startsWith("Duration:")) duration = text.replace("Duration:", "").trim();
        if (text.startsWith("Quality:")) quality = text.replace("Quality:", "").trim();
        if (text.startsWith("IMDb:")) rating = text.replace("IMDb:", "").trim();
      });

      const type: "movie" | "tv" = targetUrl.includes("/tv/") ? "tv" : "movie";
      const seasons: any[] = [];

      if (type === "tv" && showId) {
        try {
          const seasonsRes = await axios.get(`https://hdtodayz.to/ajax/season/list/${showId}`, {
            headers: {
              "User-Agent": "Mozilla/5.0",
              "X-Requested-With": "XMLHttpRequest",
              "Referer": targetUrl
            },
            timeout: 8000
          });
          const $s = cheerio.load(seasonsRes.data);

          for (const el of $s(".ss-item").toArray()) {
            const seasonId = $s(el).attr("data-id");
            const seasonName = $s(el).text().trim();
            if (!seasonId) continue;

            try {
              const epsRes = await axios.get(`https://hdtodayz.to/ajax/season/episodes/${seasonId}`, {
                headers: { "User-Agent": "Mozilla/5.0", "X-Requested-With": "XMLHttpRequest", "Referer": targetUrl },
                timeout: 8000
              });
              const $e = cheerio.load(epsRes.data);
              const episodes: any[] = [];
              $e(".eps-item").each((_, epEl) => {
                const epId = $e(epEl).attr("data-id");
                const epTitle = $e(epEl).attr("title") || $e(epEl).text().trim();
                if (epId) {
                  episodes.push({
                    id: epId,
                    title: epTitle,
                    name: epTitle
                  });
                }
              });

              seasons.push({
                id: seasonId,
                name: seasonName,
                episodes
              });
            } catch (epError: any) {
              console.error(`[Details] Failed to fetch episodes for season ${seasonId}:`, epError.message);
            }
          }
        } catch (sError: any) {
          console.error(`[Details] Failed to fetch seasons for ${showId}:`, sError.message);
        }
      }

      res.json({ id: showId, title, description, poster, type, year, duration, quality, rating, seasons: seasons.length > 0 ? seasons : undefined });
    } catch (err: any) {
      console.error("[Details] Error:", err.message);
      res.status(500).json({ error: "Failed to fetch details", message: err.message });
    }
  });

  // API to get the embed source
  // Mirrors the exact flow the site's own JS uses:
  //   Movies:   $.get("/ajax/episode/list/" + movie.id) → servers → $.get("/ajax/sources/" + link_id)
  //   TV eps:   $.get("/ajax/v2/episode/servers/" + ep.id) → servers → $.get("/ajax/sources/" + link_id)
  app.get("/api/source", async (req, res) => {
    const { id, type, index } = req.query;
    if (!id) return res.status(400).json({ error: "ID is required" });

    const serverIndex = parseInt(index as string) || 0;
    console.log(`[Source] id=${id}, type=${type || "movie"}, requestedIndex=${serverIndex}`);

    const ajaxHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": "https://hdtodayz.to/",
      "Accept": "*/*"
    };

    try {
      // Step 1: Get the list of servers (nav-item links with data-id)
      // Standardized to /ajax/episode/servers/ for both TV episodes and movies (after list resolution)
      const listUrl = `https://hdtodayz.to/ajax/episode/servers/${id}`;

      // In the new site structure, /ajax/episode/list/${id} for movies returns the SAME HTML 
      // as /ajax/episode/servers/${id}. So we can just use the server link ID directly if we have it,
      // or the movie show ID which resolves to the same.
      // However, for movies, the first step is actually /ajax/episode/list/${id} 
      // and for TV eps it is /ajax/episode/servers/${id}.
      const effectiveListUrl = type === "tv" ? listUrl : `https://hdtodayz.to/ajax/episode/list/${id}`;

      console.log(`[Source] Fetching server list: ${effectiveListUrl}`);
      const listRes = await axios.get(effectiveListUrl, { headers: ajaxHeaders, timeout: 10000 });

      const $ = cheerio.load(listRes.data);
      const servers = $(".nav-item a[data-id]").map((_, el) => ({
        id: $(el).attr("data-id")!,
        name: $(el).text().trim() || $(el).attr("title") || "Unknown"
      })).get();

      console.log(`[Source] Found ${servers.length} servers: ${servers.map(s => s.name).join(", ")}`);
      if (servers.length === 0) return res.status(404).json({ error: "No servers found" });

      // Step 2: Try the requested server index (or the first available if not specified)
      // We loop starting from serverIndex to find the first playable one
      for (let i = serverIndex; i < servers.length; i++) {
        const server = servers[i];
        try {
          console.log(`[Source] Trying "${server.name}" (link_id=${server.id})`);
          // Use /ajax/episode/sources/ (no v2) which we verified works for the movies
          const srcRes = await axios.get(`https://hdtodayz.to/ajax/episode/sources/${server.id}`, {
            headers: ajaxHeaders,
            timeout: 10000
          });

          const embedLink = srcRes.data?.link;
          if (!embedLink) {
            console.log(`[Source] No link from "${server.name}"`);
            continue;
          }

          console.log(`[Source] Found embed: ${embedLink}`);

          // Step 3: Attempt to extract direct m3u8 if possible
          if (embedLink.includes("videostr.net") || embedLink.includes("rabbitstream.net") || embedLink.includes("megacloud.tv") || embedLink.includes("upcloud")) {
            try {
              console.log(`[Source] Probing embed for direct m3u8: ${embedLink}`);
              const embedPage = await axios.get(embedLink, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                  "Referer": "https://hdtodayz.to/"
                },
                timeout: 8000
              });

              // Search for m3u8 in the embed page content
              const m3u8Match = embedPage.data.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
              if (m3u8Match) {
                console.log(`[Source] ✓ Found direct m3u8: ${m3u8Match[1]}`);
                const proxiedUrl = `http://localhost:3000/api/proxy?url=${encodeURIComponent(m3u8Match[1])}&referer=${encodeURIComponent("https://hdtodayz.to/")}`;
                return res.json({
                  type: "m3u8",
                  link: proxiedUrl,
                  server: server.name,
                  totalServers: servers.length,
                  currentIndex: i
                });
              }
            } catch (probErr: any) {
              console.log(`[Source] Embed probe failed or timed out: ${probErr.message}`);
            }
          }

          // Fallback to iframe if m3u8 couldn't be extracted
          console.log(`[Source] Returning iframe source for "${server.name}"`);
          return res.json({
            type: "iframe",
            link: embedLink,
            server: server.name,
            totalServers: servers.length,
            currentIndex: i
          });

        } catch (e: any) {
          console.error(`[Source] "${server.name}" failed: ${e.message}`);
          // If the specifically requested index fails, we can either return error or try next.
          // Let's try only the requested one if index was provided, to allow controlled rotation.
          if (index !== undefined) break;
        }
      }

      return res.status(404).json({ error: "No playable source found", totalServers: servers.length });

    } catch (error: any) {
      console.error("[Source] Fatal Error:", error.message);
      res.status(500).json({ error: "Failed to fetch source", message: error.message });
    }
  });

  // API to fetch matches from fawanews.sc
  app.get("/api/matches", async (req, res) => {
    try {
      const response = await axios.get("http://www.fawanews.sc/", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5"
        },
        timeout: 12000
      });
      const $ = cheerio.load(response.data);
      const matches: any[] = [];

      // Primary: scrape .user-item blocks which represent live sport streams
      $(".user-item").each((i, el) => {
        const $link = $(el).find("a").first();
        const href = $link.attr("href");
        const name = $(el).find(".user-item__name").text().trim();
        const playing = $(el).find(".user-item__playing").text().trim();
        const poster = $(el).find("img").attr("src") || $(el).find("img").attr("data-src") || "";

        // Only include entries that have sport/time info — these are actual live streams, not news
        if (href && href.endsWith(".html") && name && playing) {
          matches.push({
            title: `${name} — ${playing}`,
            sport: playing,
            url: href.startsWith("http") ? href : `http://www.fawanews.sc/${href}`,
            poster: poster.startsWith("http") ? poster : (poster ? `http://www.fawanews.sc/${poster}` : "")
          });
        }
      });

      // Fallback: look for links that look like match titles (have "vs" in the href or text)
      if (matches.length === 0) {
        $("a").each((i, el) => {
          const href = $(el).attr("href") || "";
          const text = $(el).text().trim();
          const isMatchLink = href.endsWith(".html") && (
            href.toLowerCase().includes("_vs_") ||
            href.toLowerCase().includes("nhl_") ||
            href.toLowerCase().includes("nba_") ||
            href.toLowerCase().includes("nfl_") ||
            href.toLowerCase().includes("soccer_") ||
            href.toLowerCase().includes("football_") ||
            href.toLowerCase().includes("basketball_")
          );

          if (isMatchLink && text && text.length > 3) {
            matches.push({
              title: text,
              sport: "",
              url: href.startsWith("http") ? href : `http://www.fawanews.sc/${href}`,
              poster: ""
            });
          }
        });
      }

      // Remove duplicates
      const uniqueMatches = Array.from(new Map(matches.map(m => [m.url, m])).values());

      console.log(`[Matches] Found ${uniqueMatches.length} live matches`);
      res.json(uniqueMatches);
    } catch (error) {
      console.error("Error fetching matches:", error);
      res.status(500).json({ error: "Failed to fetch matches" });
    }
  });

  // API to fetch stream URL from a match page
  // Strategy: try to extract a direct m3u8 first; if not found (common since pages use JS rendering),
  // fall back to returning the match page URL as an iframe so the browser renders the player itself.
  app.get("/api/stream", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    console.log(`[Stream] Fetching: ${url}`);

    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Referer": "http://www.fawanews.sc/"
        },
        timeout: 12000
      });
      const html = response.data as string;
      const $ = cheerio.load(html);

      let streamUrl = "";
      let foundType: "m3u8" | "iframe" = "iframe";

      // 1. Search entire HTML for any m3u8 link (fastest path)
      // Look for strings ending in .m3u8, potentially inside arrays or assignments
      const anyM3u8Match = html.match(/["'](https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)["']/i);
      if (anyM3u8Match) {
        streamUrl = anyM3u8Match[1];
        foundType = "m3u8";
        console.log(`[Stream] ✓ Found m3u8 in HTML: ${streamUrl}`);
      }

      // 2. Check script tags for m3u8 with more patterns (videos array, Clappr source, etc.)
      if (!streamUrl) {
        // Updated regex to catch: var videos = ["..."], source: "...", file: "...", etc.
        const m3u8Regex = /(?:source|file|url|src|videos|hls)\s*[:=,]\s*[[ ]*["']((?:https?:\/\/|\/)[^"']+\.m3u8[^"']*)["']/i;
        $("script").each((_, el) => {
          const content = $(el).html() || "";

          // Try specific Clappr 'videos' array pattern first
          const videosMatch = content.match(/videos\s*=\s*\[\s*["']([^"']+\.m3u8[^"']*)["']/i);
          if (videosMatch) {
            streamUrl = videosMatch[1].startsWith("/") ? `http://www.fawanews.sc${videosMatch[1]}` : videosMatch[1];
            foundType = "m3u8";
            console.log(`[Stream] ✓ Found m3u8 in videos array: ${streamUrl}`);
            return false;
          }

          const match = content.match(m3u8Regex);
          if (match) {
            streamUrl = match[1].startsWith("/") ? `http://www.fawanews.sc${match[1]}` : match[1];
            foundType = "m3u8";
            console.log(`[Stream] ✓ Found m3u8 in script tag: ${streamUrl}`);
            return false; // break .each
          }
        });
      }

      // 3. Check for static iframes — grab their src and try to probe each for m3u8
      if (!streamUrl) {
        const iframeSrcs = $("iframe[src]").map((_, el) => $(el).attr("src")!).get().filter(Boolean);
        for (const src of iframeSrcs) {
          if (src.includes(".m3u8")) {
            streamUrl = src;
            foundType = "m3u8";
            console.log(`[Stream] ✓ iframe src is m3u8: ${streamUrl}`);
            break;
          }
          // Quick probe of the iframe page
          try {
            const fullSrc = src.startsWith("http") ? src : `http://www.fawanews.sc/${src}`;
            const iframeRes = await axios.get(fullSrc, {
              headers: { "User-Agent": "Mozilla/5.0", "Referer": url },
              timeout: 6000
            });
            const m3u8InIframe = (iframeRes.data as string).match(/["'](https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)["']/i);
            if (m3u8InIframe) {
              streamUrl = m3u8InIframe[1];
              foundType = "m3u8";
              console.log(`[Stream] ✓ Found m3u8 inside iframe page: ${streamUrl}`);
              break;
            }
          } catch {
            // ignore — iframe may block server-side requests
          }
        }
      }

      if (streamUrl) {
        // Wrap with CORS proxy to bypass browser restrictions
        const finalUrl = foundType === "m3u8"
          ? `http://localhost:3000/api/proxy?url=${encodeURIComponent(streamUrl)}`
          : streamUrl;

        console.log(`[Stream] Returning ${foundType}: ${finalUrl}`);
        return res.json({ type: foundType, link: finalUrl });
      }

      // 4. FALLBACK: Return the match page URL as an iframe.
      //    fawanews.sc pages execute their embed JS in a real browser, so the player
      //    will render correctly inside a browser iframe even though server-side scraping
      console.log(`[Stream] No m3u8 found — returning match page as iframe fallback: ${url}`);
      return res.json({ type: "iframe", link: url });

    } catch (error: any) {
      console.error("[Stream] Error fetching match page:", error.message);
      // Even on fetch error, still try the iframe fallback
      console.log(`[Stream] Fetch failed — returning match page as iframe fallback anyway: ${url}`);
      return res.json({ type: "iframe", link: url });
    }
  });

  app.get("/api/proxy", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).send("URL is required");
    }

    try {
      console.log(`[Proxy] Requesting: ${url}`);
      const isM3U8 = url.toLowerCase().includes(".m3u8");

      // Use provided referer or deduce it
      let referer = req.query.referer as string || "http://www.fawanews.sc/";
      if (!req.query.referer) {
        if (url.includes("videostr.net") || url.includes("rabbitstream.net") || url.includes("megacloud.tv") || url.includes("upcloud") || url.includes("hdtoday")) {
          referer = "https://hdtodayz.to/";
        }
      }

      // Use URL constructor for safer base URL calculation
      const parsedUrl = new URL(url);
      const baseUrl = parsedUrl.origin + parsedUrl.pathname.substring(0, parsedUrl.pathname.lastIndexOf("/") + 1);

      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": referer,
          "Accept": "*/*"
        },
        responseType: isM3U8 ? "text" : "stream",
        timeout: 15000,
        validateStatus: () => true // Allow any status to avoid throwing on 404/403
      });

      if (response.status >= 400) {
        console.error(`[Proxy] Remote server returned ${response.status} for ${url}`);
        return res.status(response.status).send(`Remote server error: ${response.status}`);
      }

      // Always send CORS headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "*");

      if (isM3U8) {
        // Rewrite m3u8 manifest to proxy all internal links
        const lines = (response.data as string).split("\n");
        const modifiedLines = lines.map(line => {
          const trimmed = line.trim();
          if (trimmed === "" || trimmed.startsWith("#")) {
            return line;
          }
          // It's a URL or relative path
          let resolvedUrl;
          try {
            // Correctly resolve relative URLs
            resolvedUrl = new URL(trimmed, url).href;
          } catch (e) {
            resolvedUrl = trimmed;
          }
          return `http://localhost:3000/api/proxy?url=${encodeURIComponent(resolvedUrl)}&referer=${encodeURIComponent(referer)}`;
        });

        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.send(modifiedLines.join("\n"));
      } else {
        // Pipe binary content directly (segments)
        res.setHeader("Content-Type", response.headers["content-type"] || "application/octet-stream");
        (response.data as any).pipe(res);
      }
    } catch (error: any) {
      console.error(`[Proxy] Fatal Error for ${url}:`, error.message);
      res.status(500).send(`Proxy fatal error: ${error.message}`);
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
