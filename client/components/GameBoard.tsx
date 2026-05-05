'use client';

import { useRef } from 'react';

interface GameBoardProps {
  board: (string | null)[][];
  winningLine: number[][] | null;
  onCellClick: (row: number, col: number) => void;
  disabled: boolean;
  playerSymbol: 'X' | 'O' | null;
}

export default function GameBoard({ board, winningLine, onCellClick, disabled, playerSymbol }: GameBoardProps) {
  // Track which cells are newly filled to trigger mark-enter animation
  const prevBoardRef = useRef<(string | null)[][]>(
    Array(3).fill(null).map(() => Array(3).fill(null))
  );

  const isNew = (row: number, col: number) =>
    board[row][col] !== null && prevBoardRef.current[row][col] === null;

  // Snapshot board after rendering for next diff
  const capturedNew = Array.from({ length: 3 }, (_, r) =>
    Array.from({ length: 3 }, (_, c) => isNew(r, c))
  );
  prevBoardRef.current = board.map(r => [...r]);

  const isWin = (r: number, c: number) =>
    !!winningLine?.some(([wr, wc]) => wr === r && wc === c);

  return (
    <div className="glass rounded-2xl p-3 sm:p-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {board.map((row, r) =>
          row.map((cell, c) => {
            const winning = isWin(r, c);
            const empty   = cell === null;
            const isNew_  = capturedNew[r][c];

            return (
              <button
                key={`${r}-${c}`}
                onClick={() => onCellClick(r, c)}
                disabled={disabled || !empty}
                className={[
                  'aspect-square rounded-xl font-black text-4xl sm:text-5xl',
                  'border transition-all duration-200 relative overflow-hidden',
                  'flex items-center justify-center',
                  winning
                    ? 'winning-cell border-yellow-400/40 cursor-default'
                    : empty && !disabled
                      ? 'glass glass-hover border-white/8 cursor-pointer active:scale-95'
                      : 'glass border-white/6 cursor-default',
                  !empty && !winning ? 'scale-100' : '',
                ].join(' ')}
              >
                {cell && (
                  <span className={`${isNew_ ? 'mark-enter' : ''} ${cell === 'X' ? 'symbol-x' : 'symbol-o'}`}>
                    {cell}
                  </span>
                )}

                {/* Ghost preview on hover */}
                {empty && !disabled && playerSymbol && (
                  <span className={`opacity-0 group-hover:opacity-20 transition-opacity select-none pointer-events-none
                    ${playerSymbol === 'X' ? 'symbol-x' : 'symbol-o'}`}>
                    {playerSymbol}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
