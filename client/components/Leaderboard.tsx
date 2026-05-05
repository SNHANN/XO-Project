'use client';

// WEB SERVICES [Lecture 7]: Leaderboard component that calls the REST API
// Uses standard HTTP GET to fetch JSON from /api/leaderboard.
import { useState, useEffect, useCallback } from 'react';
import { Trophy, RefreshCw, Users, Gamepad2 } from 'lucide-react';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

interface LeaderboardEntry {
  rank: number;
  playerName: string;
  wins: number;
  losses: number;
  winRate: string;
}
interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  totalGames: number;
  activePlayers: number;
  timestamp: string;
}

const RANK_COLORS = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];
const RANK_ICONS  = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const [data, setData]       = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Standard HTTP GET – RESTful Web Service [Lecture 7]
      const res = await fetch(`${SERVER_URL}/api/leaderboard`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 30 s
  useEffect(() => {
    fetch_();
    const t = setInterval(fetch_, 30_000);
    return () => clearInterval(t);
  }, [fetch_]);

  return (
    <div className="glass rounded-2xl p-5 slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <span className="font-bold text-slate-100">Leaderboard</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest ml-1">REST API</span>
        </div>
        <button
          onClick={fetch_}
          disabled={loading}
          className="p-1.5 glass rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats row */}
      {data && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="glass rounded-xl p-3 text-center">
            <Gamepad2 className="w-4 h-4 text-violet-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-slate-100">{data.totalGames}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest">Total Games</div>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <Users className="w-4 h-4 text-green-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-slate-100">{data.activePlayers}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest">Online Now</div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-rose-400 text-center py-2">{error}</p>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="glass rounded-xl h-10 animate-pulse opacity-30" />
          ))}
        </div>
      )}

      {/* Table */}
      {data && !loading && (
        <div className="space-y-1.5">
          {data.leaderboard.map((p) => (
            <div
              key={p.rank}
              className="flex items-center gap-3 glass rounded-xl px-3 py-2 glass-hover"
            >
              <span className="text-base w-6 text-center select-none">
                {p.rank <= 3 ? RANK_ICONS[p.rank - 1] : `${p.rank}`}
              </span>
              <span className={`font-bold text-sm flex-1 truncate ${RANK_COLORS[p.rank - 1] ?? 'text-slate-300'}`}>
                {p.playerName}
              </span>
              <span className="text-xs text-green-400 font-semibold w-8 text-center">{p.wins}W</span>
              <span className="text-xs text-rose-400 font-semibold w-8 text-center">{p.losses}L</span>
              <span className="text-xs text-violet-300 font-bold w-10 text-right">{p.winRate}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
