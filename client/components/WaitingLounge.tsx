'use client';

import { useState } from 'react';
import { Copy, Bot, Check, Wifi } from 'lucide-react';

interface WaitingLoungeProps {
  roomId: string | null;
  playerName: string;
  onRequestAI: () => void;
  onCopyRoomId: () => void;
  onLeave: () => void;
  isMatchmaking: boolean; // true = no roomId, queued for random match
}

export default function WaitingLounge({
  roomId,
  playerName,
  onRequestAI,
  onCopyRoomId,
  onLeave,
  isMatchmaking,
}: WaitingLoungeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopyRoomId();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

        <h2 className="text-2xl font-bold text-slate-100 mb-1">
          {isMatchmaking ? 'Finding an Opponent…' : 'Waiting for Opponent…'}
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          {isMatchmaking
            ? "You'll be matched automatically when someone else joins."
            : `Share the room code below with a friend, ${playerName}.`}
        </p>

        {/* Room ID card (only for private-room path) */}
        {roomId && !isMatchmaking && (
          <div className="glass rounded-2xl p-4 mb-6">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Room Code</p>
            <div className="flex items-center justify-center gap-3">
              <span className="font-mono text-3xl font-bold tracking-widest text-violet-300">
                {roomId}
              </span>
              <button
                onClick={handleCopy}
                className="p-2 glass rounded-lg hover:bg-white/10 transition-colors"
                title="Copy Room ID"
              >
                {copied
                  ? <Check className="w-4 h-4 text-green-400" />
                  : <Copy className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
          </div>
        )}

        {/* AI Bot button (only when in a private room) */}
        {roomId && !isMatchmaking && (
          <button
            onClick={onRequestAI}
            className="w-full mb-3 bg-gradient-to-r from-pink-600 to-violet-600 text-white font-bold py-3 px-6 rounded-xl
                       hover:from-pink-500 hover:to-violet-500 transition-all transform hover:scale-[1.02]
                       shadow-lg shadow-violet-900/40 flex items-center justify-center gap-2"
          >
            <Bot className="w-5 h-5" />
            Play Against AI Bot
          </button>
        )}

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
