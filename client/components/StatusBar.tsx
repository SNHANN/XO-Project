'use client';

import { RotateCcw, Crown, Minus } from 'lucide-react';

interface StatusBarProps {
  status: 'idle' | 'waiting' | 'playing' | 'ended';
  currentPlayer: 'X' | 'O';
  isMyTurn: boolean;
  playerSymbol: 'X' | 'O' | null;
  message: string;
  onReset: () => void;
}

export default function StatusBar({
  status,
  currentPlayer,
  isMyTurn,
  playerSymbol,
  message,
  onReset
}: StatusBarProps) {
  if (status === 'ended') {
    const won = message.includes('won') && isMyTurn === false && message.includes('You won');
    const draw = message.includes('draw');

    return (
      <div className={`
        rounded-xl p-4 mb-4 text-center animate-scale-in
        ${won ? 'bg-green-100 border-2 border-green-500' : ''}
        ${draw ? 'bg-gray-100 border-2 border-gray-500' : ''}
        {!won && !draw ? 'bg-red-100 border-2 border-red-500' : ''}
      `}>
        <div className="flex items-center justify-center gap-2 mb-2">
          {won ? (
            <Crown className="w-6 h-6 text-green-600" />
          ) : draw ? (
            <Minus className="w-6 h-6 text-gray-600" />
          ) : (
            <span className="text-2xl">😢</span>
          )}
          <span className={`
            text-xl font-bold
            ${won ? 'text-green-800' : ''}
            ${draw ? 'text-gray-800' : ''}
            {!won && !draw ? 'text-red-800' : ''}
          `}>
            {message}
          </span>
        </div>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Play Again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-3 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`
            w-3 h-3 rounded-full animate-pulse
            ${isMyTurn ? 'bg-green-500' : 'bg-yellow-500'}
          `} />
          <span className="text-sm font-medium text-gray-700">
            {isMyTurn ? 'Your Turn' : "Opponent's Turn"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Current:</span>
          <span className={`
            font-bold text-lg
            ${currentPlayer === 'X' ? 'text-red-500' : 'text-blue-500'}
          `}>
            {currentPlayer}
          </span>
        </div>
      </div>
      {message && (
        <p className="text-xs text-gray-500 mt-1">{message}</p>
      )}
    </div>
  );
}
