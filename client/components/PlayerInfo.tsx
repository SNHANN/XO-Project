'use client';

import { User, Trophy, Hash } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  symbol: 'X' | 'O';
}

interface PlayerInfoProps {
  players: Player[];
  currentPlayer: 'X' | 'O';
  playerSymbol: 'X' | 'O' | null;
  roomId: string | null;
}

export default function PlayerInfo({ 
  players, 
  currentPlayer, 
  playerSymbol,
  roomId 
}: PlayerInfoProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-4 md:p-6">
      {/* Room ID */}
      {roomId && (
        <div className="mb-4 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <Hash className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Room ID</span>
          </div>
          <p className="text-lg font-mono font-bold text-primary-600">{roomId}</p>
          <p className="text-xs text-gray-500 mt-1">Share this ID to invite a friend</p>
        </div>
      )}

      {/* Players */}
      <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide mb-3">
        Players
      </h3>
      
      <div className="space-y-3">
        {['X', 'O'].map((symbol) => {
          const player = players.find(p => p.symbol === symbol);
          const isCurrentTurn = currentPlayer === symbol;
          const isMe = playerSymbol === symbol;

          return (
            <div
              key={symbol}
              className={`
                flex items-center gap-3 p-3 rounded-lg transition-all
                ${isCurrentTurn 
                  ? 'bg-primary-50 ring-2 ring-primary-500' 
                  : 'bg-gray-50'
                }
                ${!player ? 'opacity-50' : ''}
              `}
            >
              {/* Symbol Badge */}
              <div 
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg
                  ${symbol === 'X' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}
                `}
              >
                {symbol}
              </div>

              {/* Player Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">
                  {player ? player.name : 'Waiting...'}
                  {isMe && <span className="text-primary-500 ml-1">(You)</span>}
                </p>
                {isCurrentTurn && (
                  <p className="text-xs text-primary-600 font-medium">
                    {player ? 'Current Turn' : 'Waiting for player...'}
                  </p>
                )}
              </div>

              {/* Turn Indicator */}
              {isCurrentTurn && player && (
                <Trophy className="w-5 h-5 text-primary-500 animate-pulse-slow" />
              )}

              {/* Empty Slot Indicator */}
              {!player && (
                <User className="w-5 h-5 text-gray-400" />
              )}
            </div>
          );
        })}
      </div>

      {/* Turn Indicator */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-center text-sm text-gray-600">
          {playerSymbol === currentPlayer ? (
            <span className="text-primary-600 font-semibold">Your turn! Make a move.</span>
          ) : (
            <span>Waiting for opponent&apos;s move...</span>
          )}
        </p>
      </div>
    </div>
  );
}
