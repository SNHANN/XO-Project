'use client';

import { useState } from 'react';
import { User, Zap } from 'lucide-react';

interface JoinFormProps {
  onJoin: (playerName: string, roomId: string) => void;
}

export default function JoinForm({ onJoin }: JoinFormProps) {
  const [playerName, setPlayerName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    onJoin(playerName.trim(), '');
  };

  return (
    <div className="glass rounded-2xl p-8 max-w-md mx-auto slide-up">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-slate-100">Join the Arena</h2>
        <p className="text-sm text-slate-500 mt-1">Enter your name and find an opponent</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            Player Name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              className="dark-input w-full pl-10 pr-4 py-3 rounded-xl text-sm"
              maxLength={20}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!playerName.trim()}
          className="btn-primary w-full text-white font-bold py-3 px-6 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4" />
          Find a Game
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-white/8">
        <p className="text-center text-xs text-slate-500 leading-relaxed">
          You&apos;ll be matched with an available opponent, or play against the AI while waiting.
        </p>
      </div>
    </div>
  );
}
