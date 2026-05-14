'use client';

import { useState } from 'react';
import { Bot, Wifi } from 'lucide-react';

interface WaitingLoungeProps {
  roomId: string | null;
  playerName: string;
  onRequestAI: (difficulty: string) => void;
  onCopyRoomId: () => void;
  onLeave: () => void;
  isMatchmaking: boolean;
}

const DIFFICULTIES = [
  { key: 'beginner', label: 'Beginner', desc: 'Random moves' },
  { key: 'easy',     label: 'Easy',     desc: 'Blocks wins' },
  { key: 'hard',     label: 'Hard',     desc: 'Full strategy' },
] as const;

export default function WaitingLounge({
  playerName,
  onRequestAI,
  onLeave,
}: WaitingLoungeProps) {
  const [difficulty, setDifficulty] = useState<'beginner' | 'easy' | 'hard'>('hard');

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#07071a]/80 backdrop-blur-sm fade-in">
      <div className="glass rounded-3xl p-8 w-full max-w-md scale-in text-center">

        {/* Spinner */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="spinner w-20 h-20" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Wifi className="w-7 h-7 text-violet-400" />
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-slate-100 mb-1">Finding an Opponent…</h2>
        <p className="text-slate-400 text-sm mb-6">
          You&apos;ll be matched automatically when someone else joins, {playerName}.
        </p>

        {/* AI Bot section */}
        <div className="glass rounded-2xl p-4 mb-4">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-3">
            Or play against the AI
          </p>

          {/* Difficulty selector */}
          <div className="flex gap-2 mb-4">
            {DIFFICULTIES.map(({ key, label, desc }) => (
              <button
                key={key}
                onClick={() => setDifficulty(key)}
                className={`flex-1 py-2 px-1 rounded-xl text-xs font-semibold transition-all ${
                  difficulty === key
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40'
                    : 'glass text-slate-400 hover:text-slate-200'
                }`}
              >
                <div>{label}</div>
                <div className={`text-[10px] mt-0.5 font-normal ${
                  difficulty === key ? 'text-violet-200' : 'text-slate-600'
                }`}>{desc}</div>
              </button>
            ))}
          </div>

          <button
            onClick={() => onRequestAI(difficulty)}
            className="w-full bg-gradient-to-r from-pink-600 to-violet-600 text-white font-bold py-3 px-6 rounded-xl
                       hover:from-pink-500 hover:to-violet-500 transition-all transform hover:scale-[1.02]
                       shadow-lg shadow-violet-900/40 flex items-center justify-center gap-2"
          >
            <Bot className="w-5 h-5" />
            Play Against AI Bot
          </button>
        </div>

        {/* Leave / Cancel */}
        <button
          onClick={onLeave}
          className="w-full text-slate-500 hover:text-slate-300 text-sm transition-colors py-2"
        >
          ← Cancel &amp; go back
        </button>
      </div>
    </div>
  );
}
