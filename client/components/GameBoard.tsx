'use client';

interface GameBoardProps {
  board: (string | null)[][];
  winningLine: number[][] | null;
  onCellClick: (row: number, col: number) => void;
  disabled: boolean;
  playerSymbol: 'X' | 'O' | null;
}

export default function GameBoard({ 
  board, 
  winningLine, 
  onCellClick, 
  disabled,
  playerSymbol 
}: GameBoardProps) {
  const isWinningCell = (row: number, col: number) => {
    if (!winningLine) return false;
    return winningLine.some(([r, c]) => r === row && c === col);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-4 md:p-6">
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isWinner = isWinningCell(rowIndex, colIndex);
            const hasValue = cell !== null;
            
            return (
              <button
                key={`${rowIndex}-${colIndex}`}
                onClick={() => onCellClick(rowIndex, colIndex)}
                disabled={disabled || hasValue}
                className={`
                  aspect-square rounded-lg md:rounded-xl font-bold text-4xl md:text-5xl
                  transition-all duration-200 transform
                  ${isWinner 
                    ? 'winning-cell scale-105' 
                    : 'bg-gray-50 hover:bg-gray-100'
                  }
                  ${disabled && !hasValue ? 'cursor-not-allowed' : ''}
                  ${!disabled && !hasValue ? 'cursor-pointer hover:scale-105 active:scale-95' : ''}
                  ${hasValue ? 'scale-100' : ''}
                `}
              >
                {cell && (
                  <span 
                    className={`
                      animate-scale-in inline-block
                      ${cell === 'X' ? 'text-x' : 'text-o'}
                    `}
                  >
                    {cell}
                  </span>
                )}
                {!cell && !disabled && (
                  <span className="text-gray-200 text-3xl md:text-4xl opacity-0 hover:opacity-50 transition-opacity">
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
