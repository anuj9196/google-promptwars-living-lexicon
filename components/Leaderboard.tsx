import React, { useState, useEffect, useCallback } from 'react';
import { fetchLeaderboard, getSessionId, type LeaderboardEntry } from '../services/geminiService';

interface LeaderboardProps {
    onClose: () => void;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ onClose }) => {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const currentSessionId = getSessionId();

    const loadLeaderboard = useCallback(async () => {
        setLoading(true);
        const data = await fetchLeaderboard(10);
        setEntries(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadLeaderboard();
        const interval = setInterval(loadLeaderboard, 30000);
        return () => clearInterval(interval);
    }, [loadLeaderboard]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const getRankIcon = (rank: number) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return `#${rank}`;
    };

    const getRankGlow = (rank: number) => {
        if (rank === 1) return 'border-yellow-500/60 bg-yellow-500/5 shadow-[0_0_20px_rgba(234,179,8,0.15)]';
        if (rank === 2) return 'border-slate-400/40 bg-slate-400/5';
        if (rank === 3) return 'border-amber-600/40 bg-amber-600/5';
        return 'border-white/5 bg-white/[0.02]';
    };

    return (
        <div
            className="fixed inset-0 z-[250] bg-[#05070a]/95 backdrop-blur-2xl flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            role="dialog"
            aria-label="Global Leaderboard"
            aria-modal="true"
        >
            <div className="w-full max-w-lg animate-in slide-in-from-bottom-8 duration-500">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-magenta-500/10 border border-magenta-500/40 flex items-center justify-center">
                            <svg className="w-5 h-5 text-magenta-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="font-orbitron text-xl font-bold neon-text-cyan tracking-widest uppercase">Leaderboard</h2>
                            <p className="text-[9px] font-mono text-cyan-500/50 tracking-[0.3em] uppercase mt-0.5">Global Rankings • Live</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close leaderboard"
                        className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500/20 hover:border-red-500/40 transition-all"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Leaderboard Content */}
                <div className="bg-black/60 backdrop-blur-3xl border border-cyan-500/20 rounded-3xl overflow-hidden shadow-2xl">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-8 h-8 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-40">
                            <svg className="w-12 h-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                            </svg>
                            <span className="font-orbitron text-[10px] tracking-[0.5em] uppercase">No players yet</span>
                            <span className="font-mono text-[9px] text-slate-600 mt-2">Be the first to scan a creature!</span>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/[0.03]">
                            {entries.map((entry) => {
                                const isMe = entry.sessionId === currentSessionId;
                                return (
                                    <div
                                        key={entry.sessionId}
                                        className={`flex items-center gap-4 px-6 py-4 transition-all ${getRankGlow(entry.rank)} ${isMe ? 'ring-1 ring-cyan-400/30 bg-cyan-500/5' : 'hover:bg-white/[0.02]'}`}
                                    >
                                        {/* Rank */}
                                        <div className="w-10 text-center">
                                            <span className={`font-orbitron text-sm font-bold ${entry.rank <= 3 ? 'text-lg' : 'text-slate-500'}`}>
                                                {getRankIcon(entry.rank)}
                                            </span>
                                        </div>

                                        {/* Player Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-orbitron text-sm font-bold truncate ${isMe ? 'neon-text-cyan' : 'text-white'}`}>
                                                    {entry.playerName}
                                                </span>
                                                {isMe && (
                                                    <span className="text-[8px] px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/40 rounded-full font-mono text-cyan-300 uppercase tracking-widest">You</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Monster Count */}
                                        <div className="flex items-center gap-2">
                                            <span className="font-orbitron text-lg font-black text-cyan-400">{entry.monsterCount}</span>
                                            <span className="text-[9px] font-mono text-slate-600 uppercase">creatures</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Refresh hint */}
                <p className="text-center text-[9px] font-mono text-slate-600 mt-4 tracking-widest uppercase">
                    Auto-refreshes every 30s • Scan creatures to climb the ranks
                </p>
            </div>
        </div>
    );
};

export default Leaderboard;
