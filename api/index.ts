import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import cors from "cors";
import { sql } from "@vercel/postgres";
import fs from "fs";
import path from "path";

// ─────────────────────────────────────────────────────────────────────────────
// Sports Data Persistence (Vercel Postgres + Local Fallback)
// Ensures data persists even when the serverless function restarts.
// ─────────────────────────────────────────────────────────────────────────────

const LEAGUES = ['PL', 'CL', 'BL1', 'SA', 'PD', 'FL1'];
const CACHE_REFRESH_MS = 5 * 60 * 1000; // 5 minutes
const IS_VERCEL = process.env.VERCEL === '1';
const LOCAL_CACHE_PATH = path.join(process.cwd(), 'sports-cache.json');

interface CachedLeagueData {
    standings: any[];
    matches: any[];
    lastUpdated: string | null;
}

async function getSportsCache(league: string): Promise<CachedLeagueData> {
    if (IS_VERCEL) {
        try {
            const { rows } = await sql`SELECT data, updated_at FROM sports_cache WHERE league = ${league}`;
            if (rows.length > 0) {
                return {
                    ...JSON.parse(rows[0].data),
                    lastUpdated: rows[0].updated_at
                };
            }
        } catch (e: any) {
            console.error(`[DB] Read error (${league}):`, e.message);
            // If table doesn't exist, create it once
            try {
                console.log('[DB] Attempting to create sports_cache table...');
                await sql`CREATE TABLE IF NOT EXISTS sports_cache (league TEXT PRIMARY KEY, data TEXT, updated_at TIMESTAMP)`;
            } catch (ce: any) {
                console.error('[DB] Table creation failed:', ce.message);
            }
        }
    } else if (fs.existsSync(LOCAL_CACHE_PATH)) {
        try {
            const all = JSON.parse(fs.readFileSync(LOCAL_CACHE_PATH, 'utf8'));
            if (all[league]) return all[league];
        } catch { }
    }
    return { standings: [], matches: [], lastUpdated: null };
}

async function setSportsCache(league: string, standings: any[], matches: any[]) {
    const lastUpdated = new Date().toISOString();
    const data = JSON.stringify({ standings, matches });

    if (IS_VERCEL) {
        try {
            await sql`
        INSERT INTO sports_cache (league, data, updated_at) 
        VALUES (${league}, ${data}, ${lastUpdated})
        ON CONFLICT (league) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
      `;
        } catch (e) {
            console.error(`[DB] Write error (${league}):`, e);
        }
    } else {
        try {
            let all: any = {};
            if (fs.existsSync(LOCAL_CACHE_PATH)) all = JSON.parse(fs.readFileSync(LOCAL_CACHE_PATH, 'utf8'));
            all[league] = { standings, matches, lastUpdated };
            fs.writeFileSync(LOCAL_CACHE_PATH, JSON.stringify(all, null, 2));
        } catch { }
    }
}

// Shared UA and encoding helpers for sports scraping
const SPORTS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function updateLeagueData(league: string): Promise<CachedLeagueData> {
    console.log(`[Sports] Fetching fresh data for ${league}...`);
    try {
        const fetchWithRetry = async (url: string, retries = 2): Promise<Buffer> => {
            let lastErr: any;
            for (let attempt = 0; attempt <= retries; attempt++) {
                try {
                    const res = await axios.get(url, { responseType: 'arraybuffer', headers: { 'User-Agent': SPORTS_UA }, timeout: 15000 });
                    return Buffer.from(res.data);
                } catch (err: any) {
                    lastErr = err;
                    if (attempt < retries) await new Promise(r => setTimeout(r, 2000));
                }
            }
            throw lastErr;
        };

        const [standingsBuf, fixturesBuf] = await Promise.all([
            fetchWithRetry(`https://native-stats.org/competition/${league}/`),
            fetchWithRetry(`https://native-stats.org/competition/${league}/fixtures/`)
        ]);

        const standings = parseStandings(decodeSportsBuffer(standingsBuf));
        const matches = parseMatches(decodeSportsBuffer(fixturesBuf));

        await setSportsCache(league, standings, matches);
        return { standings, matches, lastUpdated: new Date().toISOString() };
    } catch (err: any) {
        console.error(`[Sports] Update failed for ${league}:`, err.message);
        const cached = await getSportsCache(league);
        return cached;
    }
}

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

const app = express();
app.use(cors());
app.use(express.json());

// Log incoming requests for debugging Vercel path issues
app.use((req, res, next) => {
    console.log(`[Server] ${req.method} ${req.url}`);
    next();
});

// ─────────────────────────────────────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// Health check endpoint (no DB, no scraping)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', environment: IS_VERCEL ? 'vercel' : 'local' });
});

// Database test endpoint
app.get("/api/test-db", async (req, res) => {
    if (!IS_VERCEL) return res.json({ status: 'ok', message: 'Local storage used' });
    try {
        const { rows } = await sql`SELECT NOW()`;
        res.json({ status: 'ok', time: rows[0].now });
    } catch (e: any) {
        console.error('[Health] DB Test Error:', e.message);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// Background refresh only if NOT on Vercel
if (!IS_VERCEL) {
    const refreshAll = () => Promise.allSettled(LEAGUES.map(l => updateLeagueData(l)));
    refreshAll();
    setInterval(refreshAll, 60 * 60 * 1000); // 1 hour background sync for local
}


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
// Sports Data — persistent caching
// ---------------------------------------------------------
app.get('/api/sports/standings/:league', async (req, res) => {
    const { league } = req.params;
    let data = await getSportsCache(league);

    const isStale = !data.lastUpdated || (new Date().getTime() - new Date(data.lastUpdated).getTime()) > CACHE_REFRESH_MS;
    if (isStale || data.standings.length === 0) {
        data = await updateLeagueData(league);
    }

    console.log(`[Sports] Serving ${league} standings (${data.lastUpdated})`);
    res.json(data.standings);
});

app.get('/api/sports/matches/:league', async (req, res) => {
    const { league } = req.params;
    let data = await getSportsCache(league);

    const isStale = !data.lastUpdated || (new Date().getTime() - new Date(data.lastUpdated).getTime()) > CACHE_REFRESH_MS;
    if (isStale || data.matches.length === 0) {
        data = await updateLeagueData(league);
    }

    console.log(`[Sports] Serving ${league} matches (${data.lastUpdated})`);
    res.json(data.matches);
});

app.get('/api/sports/results/:league', async (req, res) => {
    const { league } = req.params;
    const { q } = req.query as { q?: string };

    let data = await getSportsCache(league);
    const isStale = !data.lastUpdated || (new Date().getTime() - new Date(data.lastUpdated).getTime()) > CACHE_REFRESH_MS;
    if (isStale || data.matches.length === 0) {
        data = await updateLeagueData(league);
    }

    let results = (data.matches ?? []).filter((m: any) => m.status === 'finished');

    if (q) {
        const query = (q as string).toLowerCase();
        results = results.filter((m: any) =>
            m.homeTeam.toLowerCase().includes(query) || m.awayTeam.toLowerCase().includes(query)
        );
    }

    res.json(results);
});

app.get('/api/sports/cache-status', async (_req, res) => {
    const status: any = {};
    for (const l of LEAGUES) {
        const data = await getSportsCache(l);
        status[l] = {
            standings: data.standings.length,
            matches: data.matches.length,
            lastUpdated: data.lastUpdated ?? 'never'
        };
    }
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

        let selector = ".flw-item";
        if (response.request.path.includes("home")) {
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

        let selector = ".flw-item";
        if (response.request.path.includes("home")) {
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

    try {
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

        const response = await axios.get(targetUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://hdtodayz.to/"
            },
            maxRedirects: 5,
            timeout: 12000
        });

        const $ = cheerio.load(response.data);
        const title = $(".heading-name a").text().trim() || $(".heading-name").text().trim() || $("h2").first().text().trim() || "Unknown Title";
        const description = $(".description").text().trim() || $(".detail-description").text().trim() || "";
        const poster = $(".film-poster-img").attr("src") || $(".film-poster img").attr("src") || $(".film-poster img").attr("data-src") || "";

        let showId: string | undefined;
        const idMatch = (response.data as string).match(/data-id=["'](\d+)["']/);
        if (idMatch) showId = idMatch[1];
        if (!showId) showId = $("#watch-now").attr("data-id") || $(".btn-play").attr("data-id");
        if (!showId) showId = targetUrl.split("-").pop();

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
            const seasonsRes = await axios.get(`https://hdtodayz.to/ajax/season/list/${showId}`, {
                headers: { "User-Agent": "Mozilla/5.0", "X-Requested-With": "XMLHttpRequest", "Referer": targetUrl },
                timeout: 8000
            });
            const $s = cheerio.load(seasonsRes.data);
            for (const el of $s(".ss-item").toArray()) {
                const seasonId = $s(el).attr("data-id");
                const seasonName = $s(el).text().trim();
                if (!seasonId) continue;
                const epsRes = await axios.get(`https://hdtodayz.to/ajax/season/episodes/${seasonId}`, {
                    headers: { "User-Agent": "Mozilla/5.0", "X-Requested-With": "XMLHttpRequest", "Referer": targetUrl },
                    timeout: 8000
                });
                const $e = cheerio.load(epsRes.data);
                const episodes: any[] = [];
                $e(".eps-item").each((_, epEl) => {
                    const epId = $e(epEl).attr("data-id");
                    const epTitle = $e(epEl).attr("title") || $e(epEl).text().trim();
                    if (epId) episodes.push({ id: epId, title: epTitle, name: epTitle });
                });
                seasons.push({ id: seasonId, name: seasonName, episodes });
            }
        }

        res.json({ id: showId, title, description, poster, type, year, duration, quality, rating, seasons: seasons.length > 0 ? seasons : undefined });
    } catch (err: any) {
        res.status(500).json({ error: "Failed to fetch details", message: err.message });
    }
});

app.get("/api/source", async (req, res) => {
    const { id, type, index } = req.query;
    if (!id) return res.status(400).json({ error: "ID is required" });

    const serverIndex = parseInt(index as string) || 0;
    const ajaxHeaders = {
        "User-Agent": "Mozilla/5.0",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://hdtodayz.to/"
    };

    try {
        const effectiveListUrl = type === "tv" ? `https://hdtodayz.to/ajax/episode/servers/${id}` : `https://hdtodayz.to/ajax/episode/list/${id}`;
        console.log(`[Source] Fetching servers from: ${effectiveListUrl}`);
        const listRes = await axios.get(effectiveListUrl, { headers: ajaxHeaders, timeout: 10000 });
        const $ = cheerio.load(listRes.data);
        const servers = $(".nav-item a[data-id]").map((_, el) => ({ id: $(el).attr("data-id")!, name: $(el).text().trim() || $(el).attr("title") || "Unknown" })).get();

        console.log(`[Source] Found ${servers.length} servers: ${servers.map(s => s.name).join(", ")}`);
        if (servers.length === 0) return res.status(404).json({ error: "No servers found" });

        for (let i = serverIndex; i < servers.length; i++) {
            const server = servers[i];
            try {
                console.log(`[Source] Fetching link for server: ${server.name} (${server.id})`);
                const srcRes = await axios.get(`https://hdtodayz.to/ajax/episode/sources/${server.id}`, { headers: ajaxHeaders, timeout: 10000 });
                const embedLink = srcRes.data?.link;
                if (!embedLink) {
                    console.log(`[Source] Server ${server.name} returned NO link`);
                    continue;
                }

                console.log(`[Source] Server ${server.name} returned embed: ${embedLink}`);

                if (embedLink.includes("videostr.net") || embedLink.includes("rabbitstream.net") || embedLink.includes("megacloud.tv") || embedLink.includes("upcloud")) {
                    const embedPage = await axios.get(embedLink, { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://hdtodayz.to/" }, timeout: 8000 });
                    const m3u8Match = embedPage.data.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
                    if (m3u8Match) {
                        console.log(`[Source] Found M3U8 in embed: ${m3u8Match[1]}`);
                        return res.json({ type: "m3u8", link: `/api/proxy?url=${encodeURIComponent(m3u8Match[1])}&referer=${encodeURIComponent("https://hdtodayz.to/")}`, server: server.name, totalServers: servers.length, currentIndex: i });
                    }
                }
                return res.json({ type: "iframe", link: embedLink, server: server.name, totalServers: servers.length, currentIndex: i });
            } catch (err: any) {
                console.error(`[Source] Server ${server.name} error:`, err.message);
                if (index !== undefined) break;
            }
        }
        return res.status(404).json({ error: "No playable source found" });
    } catch (error: any) {
        console.error(`[Source] Fatal error:`, error.message);
        res.status(500).json({ error: "Failed to fetch source", message: error.message });
    }
});

app.get("/api/matches", async (req, res) => {
    try {
        const response = await axios.get("http://www.fawanews.sc/", { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 12000 });
        const $ = cheerio.load(response.data);
        const matches: any[] = [];

        $(".user-item").each((_, el) => {
            const $link = $(el).find("a").first();
            const href = $link.attr("href");
            const name = $(el).find(".user-item__name").text().trim();
            const playing = $(el).find(".user-item__playing").text().trim();
            const poster = $(el).find("img").attr("src") || $(el).find("img").attr("data-src") || "";
            if (href && href.endsWith(".html") && name && playing) {
                matches.push({ title: `${name} — ${playing}`, sport: playing, url: href.startsWith("http") ? href : `http://www.fawanews.sc/${href}`, poster: poster.startsWith("http") ? poster : (poster ? `http://www.fawanews.sc/${poster}` : "") });
            }
        });

        const uniqueMatches = Array.from(new Map(matches.map(m => [m.url, m])).values());
        res.json(uniqueMatches);
    } catch {
        res.status(500).json({ error: "Failed to fetch matches" });
    }
});

app.get("/api/stream", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") return res.status(400).json({ error: "URL is required" });
    try {
        const response = await axios.get(url, { headers: { "User-Agent": "Mozilla/5.0", "Referer": "http://www.fawanews.sc/" }, timeout: 12000 });
        const html = response.data as string;
        const $ = cheerio.load(html);

        let streamUrl = "";
        const anyM3u8Match = html.match(/["'](https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)["']/i);
        if (anyM3u8Match) streamUrl = anyM3u8Match[1];

        if (!streamUrl) {
            $("script").each((_, el) => {
                const content = $(el).html() || "";
                const m3u8Regex = /(?:source|file|url|src|videos|hls)\s*[:=,]\s*[[ ]*["']((?:https?:\/\/|\/)[^"']+\.m3u8[^"']*)["']/i;
                const match = content.match(m3u8Regex);
                if (match) { streamUrl = match[1].startsWith("/") ? `http://www.fawanews.sc${match[1]}` : match[1]; return false; }
            });
        }

        if (streamUrl) {
            return res.json({ type: "m3u8", link: `/api/proxy?url=${encodeURIComponent(streamUrl)}` });
        }
        return res.json({ type: "iframe", link: url });
    } catch {
        return res.json({ type: "iframe", link: url });
    }
});

app.get("/api/secure-iframe", async (req, res) => {
    const { url, referer } = req.query;
    if (!url || typeof url !== "string") return res.status(400).send("URL required");

    // Default referer for sports if not provided
    const targetReferer = (referer as string) || "http://www.fawanews.sc/";

    try {
        const response = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Referer": targetReferer
            }
        });
        let html = response.data;
        // Inject <base> tag to resolve relative assets on the original host
        const baseTag = `<base href="${url}">`;
        if (html.includes("<head>")) {
            html = html.replace("<head>", `<head>${baseTag}`);
        } else {
            html = baseTag + html;
        }
        res.setHeader("Content-Type", "text/html");
        res.send(html);
    } catch (e: any) {
        res.status(500).send(`Failed to proxy iframe: ${e.message}`);
    }
});

app.get("/api/proxy", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") return res.status(400).send("URL is required");
    try {
        const isM3U8 = url.toLowerCase().includes(".m3u8");
        let referer = req.query.referer as string || "http://www.fawanews.sc/";
        if (!req.query.referer) {
            if (url.includes("videostr.net") || url.includes("rabbitstream.net") || url.includes("megacloud.tv") || url.includes("upcloud") || url.includes("hdtoday")) referer = "https://hdtodayz.to/";
        }
        const response = await axios.get(url, { headers: { "User-Agent": "Mozilla/5.0", "Referer": referer }, responseType: isM3U8 ? "text" : "stream", timeout: 15000, validateStatus: () => true });
        if (response.status >= 400) return res.status(response.status).send(`Remote server error: ${response.status}`);
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "*");
        if (isM3U8) {
            const lines = (response.data as string).split("\n");
            const modifiedLines = lines.map(line => {
                const trimmed = line.trim();
                if (trimmed === "" || trimmed.startsWith("#")) return line;
                let resolvedUrl;
                try { resolvedUrl = new URL(trimmed, url).href; } catch { resolvedUrl = trimmed; }
                return `/api/proxy?url=${encodeURIComponent(resolvedUrl)}&referer=${encodeURIComponent(referer)}`;
            });
            res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
            res.send(modifiedLines.join("\n"));
        } else {
            res.setHeader("Content-Type", response.headers["content-type"] || "application/octet-stream");
            (response.data as any).pipe(res);
        }
    } catch (error: any) {
        res.status(500).send(`Proxy fatal error: ${error.message}`);
    }
});

// Vite middleware for development (only if not on Vercel)
if (!IS_VERCEL && process.env.NODE_ENV !== "production") {
    import('vite').then(({ createServer: createViteServer }) => {
        createViteServer({ server: { middlewareMode: true }, appType: "spa" }).then(vite => { app.use(vite.middlewares); });
    });
} else if (!IS_VERCEL) {
    app.use(express.static("dist"));
    app.get("*", (req, res) => { res.sendFile(path.join(process.cwd(), "dist/index.html")); });
}

if (!IS_VERCEL) {
    const PORT = 3003;
    app.listen(PORT, "0.0.0.0", () => { console.log(`Server running on http://localhost:${PORT}`); });
}

export default app;
