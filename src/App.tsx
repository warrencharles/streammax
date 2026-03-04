import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Trophy,
  Activity,
  Search,
  ChevronRight,
  X,
  Maximize,
  Volume2,
  VolumeX,
  RefreshCw,
  Tv,
  Twitter,
  Instagram,
  Github,
  MessageCircle,
  Zap,
  Calendar
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Hls from "hls.js";

interface Match {
  title: string;
  url: string;
  poster?: string;
}

interface MediaItem {
  id: string;
  title: string;
  poster: string;
  url: string;
  type: "movie" | "tv" | "series";
  quality?: string;
}

interface SportStanding {
  rank: string;
  team: string;
  played: string;
  points: string;
  logo?: string;
}

interface SportMatch {
  id: string;
  date: string;
  rawDate: string;
  homeTeam: string;
  awayTeam: string;
  score: string | null;
  status: 'upcoming' | 'finished' | 'live';
}

interface Episode {
  id: string;
  title: string;
  name: string;
}

interface Season {
  id: string;
  name: string;
  episodes: Episode[];
}

interface MediaDetails {
  id?: string;
  title: string;
  description: string;
  poster: string;
  type: "movie" | "tv" | "series";
  seasons?: Season[];
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'movies' | 'series' | 'sports'>('movies');
  const [sportsStandings, setSportsStandings] = useState<SportStanding[]>([]);
  const [sportsMatches, setSportsMatches] = useState<SportMatch[]>([]);
  const [activeSportSubTab, setActiveSportSubTab] = useState<'schedules' | 'standings'>('schedules');
  const [activeLeague, setActiveLeague] = useState<string>('PL');
  const [matches, setMatches] = useState<Match[]>([]);
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [tvShows, setTvShows] = useState<MediaItem[]>([]);
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [latest, setLatest] = useState<MediaItem[]>([]);
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [playerError, setPlayerError] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [itemDetails, setItemDetails] = useState<MediaDetails | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [fetchingStream, setFetchingStream] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sportsSearchQuery, setSportsSearchQuery] = useState("");
  const [sportsDataLoading, setSportsDataLoading] = useState(false);
  const [serverIndex, setServerIndex] = useState(0);
  const [totalServers, setTotalServers] = useState(0);
  const [isSwitchingServer, setIsSwitchingServer] = useState(false);

  const genres = [
    { id: "action", name: "Action" },
    { id: "adventure", name: "Adventure" },
    { id: "animation", name: "Animation" },
    { id: "comedy", name: "Comedy" },
    { id: "crime", name: "Crime" },
    { id: "documentary", name: "Documentary" },
    { id: "drama", name: "Drama" },
    { id: "family", name: "Family" },
    { id: "fantasy", name: "Fantasy" },
    { id: "horror", name: "Horror" },
    { id: "mystery", name: "Mystery" },
    { id: "romance", name: "Romance" },
    { id: "science-fiction", name: "Sci-Fi" },
    { id: "thriller", name: "Thriller" },
    { id: "war", name: "War" },
    { id: "western", name: "Western" },
  ];

  useEffect(() => {
    if (activeTab === "sports") fetchMatches();
    if (activeTab === "movies") {
      fetchMovies();
      fetchTrending();
    }
    if (activeTab === "series") {
      fetchTvShows();
      fetchTrending();
    }
  }, [activeTab]);

  const fetchSportsData = async (league: string) => {
    setSportsDataLoading(true);
    try {
      const [standingsRes, matchesRes] = await Promise.all([
        fetch(`/api/sports/standings/${league}`),
        fetch(`/api/sports/matches/${league}`)
      ]);
      const standingsData = await standingsRes.json();
      const matchesData = await matchesRes.json();
      if (Array.isArray(standingsData)) setSportsStandings(standingsData);
      if (Array.isArray(matchesData)) setSportsMatches(matchesData);
    } catch (error) {
      console.error('Error fetching sports data:', error);
    } finally {
      setSportsDataLoading(false);
    }
  };

  // Auto-refresh sports data every 10 minutes while the Sports tab is active
  useEffect(() => {
    if (activeTab !== 'sports') return;

    fetchSportsData(activeLeague);

    const interval = setInterval(() => {
      fetchSportsData(activeLeague);
    }, 10 * 60 * 1000); // every 10 minutes

    return () => clearInterval(interval);
  }, [activeTab, activeLeague]);

  const fetchTrending = async () => {
    try {
      const response = await fetch("/api/trending");
      const data = await response.json();
      setTrending(data);
    } catch (error) {
      console.error("Error fetching trending:", error);
    }
  };

  const handleSearch = async (query: string) => {
    if (activeTab === 'sports') {
      setSportsSearchQuery(query);
      return;
    }

    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error("Error searching:", error);
    }
  };

  const fetchByGenre = async (genreId: string) => {
    setLoading(true);
    setSelectedGenre(genreId);
    try {
      const type = activeTab === "movies" ? "movie" : "tv";
      const response = await fetch(`/api/genre/${genreId}?type=${type}`);
      const data = await response.json();
      setLatest(data);
      // Also scroll to top of content
      window.scrollTo({ top: 300, behavior: 'smooth' });
    } catch (error) {
      console.error("Error fetching genre:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/matches");
      const data = await response.json();
      setMatches(data);
    } catch (error) {
      console.error("Error fetching matches:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMovies = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/movies");
      const data = await response.json();
      if (Array.isArray(data)) {
        setMovies(data);
      } else {
        console.error("Expected array for movies, got:", data);
        setMovies([]);
      }
    } catch (error) {
      console.error("Error fetching movies:", error);
      setMovies([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTvShows = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/tv-shows");
      const data = await response.json();
      if (Array.isArray(data)) {
        setTvShows(data);
      } else {
        console.error("Expected array for tv-shows, got:", data);
        setTvShows([]);
      }
    } catch (error) {
      console.error("Error fetching TV shows:", error);
      setTvShows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMatchClick = async (match: Match) => {
    setSelectedMatch(match);
    setPlayerError(false);
    setFetchingStream(true);
    setStreamUrl(null);
    setEmbedUrl(null);

    const isHttps = window.location.protocol === "https:";
    const getSecureUrl = (url: string, referer?: string) => {
      // ONLY proxy if it's Mixed Content (HTTP on HTTPS)
      // Sports streams often need this.
      if (isHttps && url.startsWith("http://") && !url.includes(window.location.hostname)) {
        console.log("[Sports] Mixed Content detected, using secure-iframe proxy for:", url);
        return `/api/secure-iframe?url=${encodeURIComponent(url)}${referer ? `&referer=${encodeURIComponent(referer)}` : ""}`;
      }
      return url;
    };

    console.log("[Sports] Handling match click:", match.title, match.url);
    try {
      const response = await fetch(`/api/stream?url=${encodeURIComponent(match.url)}`);
      const data = await response.json();
      console.log("[Sports] Stream API response:", data);

      if (data.link) {
        if (data.type === "m3u8") {
          console.log("[Sports] Using M3U8 stream:", data.link);
          setStreamUrl(data.link);
        } else if (data.type === "iframe") {
          const finalUrl = getSecureUrl(data.link);
          console.log("[Sports] Using iframe embed:", finalUrl);
          setEmbedUrl(finalUrl);
        } else {
          // Fallback
          const finalUrl = getSecureUrl(match.url);
          console.log("[Sports] Fallback: using match URL directly:", finalUrl);
          setEmbedUrl(finalUrl);
        }
      } else {
        const finalUrl = getSecureUrl(match.url);
        console.log("[Sports] No link returned, using match URL directly:", finalUrl);
        setEmbedUrl(finalUrl);
      }
    } catch (error) {
      console.error("[Sports] Error fetching stream, falling back to direct embed:", error);
      const finalUrl = getSecureUrl(match.url);
      setEmbedUrl(finalUrl);
    } finally {
      setFetchingStream(false);
    }
  };

  const handleItemClick = async (item: MediaItem) => {
    setSelectedItem(item);
    setFetchingStream(true);
    setItemDetails(null);
    setEmbedUrl(null);
    setStreamUrl(null);
    try {
      const response = await fetch(`/api/details?url=${encodeURIComponent(item.url)}`);
      const data = await response.json();
      console.log("[Frontend] Details API response:", data);
      if (response.status !== 200) {
        console.error("[Frontend] Details API error:", data.error, data.message, data.stack);
        setFetchingStream(false);
        return;
      }
      setItemDetails(data);

      // If it's a movie, auto-fetch the source and let handleEpisodeClick own the loading state
      if ((data.type === "movie" || data.type === "tv") && data.id) {
        // Do NOT setFetchingStream(false) here - let handleEpisodeClick manage it
        await handleEpisodeClick(data.id, data.type === "movie" ? "movie" : "tv");
        return; // handleEpisodeClick already called setFetchingStream(false)
      }
    } catch (error) {
      console.error("Error fetching details:", error);
    }
    // Only reach here if we didn't launch handleEpisodeClick (e.g. tv series waiting for episode selection)
    setFetchingStream(false);
  };

  const handleEpisodeClick = async (id: string, type: string = "tv", index: number = 0) => {
    // Only block if we already have a stream or embed URL for this server index.
    // This allows the initial fetch (where urls are null) but stops redundant triggers.
    if (fetchingStream && index === serverIndex && (streamUrl || embedUrl)) {
      console.log("[Frontend] Skipping redundant handleEpisodeClick");
      return;
    }

    setFetchingStream(true);
    if (index > 0) setIsSwitchingServer(true);
    setEmbedUrl(null);
    setStreamUrl(null);
    setServerIndex(index);

    const isHttps = window.location.protocol === "https:";
    const getSecureUrl = (url: string) => {
      // ALWAYS proxy movie embeds on HTTPS to spoof the referer, 
      // otherwise servers like MegaCloud/UpCloud return "File Not Found".
      if (isHttps && !url.includes(window.location.hostname)) {
        console.log("[Movies] Proxying embed to spoof Referer:", url);
        return `/api/secure-iframe?url=${encodeURIComponent(url)}&referer=${encodeURIComponent("https://hdtodayz.to/")}`;
      }
      return url;
    };

    try {
      console.log(`[Frontend] Fetching source for ID: ${id}, type: ${type}, index: ${index}`);
      const response = await fetch(`/api/source?id=${id}&type=${type}&index=${index}`);
      const data = await response.json();

      if (data.error) {
        console.error("[Frontend] Source fetch error:", data.error);
        setIsSwitchingServer(false);
        return;
      }

      if (data.totalServers) setTotalServers(data.totalServers);

      if (data.link) {
        console.log(`[Frontend] Received source of type ${data.type} from server ${data.server} (Index: ${data.currentIndex})`);
        if (data.type === "m3u8") {
          setStreamUrl(data.link);
        } else {
          // It's an iframe (UpCloud, MegaCloud, etc.)
          setEmbedUrl(getSecureUrl(data.link));
        }
      } else {
        console.error("[Frontend] No link in response:", data);
      }
    } catch (error) {
      console.error("[Frontend] Error fetching source:", error);
    } finally {
      setFetchingStream(false);
      setIsSwitchingServer(false);
    }
  };

  const filteredMatches = matches.filter(m =>
    m.title.toLowerCase().includes(sportsSearchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-blue-500/30">
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute top-[40%] left-[30%] w-[30%] h-[30%] bg-blue-600/5 blur-[100px] rounded-full" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#020617]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 md:h-20 flex items-center justify-between gap-4 md:gap-8">
          <div className="flex items-center gap-2 md:gap-3 transition-transform hover:scale-105">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 rotate-3">
              <Zap className="w-5 h-5 md:w-6 md:h-6 text-white fill-current" />
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tighter italic">STREAM<span className="text-blue-500">MAX</span></h1>
          </div>

          <div className="flex-1 max-w-xl relative hidden md:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder={activeTab === 'sports' ? "Search match fixtures..." : "Search movies, series, or sports..."}
              value={activeTab === 'sports' ? sportsSearchQuery : searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-600"
            />
          </div>

          <div className="flex items-center gap-4 md:gap-8">
            <nav className="flex items-center gap-3 md:gap-6">
              {['sports', 'movies', 'series'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`text-[10px] md:text-xs font-black uppercase tracking-widest transition-colors ${activeTab === tab ? "text-blue-500" : "text-slate-500 hover:text-white"}`}
                >
                  {tab === 'series' ? 'Series' : tab}
                </button>
              ))}
            </nav>
            <RefreshCw
              onClick={() => {
                if (activeTab === "sports") fetchMatches();
                if (activeTab === "movies") fetchMovies();
                if (activeTab === "series") fetchTvShows();
              }}
              className={`w-4 h-4 md:w-5 md:h-5 text-slate-500 hover:text-blue-500 cursor-pointer transition-colors ${loading ? 'animate-spin' : ''}`}
            />
          </div>
        </div>
        {/* Mobile Search */}
        <div className="md:hidden px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search..."
              value={activeTab === 'sports' ? sportsSearchQuery : searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none placeholder:text-slate-600"
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Genre Bar */}
        {activeTab !== "sports" && (
          <div className="mb-6 md:mb-10 overflow-x-auto no-scrollbar flex items-center gap-2 md:gap-3 pb-2 px-1">
            <button
              onClick={() => {
                setSelectedGenre(null);
                if (activeTab === "movies") fetchMovies();
                else fetchTvShows();
              }}
              className={`px-4 md:px-5 py-1.5 md:py-2 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border shrink-0 ${!selectedGenre ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-white/5 border-white/5 text-slate-500 hover:text-white'}`}
            >
              All
            </button>
            {genres.map(genre => (
              <button
                key={genre.id}
                onClick={() => fetchByGenre(genre.id)}
                className={`px-4 md:px-5 py-1.5 md:py-2 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border whitespace-nowrap shrink-0 ${selectedGenre === genre.id ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-white/5 border-white/5 text-slate-500 hover:text-white'}`}
              >
                {genre.name}
              </button>
            ))}
          </div>
        )}

        {/* Hero Section */}
        <div className="mb-12 md:mb-20 relative rounded-[2rem] md:rounded-[3rem] overflow-hidden group min-h-[350px] md:min-h-[500px] flex items-center">
          <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#020617] via-[#020617]/80 md:via-[#020617]/40 to-transparent z-10" />
          {activeTab === "sports" ? (
            <SportsHeroAnimation />
          ) : (
            <motion.img
              key={activeTab}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              src={activeTab === "movies" ? "https://picsum.photos/seed/movies/1920/1080" : "https://picsum.photos/seed/series/1920/1080"}
              alt="Hero"
              className="absolute inset-0 w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          )}
          <div className="relative z-20 px-6 md:px-16 py-12 md:py-20 max-w-2xl mt-auto md:mt-0">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] mb-4 md:mb-6">
                <Activity className="w-3 h-3 animate-pulse" />
                Trending {activeTab === "sports" ? "Match" : activeTab === "movies" ? "Movie" : "Series"}
              </span>
              <h2 className="text-3xl md:text-7xl font-black text-white mb-4 md:mb-8 leading-[1] tracking-tighter italic">
                {activeTab === "sports" ? "ULTIMATE SPORTS" : activeTab === "movies" ? "CINEMATIC MAGIC" : "EPIC STORIES"}
              </h2>
              <p className="text-slate-400 text-sm md:text-xl mb-8 md:mb-12 leading-relaxed font-medium italic max-w-lg">
                Exclusive high-definition delivery of {activeTab === "sports" ? "the world's biggest matches" : "global entertainment"} with zero lag and premium sound.
              </p>
              <div className="flex flex-wrap gap-3 md:gap-5">
                <button className="px-6 md:px-10 py-3 md:py-5 bg-blue-500 hover:bg-blue-600 text-white text-[10px] md:text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-[0_0_40px_rgba(59,130,246,0.3)] flex items-center gap-3 group active:scale-95">
                  <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" />
                  Stream Now
                  <ChevronRight className="w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button className="px-6 md:px-10 py-3 md:py-5 bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-2xl transition-all border border-white/5 backdrop-blur-3xl">
                  {activeTab === "sports" ? "Full Schedule" : "Add to List"}
                </button>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="space-y-16">
          {activeTab !== 'sports' && searchQuery.length > 1 ? (
            <section>
              <div className="flex items-center gap-4 mb-8">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Search Results</h3>
                <div className="h-px flex-1 bg-white/5" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {searchResults.map((item, index) => (
                  <MediaCard key={index} item={item} onClick={() => handleItemClick(item)} />
                ))}
              </div>
            </section>
          ) : activeTab !== 'sports' && selectedGenre ? (
            <section>
              <div className="flex items-center gap-4 mb-8">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
                  {genres.find(g => g.id === selectedGenre)?.name || selectedGenre} {activeTab === "movies" ? "Movies" : "Series"}
                </h3>
                <div className="h-px flex-1 bg-white/5" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {loading ? (
                  Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="h-[250px] rounded-[16px] bg-slate-800/50 animate-pulse border border-white/5" />
                  ))
                ) : latest.length > 0 ? (
                  latest.map((item, index) => (
                    <MediaCard key={index} item={item} onClick={() => handleItemClick(item)} />
                  ))
                ) : (
                  <div className="col-span-full text-center py-20 bg-white/5 rounded-[2rem] border border-white/5">
                    <p className="text-slate-500 text-lg font-black uppercase tracking-widest italic">No content found in this category.</p>
                  </div>
                )}
              </div>
            </section>
          ) : activeTab === "sports" ? (
            <div className="flex flex-col lg:flex-row gap-12">
              <div className="flex-[2] space-y-12">
                <section>
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Live Broadcasts</h3>
                      <div className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-[8px] font-black uppercase animate-pulse">Live</div>
                    </div>
                    <div className="h-px flex-1 bg-white/5 ml-4" />
                  </div>
                  {loading ? (
                    <div className="grid gap-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-24 bg-slate-800/20 rounded-2xl animate-pulse" />
                      ))}
                    </div>
                  ) : filteredMatches.length > 0 ? (
                    <div className="grid gap-4">
                      {filteredMatches.map((match, index) => (
                        <MatchListItem key={index} match={match} onClick={() => handleMatchClick(match)} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20 bg-white/5 rounded-[2rem] border border-white/5 backdrop-blur-xl">
                      <p className="text-slate-500 text-lg font-black uppercase tracking-widest italic">No match streams found.</p>
                    </div>
                  )}
                </section>


              </div>

              {/* Sidebar Stats Hub */}
              <div className="lg:w-80 space-y-8">
                <div className="sticky top-24">
                  <div className="flex items-center gap-3 mb-6">
                    <Trophy className="w-5 h-5 text-blue-500" />
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter italic">Stats Data Hub</h3>
                  </div>
                  <div className="bg-[#0f172a]/50 backdrop-blur-xl border border-white/5 rounded-2xl p-3 md:p-4 shadow-2xl">
                    <SportsHub
                      activeSubTab={activeSportSubTab}
                      setSubTab={setActiveSportSubTab}
                      activeLeague={activeLeague}
                      setLeague={setActiveLeague}
                      standings={sportsStandings}
                      matches={sportsMatches}
                      loading={sportsDataLoading}
                    />
                  </div>

                  <div className="mt-8 p-6 rounded-[2rem] bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20">
                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Premium Experience</h4>
                    <p className="text-[11px] text-slate-300 font-medium leading-relaxed italic">
                      Access high-speed stadium links and real-time statistics directly from the global network.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {trending.filter(t => t.type === (activeTab === "movies" ? "movie" : "tv")).length > 0 && (
                <section>
                  <div className="flex items-center gap-4 mb-8">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">🔥 Trending Now</h3>
                    <div className="h-px flex-1 bg-white/5" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {trending
                      .filter(t => t.type === (activeTab === "movies" ? "movie" : "tv"))
                      .slice(0, 6)
                      .map((item, index) => (
                        <MediaCard key={index} item={item} onClick={() => handleItemClick(item)} />
                      ))}
                  </div>
                </section>
              )}

              <section>
                <div className="flex items-center gap-4 mb-8">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
                    {activeTab === "movies" ? "✨ Latest Movies" : "📺 Latest Series"}
                  </h3>
                  <div className="h-px flex-1 bg-white/5" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {loading ? (
                    Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="h-[250px] rounded-[16px] bg-slate-800/50 animate-pulse border border-white/5" />
                    ))
                  ) : (activeTab === "movies" ? movies : tvShows).map((item, index) => (
                    <MediaCard key={index} item={item} onClick={() => handleItemClick(item)} />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      <footer className="mt-20 md:mt-32 border-t border-white/5 py-12 md:py-20 bg-[#010410]">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8 md:gap-12">
            <div className="flex flex-col items-center md:items-start gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 rotate-3">
                  <Zap className="w-5 h-5 md:w-6 md:h-6 text-white fill-current" />
                </div>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tighter italic">STREAM<span className="text-blue-500">MAX</span></h2>
              </div>
              <p className="text-slate-500 text-[10px] md:text-xs font-black uppercase tracking-widest text-center md:text-left">
                The future of cinematic entertainment, delivered instantly.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-8 md:gap-12">
              <div className="flex flex-col items-center md:items-start gap-4">
                <h4 className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Network</h4>
                <div className="flex gap-4">
                  <Twitter className="w-4 h-4 md:w-5 md:h-5 text-slate-600 hover:text-blue-400 cursor-pointer transition-colors" />
                  <Instagram className="w-4 h-4 md:w-5 md:h-5 text-slate-600 hover:text-pink-400 cursor-pointer transition-colors" />
                  <Github className="w-4 h-4 md:w-5 md:h-5 text-slate-600 hover:text-white cursor-pointer transition-colors" />
                </div>
              </div>
              <div className="flex flex-col items-center md:items-start gap-4">
                <h4 className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Support</h4>
                <div className="flex gap-6 text-[10px] md:text-xs font-black text-slate-600 uppercase tracking-widest">
                  <a href="#" className="hover:text-blue-500 transition-colors">Privacy</a>
                  <a href="#" className="hover:text-blue-500 transition-colors">Terms</a>
                  <a href="#" className="hover:text-blue-500 transition-colors">Contact</a>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-12 md:mt-20 pt-8 border-t border-white/5 text-center">
            <p className="text-[8px] md:text-[9px] font-black text-slate-700 uppercase tracking-[0.5em]">
              &copy; 2024 STREAMMAX ARCHITECTURE. ALL RIGHTS RESERVED.
            </p>
          </div>
        </div>
      </footer>

      {/* Video Player & Details Modal */}
      <AnimatePresence>
        {(selectedMatch || selectedItem) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-8 bg-[#020617]/95 backdrop-blur-2xl overflow-hidden"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glow-card relative w-full max-w-[1400px] h-full max-h-[96vh] md:max-h-[85vh] overflow-hidden shadow-2xl flex flex-col md:flex-row bg-[#050a18] border border-white/10"
            >
              <div className="glow-card-aura" />

              {/* Player Area (Left on Desktop, Top on Mobile) */}
              <div className="relative flex-[6] md:flex-[7] bg-black group overflow-hidden min-h-[240px] md:min-h-0 aspect-video md:aspect-auto">
                {fetchingStream ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#010410]">
                    <div className="w-10 h-10 border-[3px] border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-blue-500 font-black uppercase tracking-[0.3em] text-[8px] animate-pulse">Establishing Secure Stream...</p>
                  </div>
                ) : (streamUrl && !playerError) ? (
                  <div className="w-full h-full">
                    <VideoPlayer
                      url={streamUrl}
                      title={selectedMatch?.title || selectedItem?.title || ""}
                      onPlaybackFailed={() => {
                        if (selectedItem && itemDetails && serverIndex < totalServers - 1) {
                          handleEpisodeClick(itemDetails.id || selectedItem.id, selectedItem.type, serverIndex + 1);
                        }
                      }}
                      onError={() => {
                        console.log("Switching to iframe fallback due to player error");
                        setPlayerError(true);
                        if (selectedMatch) setEmbedUrl(selectedMatch.url);
                      }}
                    />
                  </div>
                ) : (embedUrl || (streamUrl && playerError)) ? (
                  <div className="w-full h-full relative">
                    <iframe
                      src={embedUrl || selectedMatch?.url}
                      className="w-full h-full border-none"
                      allowFullScreen
                      allow="autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    // Removing sandbox for now as it often breaks aggressive third-party players
                    // but keeping high-permission allow attributes
                    />
                    {/* Watchdog for iframe loading */}
                    <IframeWatchdog
                      onTimeout={() => {
                        if (selectedItem && itemDetails && serverIndex < totalServers - 1) {
                          handleEpisodeClick(itemDetails.id || selectedItem.id, selectedItem.type, serverIndex + 1);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-800 bg-[#010410]">
                    <div className="relative">
                      <Play className="w-16 h-16 opacity-5" />
                      <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full" />
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-center px-6">
                      {isSwitchingServer
                        ? `Switching to alternate server (${serverIndex + 1}/${totalServers})...`
                        : selectedMatch
                          ? "Loading match stream..."
                          : selectedItem?.type === "tv" || selectedItem?.type === "series"
                            ? "Select an episode to begin playback"
                            : "Initializing source connection"}
                    </p>
                    {isSwitchingServer && (
                      <button
                        onClick={() => handleEpisodeClick(itemDetails?.id || selectedItem?.id, selectedItem?.type, (serverIndex + 1) % (totalServers || 1))}
                        className="mt-4 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl text-[8px] font-black text-blue-500 uppercase tracking-widest transition-all"
                      >
                        Force Next Server
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Close Button moved to parent modal for better accessibility */}
              {/* Close Button - High Z-Index for Mobile */}
              <button
                onClick={() => {
                  setSelectedMatch(null);
                  setSelectedItem(null);
                  setItemDetails(null);
                  setStreamUrl(null);
                  setEmbedUrl(null);
                }}
                className="fixed top-4 right-4 md:absolute md:top-6 md:right-6 p-3.5 md:p-4 rounded-full bg-black/80 backdrop-blur-3xl border border-white/20 text-white shadow-[0_0_30px_rgba(0,0,0,0.5)] z-[100] group transition-all active:scale-90"
                aria-label="Close Player"
              >
                <X className="w-6 h-6 md:w-8 md:h-8" />
              </button>

              {/* Info Sidebar (Right on Desktop, Bottom on Mobile) */}
              <div className="relative flex-[4] md:flex-[3] flex flex-col bg-[#050a18]/40 backdrop-blur-md border-t md:border-t-0 md:border-l border-white/5 h-full overflow-hidden">

                <div className="flex-1 overflow-y-auto no-scrollbar p-6 md:p-10">
                  {!itemDetails && !selectedMatch ? (
                    <div className="space-y-6 animate-pulse">
                      <div className="h-2 w-16 bg-white/5 rounded" />
                      <div className="h-10 w-full bg-white/5 rounded-xl" />
                      <div className="flex gap-2">
                        <div className="h-5 w-12 bg-white/5 rounded-full" />
                        <div className="h-5 w-12 bg-white/5 rounded-full" />
                      </div>
                      <div className="h-20 w-full bg-white/5 rounded-xl" />
                    </div>
                  ) : (
                    <div>
                      <span className="text-[9px] md:text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mb-3 block">Premium 4K Stream</span>
                      <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-white mb-4 tracking-tighter italic leading-tight">
                        {itemDetails?.title || selectedMatch?.title || selectedItem?.title}
                      </h2>

                      <div className="flex flex-wrap gap-2 mb-6">
                        <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">{itemDetails?.year || "2024"}</span>
                        <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[8px] md:text-[9px] font-black text-blue-500 uppercase tracking-widest">{itemDetails?.quality || "ULTRA HD"}</span>
                        <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">{itemDetails?.duration || "125 MIN"}</span>
                      </div>

                      <p className="text-slate-400 text-[11px] md:text-xs leading-relaxed mb-8 italic font-medium">
                        {itemDetails?.description || "High-fidelity premium streaming optimized for architectural precision. Experience cinema at its peak."}
                      </p>

                      {itemDetails?.seasons && itemDetails.seasons.length > 0 && (
                        <div className="space-y-6 mb-4">
                          {itemDetails.seasons.map((season) => (
                            <div key={season.id} className="relative">
                              <div className="flex items-center gap-3 mb-4">
                                <h3 className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{season.name}</h3>
                                <div className="h-px flex-1 bg-white/5" />
                              </div>
                              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-5 gap-1 md:gap-2">
                                {season.episodes.map((ep) => (
                                  <button
                                    key={ep.id}
                                    onClick={() => handleEpisodeClick(ep.id)}
                                    className={`aspect-square md:aspect-auto md:px-1.5 md:py-1.5 rounded-lg transition-all text-center border overflow-hidden ${embedUrl?.includes(ep.id) || streamUrl?.includes(ep.id) ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' : 'bg-white/5 border-white/5 text-slate-500 hover:text-white hover:bg-white/10'}`}
                                  >
                                    <span className="text-[10px] md:text-[9px] font-black block truncate">{ep.name.match(/\d+/)?.[0] || ep.name}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Stats Meta */}
                <div className="p-6 md:p-8 bg-[#010410]/40 border-t border-white/5 mt-auto shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[8px] md:text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Critic Score</span>
                    <span className="text-[9px] md:text-[10px] font-black text-blue-500 uppercase italic">Rank {itemDetails?.rating ? `${itemDetails.rating}/10` : "9.8"}</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: itemDetails?.rating ? `${parseFloat(itemDetails.rating) * 10}%` : "98%" }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-blue-700 to-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div >
  );
};

const MatchListItem: React.FC<{ match: Match; onClick: () => void }> = ({ match, onClick }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1, scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      onClick={onClick}
      className="relative group cursor-pointer w-full overflow-hidden rounded-xl border border-white/5 hover:border-blue-500/50 transition-all bg-[#0f172a]/40 backdrop-blur-2xl shadow-md hover:shadow-blue-500/5"
    >
      {/* Broadcast Overlay Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300" />

      <div className="relative z-10 p-3 md:p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0 w-full">
          <div className="relative shrink-0">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center p-2 shadow-inner group-hover:border-blue-500/30 transition-colors">
              <Trophy className="w-full h-full text-slate-500 group-hover:text-blue-500 group-hover:rotate-12 transition-all duration-500" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-[#0f172a] animate-pulse" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                <Activity className="w-2.5 h-2.5 text-blue-500" />
                <span className="text-[7px] font-black text-blue-500 uppercase tracking-widest">LIVE</span>
              </div>
              <span className="text-[7px] font-bold text-slate-600 uppercase tracking-wider italic">HD • STABLE</span>
            </div>
            <h3 className="text-sm md:text-lg font-black text-white group-hover:text-blue-400 transition-colors truncate italic tracking-tighter uppercase leading-tight font-sans" style={{ letterSpacing: '-0.01em' }}>
              {match.title}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto border-t md:border-t-0 md:border-l border-white/5 pt-3 md:pt-0 md:pl-4 justify-between md:justify-end">
          <div className="hidden sm:flex flex-col items-end gap-0.5 px-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className={`w-0.5 h-2 rounded-full ${i <= 4 ? 'bg-blue-500' : 'bg-slate-800'}`} />
              ))}
            </div>
            <span className="text-[6px] font-black text-slate-600 uppercase tracking-widest">SIGNAL</span>
          </div>

          <button className="px-4 md:px-6 py-2 md:py-2.5 bg-white/5 hover:bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all border border-white/10 hover:border-blue-500 flex items-center gap-2 shadow-lg active:scale-95">
            WATCH
            <Play className="w-3 h-3 fill-current" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const MediaCard: React.FC<{ item: MediaItem; onClick: () => void }> = ({ item, onClick }) => {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="glow-card group cursor-pointer h-full"
    >
      <div className="glow-card-aura" />
      <div className="relative z-10 h-full flex flex-col">
        <div className="relative aspect-[2/3] rounded-[16px] overflow-hidden m-0.5">
          <img
            src={item.poster}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
          {item.quality && (
            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-blue-500 text-[8px] font-black text-white shadow-lg border border-white/10 uppercase">
              {item.quality}
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shadow-2xl shadow-blue-500/40 transform scale-75 group-hover:scale-100 transition-transform duration-300">
              <Play className="w-5 h-5 text-white fill-current ml-0.5" />
            </div>
          </div>
        </div>

        <div className="p-3 flex-1 flex flex-col justify-between">
          <h3 className="text-[11px] font-black text-white group-hover:text-blue-400 transition-colors line-clamp-1 mb-1 leading-tight uppercase tracking-tight">
            {item.title}
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black">
              {item.type === "movie" ? "Movie" : "Series"}
            </span>
            <span className="text-[8px] font-black text-blue-500/80 uppercase">4K</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const VideoPlayer: React.FC<{ url: string; title: string; onError?: (err: any) => void; onPlaybackFailed?: () => void }> = ({ url, title, onError, onPlaybackFailed }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const isUnmounted = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const playbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Start a 6-second watchdog timer for playback
    // If isPlaying doesn't become true, signal failure
    if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);

    playbackTimeoutRef.current = setTimeout(() => {
      if (!isPlaying && !isUnmounted.current) {
        console.warn("[VideoPlayer] Playback watchdog triggered after 20s");
        onPlaybackFailed?.();
      }
    }, 20000); // Relaxed for Vercel buffering

    return () => {
      if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
    };
  }, [url, isPlaying]);
  useEffect(() => {
    isUnmounted.current = false;

    const playVideo = async () => {
      const video = videoRef.current;
      if (video && video.isConnected && !isUnmounted.current) {
        try {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            await playPromise;
            if (!isUnmounted.current) setIsPlaying(true);
          }
        } catch (error: any) {
          if (isUnmounted.current) return;
          if (error.name !== "AbortError" && error.name !== "NotAllowedError") {
            console.error("Initial playback failed:", error);
          }
        }
      }
    };

    if (videoRef.current) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.ERROR, function (event, data) {
          if (data.fatal) {
            console.error("HLS fatal error:", data.type, data);
            onError?.(data);
          }
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          playVideo();
        });
      } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
        videoRef.current.src = url;
        const onVideoError = (e: any) => {
          console.error("Video element error:", e);
          onError?.(e);
        };
        videoRef.current.addEventListener("error", onVideoError);
        const onLoadedMetadata = () => {
          playVideo();
        };
        videoRef.current.addEventListener("loadedmetadata", onLoadedMetadata);

        return () => {
          videoRef.current?.removeEventListener("error", onVideoError);
          videoRef.current?.removeEventListener("loadedmetadata", onLoadedMetadata);
        };
      }
    }

    return () => {
      isUnmounted.current = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = "";
        videoRef.current.load();
      }
    };
  }, [url]);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video || !video.isConnected || isUnmounted.current) return;

    try {
      if (isPlaying) {
        video.pause();
        setIsPlaying(false);
      } else {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          await playPromise;
          if (!isUnmounted.current) setIsPlaying(true);
        }
      }
    } catch (error: any) {
      if (isUnmounted.current) return;
      if (error.name !== "AbortError" && error.name !== "NotAllowedError") {
        console.error("Toggle play failed:", error);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  };

  return (
    <div
      className="relative w-full h-full group touch-none"
      onMouseMove={handleMouseMove}
      onClick={() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
      }}
      style={{ cursor: showControls ? 'default' : 'none' }}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain bg-black"
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
        playsInline
      />

      {/* Custom Controls Overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 flex flex-col justify-between p-6"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <h4 className="font-semibold text-white truncate max-w-md">{title}</h4>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <button onClick={togglePlay} className="text-white hover:text-blue-400 transition-colors">
                  {isPlaying ? <X className="w-8 h-8" /> : <Play className="w-8 h-8 fill-current" />}
                </button>

                <div className="flex items-center gap-3">
                  <button onClick={toggleMute} className="text-white hover:text-blue-400 transition-colors">
                    {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setVolume(v);
                      if (videoRef.current) videoRef.current.volume = v;
                    }}
                    className="w-24 accent-blue-500 h-1 rounded-full cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="px-2 py-1 rounded bg-white/10 text-[10px] font-bold text-white">1080P</div>
                <button
                  onClick={() => videoRef.current?.requestFullscreen()}
                  className="text-white hover:text-blue-400 transition-colors"
                >
                  <Maximize className="w-6 h-6" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Play/Pause Large Icon on Click */}
      {!isPlaying && !showControls && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Play className="w-20 h-20 text-white/20" />
        </div>
      )}
    </div>
  );
};

const FootballPlayer: React.FC = () => {
  return (
    <motion.svg
      viewBox="0 0 200 200"
      className="w-48 h-48 md:w-64 md:h-64 text-blue-500 drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]"
      initial="initial"
      animate="animate"
    >
      {/* Ball */}
      <motion.circle
        cx="160" cy="170" r="8"
        fill="currentColor"
        variants={{
          animate: {
            x: [0, 40, 0],
            y: [0, -40, 0],
            scale: [1, 1.2, 1],
            transition: { duration: 2, repeat: Infinity, ease: "easeOut" }
          }
        }}
      />
      {/* Player Silhouette */}
      <motion.path
        d="M60,180 L80,140 L70,100 L90,60 L110,40 L130,60 L120,90 L140,130 L160,165"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ d: "M60,180 L80,140 L70,100 L90,60 L110,40 L130,60 L120,90 L140,130 L160,165" }}
        animate={{
          d: [
            "M60,180 L80,140 L70,100 L90,60 L110,40 L130,60 L120,90 L140,130 L160,165",
            "M60,180 L80,140 L70,100 L90,60 L110,40 L130,60 L120,90 L110,130 L90,160",
            "M60,180 L80,140 L70,100 L90,60 L110,40 L130,60 L120,90 L140,130 L160,165"
          ]
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Head */}
      <motion.circle
        cx="110" cy="30" r="12"
        fill="currentColor"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.svg>
  );
};

const SportsHeroAnimation: React.FC = () => {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#020617]">
      {/* Stadium Floodlight Effect */}
      <div className="absolute top-0 left-1/4 w-[50%] h-[150%] bg-blue-500/10 blur-[150px] rotate-12 transform -translate-y-1/2" />
      <div className="absolute top-0 right-1/4 w-[50%] h-[150%] bg-indigo-500/10 blur-[150px] -rotate-12 transform -translate-y-1/2" />

      {/* Modern Pitch Patterns */}
      <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none">
        <pattern id="pitchPattern" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="transparent" />
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(59,130,246,0.05)" strokeWidth="0.1" />
        </pattern>
        <rect width="100" height="100" fill="url(#pitchPattern)" />

        {/* Central Dynamic Circle */}
        <motion.circle
          cx="50" cy="50" r="30"
          initial={{ r: 30, opacity: 0.1 }}
          stroke="rgba(59,130,246,0.1)" strokeWidth="0.1" fill="none"
          animate={{ r: [30, 32, 30], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>

      {/* Data Streams (Matrix-like sports stats) */}
      <div className="absolute inset-x-0 top-0 h-full overflow-hidden opacity-20 pointer-events-none">
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-[8px] font-black text-blue-500/40 uppercase tracking-widest whitespace-nowrap"
            initial={{ top: -100, left: `${i * 7}%` }}
            animate={{ top: "110%" }}
            transition={{ duration: 15 + Math.random() * 20, repeat: Infinity, ease: "linear", delay: i * 2 }}
          >
            {[...Array(20)].map(() => "GOAL SCORE MATCH WIN STADIUM DATA ").join(" ")}
          </motion.div>
        ))}
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="relative z-10 flex flex-col items-center"
        >
          <div className="relative mb-8">
            <FootballPlayer />
            <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full -z-10 animate-pulse" />
          </div>

          <div className="flex items-center gap-8 opacity-40 grayscale group-hover:grayscale-0 transition-all duration-1000">
            <Trophy className="w-12 h-12 text-blue-500" />
            <Activity className="w-12 h-12 text-indigo-500" />
            <Zap className="w-12 h-12 text-blue-400" />
          </div>
        </motion.div>
      </div>

      {/* Immersive Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-[#020617]/40 z-20" />
    </div>
  );
};

const SportsTable: React.FC<{ data: any[], type: 'standings' | 'matches' }> = ({ data, type }) => {
  if (data.length === 0) return (
    <div className="flex flex-col items-center justify-center py-10 text-gray-500">
      <Trophy className="w-8 h-8 mb-2 opacity-20" />
      <p className="text-[10px] uppercase font-bold tracking-widest">No data available</p>
    </div>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/5 backdrop-blur-md">
      <table className="w-full text-left text-xs">
        <thead className="bg-white/10 text-gray-400 uppercase text-[9px] font-bold tracking-wider">
          {type === 'standings' ? (
            <tr>
              <th className="px-2 py-3 w-8">#</th>
              <th className="px-2 py-3">Team</th>
              <th className="px-2 py-3 w-10 text-center">PL</th>
              <th className="px-2 py-3 w-10 text-right">PTS</th>
            </tr>
          ) : (
            <tr>
              <th className="px-2 py-3">Date</th>
              <th className="px-2 py-3">Match</th>
              <th className="px-2 py-3 text-center">Result</th>
            </tr>
          )
          }
        </thead >
        <tbody className="divide-y divide-white/5">
          {data.map((item, idx) => (
            <motion.tr
              key={idx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.02 }}
              className="hover:bg-white/5 transition-colors group"
            >
              {type === 'standings' ? (
                <>
                  <td className="px-2 py-2.5 text-gray-500 font-medium">{item.rank}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2 max-w-[120px] md:max-w-none">
                      {item.logo && (
                        <img
                          src={item.logo}
                          alt=""
                          className="w-4 h-4 object-contain brightness-110 shrink-0"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      )}
                      <span className="font-semibold text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight truncate">
                        {item.team}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-center text-gray-400">{item.played}</td>
                  <td className="px-2 py-2.5 text-right font-bold text-blue-400">{item.points}</td>
                </>
              ) : (
                <>
                  <td className="px-2 py-2.5 text-gray-400 whitespace-nowrap text-[10px]">{item.date}</td>
                  <td className="px-2 py-2.5 font-semibold text-white uppercase tracking-tighter text-[11px] truncate max-w-[100px]">{item.teams || `${item.homeTeam} vs ${item.awayTeam}`}</td>
                  <td className="px-2 py-2.5 text-center">
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono font-bold border border-blue-500/30 text-[10px]">
                      {item.score || 'VS'}
                    </span>
                  </td>
                </>
              )}
            </motion.tr>
          ))}
        </tbody>
      </table >
    </div >
  );
};

const SportsHub: React.FC<{
  activeSubTab: 'schedules' | 'standings',
  setSubTab: (t: 'schedules' | 'standings') => void,
  activeLeague: string,
  setLeague: (l: string) => void,
  standings: SportStanding[],
  matches: SportMatch[],
  loading: boolean
}> = ({ activeSubTab, setSubTab, activeLeague, setLeague, standings, matches, loading }) => {
  const [resultsQuery, setResultsQuery] = React.useState('');
  const [results, setResults] = React.useState<SportMatch[]>([]);
  const [resultsLoading, setResultsLoading] = React.useState(false);
  const [showSearch, setShowSearch] = React.useState(false);

  const leagues = [
    { id: 'PL', name: 'Premier League' },
    { id: 'CL', name: 'Champions League' },
    { id: 'BL1', name: 'Bundesliga' },
    { id: 'SA', name: 'Serie A' },
    { id: 'PD', name: 'La Liga' },
    { id: 'FL1', name: 'Ligue 1' }
  ];

  const searchResults = async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setResultsLoading(true);
    try {
      const res = await fetch(`/api/sports/results/${activeLeague}?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch { setResults([]); }
    finally { setResultsLoading(false); }
  };

  React.useEffect(() => {
    const timeout = setTimeout(() => searchResults(resultsQuery), 500);
    return () => clearTimeout(timeout);
  }, [resultsQuery, activeLeague]);

  return (
    <div className="space-y-4">
      {/* Compact Header: Tabs + League Selector in one row */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-1 p-0.5 bg-white/5 rounded-xl border border-white/10 w-fit">
          {(['schedules', 'standings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeSubTab === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-gray-500 hover:text-white'
                }`}
            >
              <div className="flex items-center gap-1.5">
                {tab === 'schedules' ? <Calendar className="w-3 h-3" /> : <Trophy className="w-3 h-3" />}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </div>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1">
          {leagues.map((league) => (
            <button
              key={league.id}
              onClick={() => setLeague(league.id)}
              className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border transition-all ${activeLeague === league.id ? 'bg-white text-black border-white' : 'text-gray-400 border-white/5 hover:border-white/20'
                }`}
            >
              {league.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="popLayout">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid gap-2"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse border border-white/5" />
            ))}
          </motion.div>
        ) : activeSubTab === 'schedules' ? (
          <motion.div key={`sched-${activeLeague}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {/* League label */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-3 flex-1 min-w-[150px]">
                <div className="w-1 h-5 bg-blue-600 rounded-full" />
                <span className="text-white font-bold text-sm truncate">{leagues.find(l => l.id === activeLeague)?.name} Fixtures</span>
              </div>

              {/* Past Results Search Toggle */}
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white text-[10px] font-semibold transition-all whitespace-nowrap"
              >
                <Search className="w-3 h-3" />
                Past Results
              </button>
            </div>

            {/* Past Results Search Panel */}
            {showSearch && (
              <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-3">
                <input
                  type="text"
                  placeholder="Search team... (e.g. Arsenal, Liverpool)"
                  value={resultsQuery}
                  onChange={e => setResultsQuery(e.target.value)}
                  className="w-full bg-white/10 border border-white/10 text-white placeholder-gray-500 text-sm rounded-lg px-4 py-2.5 outline-none focus:border-blue-500/50 transition-all"
                />
                {resultsLoading ? (
                  <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : results.length > 0 ? (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar">
                    {results.map((r, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg">
                        <span className="text-xs text-gray-400">{r.date}</span>
                        <span className="text-sm font-semibold text-white text-center flex-1 mx-2">
                          {r.homeTeam} <span className="text-blue-400 px-1">{r.score}</span> {r.awayTeam}
                        </span>
                        <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">FT</span>
                      </div>
                    ))}
                  </div>
                ) : resultsQuery ? (
                  <p className="text-center text-gray-600 text-xs py-4">No results found</p>
                ) : null}
              </div>
            )}

            {/* Fixture Cards */}
            {matches.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xl">📅</div>
                <p className="text-gray-500 text-xs font-semibold">No fixtures available yet</p>
                <p className="text-gray-700 text-[10px] max-w-[200px] leading-relaxed">Data is refreshed every 30 min. Try switching leagues or check back shortly.</p>
                <button
                  onClick={() => setLeague(activeLeague)}
                  className="mt-1 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const grouped: Record<string, SportMatch[]> = {};
                  // Filter out finished matches for the schedule view
                  const scheduleMatches = matches.filter(m => m.status !== 'finished');

                  scheduleMatches.forEach(m => {
                    const day = m.date.split(' · ')[0];
                    if (!grouped[day]) grouped[day] = [];
                    grouped[day].push(m);
                  });

                  if (scheduleMatches.length === 0) {
                    return <div className="text-center py-12 text-gray-600 text-sm">No upcoming fixtures found</div>;
                  }

                  return Object.entries(grouped).map(([day, dayMatches]) => (
                    <div key={day}>
                      <div className="text-[10px] font-black uppercase text-blue-400 tracking-widest mb-1.5 px-1">{day}</div>
                      <div className="space-y-1">
                        {dayMatches.map((match, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center gap-2 px-3 py-3 rounded-xl border transition-all ${match.status === 'live'
                              ? 'bg-red-500/5 border-red-500/20'
                              : 'bg-white/3 border-white/8 hover:bg-white/8'
                              }`}
                          >
                            {/* Time or Live Badge */}
                            <div className="w-10 shrink-0">
                              {match.status === 'live' ? (
                                <div className="flex flex-col items-center">
                                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                                  <span className="text-[7px] font-black text-red-500 uppercase mt-0.5 animate-pulse">Live</span>
                                </div>
                              ) : (
                                <div className="text-[10px] font-mono text-gray-500">
                                  {match.date.split(' · ')[1]}
                                </div>
                              )}
                            </div>
                            {/* Home Team */}
                            <div className="flex-1 text-right min-w-0">
                              <span className={`text-[11px] font-bold block leading-tight uppercase tracking-tighter break-words ${match.status === 'live' ? 'text-white' : 'text-gray-300'}`}>
                                {match.homeTeam}
                              </span>
                            </div>
                            {/* Score or VS */}
                            <div className="shrink-0 w-10 flex items-center justify-center">
                              {match.score ? (
                                <span className={`px-1.5 py-0.5 text-[10px] font-black rounded-md border ${match.status === 'live'
                                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  }`}>
                                  {match.score}
                                </span>
                              ) : (
                                <span className="text-[8px] font-black text-gray-700 tracking-widest">VS</span>
                              )}
                            </div>
                            {/* Away Team */}
                            <div className="flex-1 text-left min-w-0">
                              <span className={`text-[11px] font-bold block leading-tight uppercase tracking-tighter break-words ${match.status === 'live' ? 'text-white' : 'text-gray-300'}`}>
                                {match.awayTeam}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key={`stand-${activeLeague}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-1 h-5 bg-blue-600 rounded-full" />
              <span className="text-white font-bold text-sm">{leagues.find(l => l.id === activeLeague)?.name} Standings</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>
            <SportsTable data={standings} type="standings" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const IframeWatchdog: React.FC<{ onTimeout: () => void }> = ({ onTimeout }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onTimeout();
    }, 25000); // 25s for iframe as they take longer to spin up on Vercel
    return () => clearTimeout(timer);
  }, [onTimeout]);
  return null;
};

export default App;
