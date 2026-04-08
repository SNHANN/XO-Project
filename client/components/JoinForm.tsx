'use client';

import { useState } from 'react';
import { User, Hash, Play } from 'lucide-react';

interface JoinFormProps {
  onJoin: (playerName: string, roomId: string) => void;
}

export default function JoinForm({ onJoin }: JoinFormProps) {
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim()) {
      onJoin(playerName.trim(), roomId.trim());
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 max-w-md mx-auto animate-scale-in">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
        Join Game
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Player Name *
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
              maxLength={20}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Room ID (Optional)
          </label>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder="Leave empty for matchmaking"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
              maxLength={6}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Leave empty to be matched with a random opponent
          </p>
        </div>

        <button
          type="submit"
          className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-primary-600 hover:to-primary-700 transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
        >
          <Play className="w-5 h-5" />
          Play Now
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <p className="text-sm text-gray-600 text-center">
          <span className="font-semibold">How to play:</span>
        </p>
        <ul className="text-sm text-gray-500 mt-2 space-y-1 text-center">
          <li>1. Enter your name</li>
          <li>2. Join a room or wait for matchmaking</li>
          <li>3. Take turns placing X or O</li>
          <li>4. First to get 3 in a row wins!</li>
        </ul>
      </div>
    </div>
  );
}
