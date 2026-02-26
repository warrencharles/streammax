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

const App: React.FC = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [fetchingStream, setFetchingStream] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchMatches();
  }, []);

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

  const handleMatchClick = async (match: Match) => {
    setSelectedMatch(match);
    setFetchingStream(true);
    setStreamUrl(null);
    try {
      const response = await fetch(`/api/stream?url=${encodeURIComponent(match.url)}`);
      const data = await response.json();
      if (data.streamUrl) {
        setStreamUrl(data.streamUrl);
      } else {
        console.error("Stream fetch failed:", data);
        alert("The stream is currently being prepared or is unavailable. Please try again in a moment or check another channel.");
      }
    } catch (error) {
      console.error("Error fetching stream:", error);
      alert("Error loading stream.");
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
              placeholder="Search matches..." 
              className="w-full bg-slate-800/50 border border-white/5 rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-600 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button 
            onClick={fetchMatches}
            className="p-2 hover:bg-white/5 rounded-full transition-colors group"
          >
            <RefreshCw className={`w-5 h-5 text-slate-400 group-hover:text-blue-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero Section */}
        {!selectedMatch && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 p-8 md:p-12 shadow-2xl">
              <div className="relative z-10 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-6">
                  <Activity className="w-3 h-3 animate-pulse" />
                  LIVE NOW
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                  Experience Sports Like <span className="text-blue-400">Never Before</span>
                </h2>
                <p className="text-slate-400 text-lg mb-8">
                  Stream your favorite matches in high definition. No ads, no interruptions, just pure action.
                </p>
                <div className="flex gap-4">
                  <button className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:scale-105 active:scale-95">
                    Browse Matches
                  </button>
                </div>
              </div>
              <div className="absolute right-[-10%] top-[-10%] w-96 h-96 bg-blue-500/20 blur-[100px] rounded-full" />
            </div>
          </motion.div>
        )}

        {/* Match List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 rounded-2xl bg-slate-800/50 animate-pulse border border-white/5" />
            ))
          ) : filteredMatches.length > 0 ? (
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

      {/* Video Player Modal */}
      <AnimatePresence>
        {selectedMatch && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/90 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glow-card relative w-full max-w-5xl aspect-video overflow-hidden shadow-2xl"
            >
              <div className="glow-card-aura" />
              <div className="relative z-10 w-full h-full">
                {/* Close & Refresh Buttons */}
              <div className="absolute top-4 right-4 z-50 flex gap-2">
                <button 
                  onClick={() => handleMatchClick(selectedMatch!)}
                  className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all"
                  title="Refresh Stream"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => {
                    setSelectedMatch(null);
                    setStreamUrl(null);
                  }}
                  className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {fetchingStream ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                  <p className="text-blue-400 font-medium animate-pulse">Fetching Secure Stream...</p>
                </div>
              ) : streamUrl ? (
                <VideoPlayer url={streamUrl} title={selectedMatch.title} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-400">
                  <Activity className="w-12 h-12 opacity-20" />
                  <p>Stream unavailable at the moment.</p>
                </div>
              )}
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
      <div className="relative z-10 h-full p-6 backdrop-blur-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-900/50 px-2 py-1 rounded">
              LIVE STREAM
            </div>
          </div>
          <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-2 leading-tight">
            {match.title}
          </h3>
        </div>
        
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Activity className="w-4 h-4 text-blue-500" />
            <span>High Quality</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
            <Play className="w-5 h-5 text-white fill-current ml-1" />
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
