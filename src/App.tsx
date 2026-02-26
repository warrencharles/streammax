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
  MessageCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Hls from "hls.js";

interface Match {
  title: string;
  url: string;
}

interface MediaItem {
  id: string;
  title: string;
  poster: string;
  url: string;
  type: "movie" | "tv";
  quality?: string;
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
  type: "movie" | "tv";
  seasons?: Season[];
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"sports" | "movies" | "tv">("movies");
  const [matches, setMatches] = useState<Match[]>([]);
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [tvShows, setTvShows] = useState<MediaItem[]>([]);
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [latest, setLatest] = useState<MediaItem[]>([]);
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [itemDetails, setItemDetails] = useState<MediaDetails | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [fetchingStream, setFetchingStream] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
    { id: "sci-fi", name: "Sci-Fi" },
    { id: "thriller", name: "Thriller" },
  ];

  useEffect(() => {
    if (activeTab === "sports") fetchMatches();
    if (activeTab === "movies") {
      fetchMovies();
      fetchTrending();
    }
    if (activeTab === "tv") {
      fetchTvShows();
      fetchTrending();
    }
  }, [activeTab]);

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
      const response = await fetch(`/api/genre/${genreId}`);
      const data = await response.json();
      if (activeTab === "movies") setMovies(data);
      else setTvShows(data);
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
      setMovies(data);
    } catch (error) {
      console.error("Error fetching movies:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTvShows = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/tv-shows");
      const data = await response.json();
      setTvShows(data);
    } catch (error) {
      console.error("Error fetching TV shows:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMatchClick = async (match: Match) => {
    setSelectedMatch(match);
    setFetchingStream(true);
    setStreamUrl(null);
    setEmbedUrl(null);
    try {
      const response = await fetch(`/api/stream?url=${encodeURIComponent(match.url)}`);
      const data = await response.json();
      if (data.streamUrl) {
        setStreamUrl(data.streamUrl);
      } else {
        console.error("Stream fetch failed:", data);
        alert("The stream is currently being prepared or is unavailable.");
      }
    } catch (error) {
      console.error("Error fetching stream:", error);
    } finally {
      setFetchingStream(false);
    }
  };

  const handleItemClick = async (item: MediaItem) => {
    setSelectedItem(item);
    setFetchingStream(true);
    setItemDetails(null);
    try {
      const response = await fetch(`/api/details?url=${encodeURIComponent(item.url)}`);
      const data = await response.json();
      setItemDetails(data);
      
      // If it's a movie, we can automatically try to get the source
      if (data.type === "movie" && data.id) {
        handleEpisodeClick(data.id);
      }
    } catch (error) {
      console.error("Error fetching details:", error);
    } finally {
      setFetchingStream(false);
    }
  };

  const handleEpisodeClick = async (id: string) => {
    setFetchingStream(true);
    setEmbedUrl(null);
    setStreamUrl(null);
    try {
      const response = await fetch(`/api/source?id=${id}`);
      const data = await response.json();
      if (data.link) {
        if (data.type === "m3u8") {
          setStreamUrl(data.link);
        } else {
          setEmbedUrl(data.link);
        }
      }
    } catch (error) {
      console.error("Error fetching source:", error);
    } finally {
      setFetchingStream(false);
    }
  };

  const filteredMatches = matches.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase())
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
      <header className="sticky top-0 z-40 backdrop-blur-md border-b border-white/5 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.4)]">
              <Tv className="text-white w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              StreamMax
            </h1>
          </div>

          <div className="relative flex-1 max-w-md mx-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input 
              type="text" 
              placeholder={`Search ${activeTab}...`} 
              className="w-full bg-slate-800/50 border border-white/5 rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-600 text-sm"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-6 mr-6">
              <button 
                onClick={() => setActiveTab("sports")}
                className={`text-sm font-medium transition-colors ${activeTab === "sports" ? "text-blue-400" : "text-slate-400 hover:text-white"}`}
              >
                Sports
              </button>
              <button 
                onClick={() => setActiveTab("movies")}
                className={`text-sm font-medium transition-colors ${activeTab === "movies" ? "text-blue-400" : "text-slate-400 hover:text-white"}`}
              >
                Movies
              </button>
              <button 
                onClick={() => setActiveTab("tv")}
                className={`text-sm font-medium transition-colors ${activeTab === "tv" ? "text-blue-400" : "text-slate-400 hover:text-white"}`}
              >
                TV Shows
              </button>
            </nav>
            <RefreshCw 
              onClick={() => {
                if (activeTab === "sports") fetchMatches();
                if (activeTab === "movies") fetchMovies();
                if (activeTab === "tv") fetchTvShows();
              }}
              className={`w-5 h-5 text-slate-400 hover:text-blue-400 cursor-pointer transition-colors ${loading ? 'animate-spin' : ''}`} 
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Genre Bar */}
        {activeTab !== "sports" && (
          <div className="mb-8 overflow-x-auto no-scrollbar flex items-center gap-3 pb-2">
            <button 
              onClick={() => {
                setSelectedGenre(null);
                if (activeTab === "movies") fetchMovies();
                else fetchTvShows();
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all border ${!selectedGenre ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
            >
              All
            </button>
            {genres.map(genre => (
              <button 
                key={genre.id}
                onClick={() => fetchByGenre(genre.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all border whitespace-nowrap ${selectedGenre === genre.id ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
              >
                {genre.name}
              </button>
            ))}
          </div>
        )}

        {/* Hero Section */}
        <div className="mb-16 relative rounded-[2.5rem] overflow-hidden group min-h-[450px] flex items-center">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f172a] via-[#0f172a]/60 to-transparent z-10" />
          <motion.img 
            key={activeTab}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            src={activeTab === "sports" ? "https://picsum.photos/seed/sports/1920/1080" : activeTab === "movies" ? "https://picsum.photos/seed/movies/1920/1080" : "https://picsum.photos/seed/tv/1920/1080"} 
            alt="Hero" 
            className="absolute inset-0 w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="relative z-20 px-12 py-16 max-w-2xl">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[10px] font-bold uppercase tracking-widest mb-6">
                <Activity className="w-3 h-3 animate-pulse" />
                Featured {activeTab === "sports" ? "Match" : activeTab === "movies" ? "Movie" : "Show"}
              </span>
              <h2 className="text-5xl md:text-6xl font-black text-white mb-6 leading-[1.1]">
                {activeTab === "sports" ? "Live Sports Action" : activeTab === "movies" ? "Trending Movies" : "Popular TV Shows"}
              </h2>
              <p className="text-slate-400 text-lg mb-10 leading-relaxed">
                Experience {activeTab === "sports" ? "every match" : "every story"} in stunning 4K quality. StreamMax brings you the best entertainment from around the globe with zero interruptions.
              </p>
              <div className="flex flex-wrap gap-4">
                <button className="px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-2xl transition-all shadow-[0_0_30px_rgba(59,130,246,0.4)] flex items-center gap-3 group hover:scale-105 active:scale-95">
                  <Play className="w-5 h-5 fill-current" />
                  Watch Now
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/10 backdrop-blur-md">
                  View Schedule
                </button>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="space-y-16">
          {searchQuery.length > 1 ? (
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
          ) : (
            <>
              {activeTab !== "sports" && trending.length > 0 && (
                <section>
                  <div className="flex items-center gap-4 mb-8">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Trending Now</h3>
                    <div className="h-px flex-1 bg-white/5" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {trending.filter(t => t.type === (activeTab === "movies" ? "movie" : "tv")).slice(0, 6).map((item, index) => (
                      <MediaCard key={index} item={item} onClick={() => handleItemClick(item)} />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <div className="flex items-center gap-4 mb-8">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
                    {activeTab === "sports" ? "Live Matches" : activeTab === "movies" ? "Latest Movies" : "Latest TV Shows"}
                  </h3>
                  <div className="h-px flex-1 bg-white/5" />
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {loading ? (
                    Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="h-[250px] rounded-[16px] bg-slate-800/50 animate-pulse border border-white/5" />
                    ))
                  ) : activeTab === "sports" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 col-span-full">
                      {filteredMatches.length > 0 ? (
                        filteredMatches.map((match, index) => (
                          <MatchCard 
                            key={index} 
                            match={match} 
                            onClick={() => handleMatchClick(match)} 
                          />
                        ))
                      ) : (
                        <div className="col-span-full text-center py-20">
                          <p className="text-slate-500 text-lg">No matches found matching your search.</p>
                        </div>
                      )}
                    </div>
                  ) : activeTab === "movies" ? (
                    <>
                      {movies.map((movie, index) => (
                        <MediaCard 
                          key={index} 
                          item={movie} 
                          onClick={() => handleItemClick(movie)} 
                        />
                      ))}
                    </>
                  ) : (
                    <>
                      {tvShows.map((show, index) => (
                        <MediaCard 
                          key={index} 
                          item={show} 
                          onClick={() => handleItemClick(show)} 
                        />
                      ))}
                    </>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
      
      {/* Footer */}
      <footer className="mt-12 border-t border-white/5 bg-slate-900/50 backdrop-blur-md py-6">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
              <Tv className="text-white w-4 h-4" />
            </div>
            <span className="text-lg font-bold text-white">StreamMax</span>
            <span className="text-slate-500 text-xs ml-4 hidden md:inline">© 2024. All action, no ads.</span>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex gap-4">
              <a href="#" className="text-slate-400 hover:text-blue-400 transition-colors"><Twitter className="w-4 h-4" /></a>
              <a href="#" className="text-slate-400 hover:text-blue-400 transition-colors"><Instagram className="w-4 h-4" /></a>
              <a href="#" className="text-slate-400 hover:text-blue-400 transition-colors"><MessageCircle className="w-4 h-4" /></a>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex gap-4 text-[10px] uppercase tracking-widest text-slate-500">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
            </div>
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/98 backdrop-blur-xl overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 40 }}
              className="glow-card relative w-full max-w-[1200px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col md:flex-row min-h-[600px]"
            >
              <div className="glow-card-aura" />
              
              {/* Left Side: Player (70%) */}
              <div className="relative flex-[7] bg-black group">
                {fetchingStream ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950">
                    <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-blue-400 font-black uppercase tracking-widest text-xs animate-pulse">Initializing Stream...</p>
                  </div>
                ) : streamUrl ? (
                  <VideoPlayer url={streamUrl} title={selectedMatch?.title || selectedItem?.title || ""} />
                ) : embedUrl ? (
                  <iframe 
                    src={embedUrl} 
                    className="w-full h-full border-none" 
                    allowFullScreen 
                    allow="autoplay; encrypted-media"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-slate-700 bg-slate-950">
                    <Play className="w-24 h-24 opacity-5" />
                    <p className="text-sm font-black uppercase tracking-[0.2em]">{selectedItem?.type === "tv" ? "Select an episode to begin" : "Source connection pending"}</p>
                  </div>
                )}
              </div>

              {/* Right Side: Sidebar (30%) */}
              <div className="relative flex-[3] bg-[#0a0a0a] border-l border-white/5 p-8 flex flex-col z-40">
                <button 
                  onClick={() => {
                    setSelectedMatch(null);
                    setSelectedItem(null);
                    setItemDetails(null);
                    setStreamUrl(null);
                    setEmbedUrl(null);
                  }}
                  className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>

                <div className="flex-1 overflow-y-auto no-scrollbar">
                  {!itemDetails && !selectedMatch ? (
                    <div className="space-y-8 animate-pulse">
                      <div className="space-y-4">
                        <div className="h-2 w-20 bg-white/5 rounded" />
                        <div className="h-12 w-full bg-white/5 rounded" />
                        <div className="flex gap-2">
                          <div className="h-6 w-16 bg-white/5 rounded-full" />
                          <div className="h-6 w-16 bg-white/5 rounded-full" />
                        </div>
                      </div>
                      <div className="h-24 w-full bg-white/5 rounded" />
                      <div className="space-y-4">
                        <div className="h-2 w-24 bg-white/5 rounded" />
                        <div className="grid grid-cols-4 gap-2">
                          {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="h-10 bg-white/5 rounded" />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-8">
                      <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-4 block">Premium Content</span>
                      <h2 className="text-4xl font-black text-white mb-4 tracking-tighter leading-none italic">
                        {itemDetails?.title || selectedMatch?.title || selectedItem?.title}
                      </h2>
                      
                      <div className="flex flex-wrap gap-2 mb-8">
                        <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-slate-400 uppercase">{itemDetails?.year || "2024"}</span>
                        <span className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-[10px] font-black text-blue-400 uppercase">{itemDetails?.quality || "HD 4K"}</span>
                        <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-slate-400 uppercase">{itemDetails?.duration || "120 MIN"}</span>
                      </div>

                      <div className="mb-8">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Playback Server</h4>
                        <div className="flex gap-2">
                          <button className="px-4 py-2 rounded-lg bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20">UpCloud</button>
                          <button className="px-4 py-2 rounded-lg bg-white/5 text-slate-500 text-[10px] font-black uppercase tracking-widest border border-white/5">MegaCloud</button>
                        </div>
                      </div>

                      <p className="text-slate-500 text-sm leading-relaxed mb-8 italic">
                        {itemDetails?.description || "Experience high-fidelity premium streaming. This title is optimized for ultra-high-definition delivery across all your devices."}
                      </p>

                      {itemDetails?.seasons && itemDetails.seasons.length > 0 ? (
                        <div className="space-y-8 mb-8">
                          {itemDetails.seasons.map((season) => (
                            <div key={season.id}>
                              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">{season.name}</h3>
                              <div className="grid grid-cols-4 gap-2">
                                {season.episodes.map((ep) => (
                                  <button
                                    key={ep.id}
                                    onClick={() => handleEpisodeClick(ep.id)}
                                    className="px-2 py-2 rounded bg-white/5 hover:bg-blue-500/20 border border-white/5 hover:border-blue-500/40 transition-all text-center group"
                                  >
                                    <span className="text-[10px] font-black text-slate-500 group-hover:text-white">{ep.name.replace(/Episode\s*/i, '')}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : selectedItem?.type === "tv" && itemDetails && (
                        <div className="py-10 text-center border border-dashed border-white/5 rounded-2xl">
                          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">No episodes found</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-6 border-t border-white/5 mt-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Elite Rank</span>
                    <span className="text-[10px] font-black text-blue-500 uppercase">{itemDetails?.rating ? `${itemDetails.rating}/10` : "9.9/10"}</span>
                  </div>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: itemDetails?.rating ? `${parseFloat(itemDetails.rating) * 10}%` : "99%" }}
                      className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MatchCard: React.FC<{ match: Match; onClick: () => void }> = ({ match, onClick }) => {
  return (
    <motion.div 
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="glow-card group cursor-pointer h-full"
    >
      <div className="glow-card-aura" />
      <div className="relative z-10 h-full p-8 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Trophy className="w-6 h-6" />
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-900/50 px-2 py-1 rounded border border-white/5">
              LIVE STREAM
            </div>
          </div>
          <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-2 leading-tight mb-4">
            {match.title}
          </h3>
        </div>
        
        <div className="mt-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Activity className="w-4 h-4 text-blue-500" />
            <span className="font-medium">High Quality</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
            <Play className="w-6 h-6 text-white fill-current ml-1" />
          </div>
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
              {item.type === "movie" ? "Movie" : "TV"}
            </span>
            <span className="text-[8px] font-black text-blue-500/80 uppercase">4K</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const VideoPlayer: React.FC<{ url: string; title: string }> = ({ url, title }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const isUnmounted = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          playVideo();
        });
      } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
        videoRef.current.src = url;
        const onLoadedMetadata = () => {
          playVideo();
        };
        videoRef.current.addEventListener("loadedmetadata", onLoadedMetadata);
        
        return () => {
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
      className="relative w-full h-full group cursor-none"
      onMouseMove={handleMouseMove}
      style={{ cursor: showControls ? 'default' : 'none' }}
    >
      <video 
        ref={videoRef}
        className="w-full h-full object-contain bg-black"
        onClick={togglePlay}
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

export default App;
