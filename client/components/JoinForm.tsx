'use client';

import { useState } from 'react';
import { User, Hash, Zap, DoorOpen } from 'lucide-react';

interface JoinFormProps {
  onJoin: (playerName: string, roomId: string) => void;
}

export default function JoinForm({ onJoin }: JoinFormProps) {
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [mode, setMode] = useState<'quick' | 'room'>('quick');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    onJoin(playerName.trim(), mode === 'room' ? roomId.trim() : '');
  };

  return (
    <div className="glass rounded-2xl p-8 max-w-md mx-auto slide-up">
      {/* Mode tabs */}
      <div className="flex gap-2 mb-6 p-1 glass rounded-xl">
        {(['quick', 'room'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
              mode === m
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {m === 'quick' ? <><Zap className="w-4 h-4" /> Quick Match</> : <><Hash className="w-4 h-4" /> Private Room</>}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
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

        {/* Room ID (only in room mode) */}
        {mode === 'room' && (
          <div className="slide-up">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
              Room ID <span className="normal-case font-normal text-slate-500">(leave blank to create new)</span>
            </label>
            <div className="relative">
              <DoorOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="ABC123 or leave empty"
                className="dark-input w-full pl-10 pr-4 py-3 rounded-xl text-sm font-mono tracking-widest"
                maxLength={6}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={!playerName.trim()}
          className="btn-primary w-full text-white font-bold py-3 px-6 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4" />
          {mode === 'quick' ? 'Find a Match' : roomId.trim() ? 'Join Room' : 'Create Room'}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-white/8">
        <p className="text-center text-xs text-slate-500 leading-relaxed">
          {mode === 'quick'
            ? 'You\'ll be matched with an available opponent instantly.'
            : 'Create a private room and share the code with a friend — or play the AI.'}
        </p>
      </div>
    </div>
  );
}
