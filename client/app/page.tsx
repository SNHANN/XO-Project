'use client';

import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import GameBoard from '@/components/GameBoard';
import PlayerInfo from '@/components/PlayerInfo';
import ChatBox from '@/components/ChatBox';
import StatusBar from '@/components/StatusBar';
import JoinForm from '@/components/JoinForm';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState({
    board: Array(3).fill(null).map(() => Array(3).fill(null)),
    currentPlayer: 'X' as 'X' | 'O',
    status: 'idle' as 'idle' | 'waiting' | 'playing' | 'ended',
    winner: null as 'X' | 'O' | null,
    winningLine: null as number[][] | null,
    isDraw: false,
    playerSymbol: null as 'X' | 'O' | null,
    roomId: null as string | null,
    players: [] as { id: string; name: string; symbol: 'X' | 'O' }[],
    playerName: '',
    message: '',
  });
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState('');

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    });

    newSocket.on('connect_error', (err) => {
      setError('Failed to connect to server. Please try again.');
      console.error('Connection error:', err);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  // Setup game event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('joined-game', (data) => {
      setGameState(prev => ({
        ...prev,
        board: data.board,
        currentPlayer: data.currentPlayer,
        status: data.status === 'waiting' ? 'waiting' : 'playing',
        playerSymbol: data.symbol,
        roomId: data.roomId,
        players: data.players,
        message: data.status === 'waiting' ? 'Waiting for opponent...' : '',
      }));
      setError('');
    });

    socket.on('join-error', (data) => {
      setError(data.message);
    });

    socket.on('player-joined', (data) => {
      setGameState(prev => ({
        ...prev,
        players: data.players,
        message: `${data.playerName} joined as ${data.symbol}!`,
      }));
    });

    socket.on('game-started', (data) => {
      setGameState(prev => ({
        ...prev,
        status: 'playing',
        currentPlayer: data.currentPlayer,
        board: data.board,
        message: 'Game started!',
      }));
    });

    socket.on('move-made', (data) => {
      setGameState(prev => ({
        ...prev,
        board: data.board,
        currentPlayer: data.currentPlayer,
      }));
    });

    socket.on('game-ended', (data) => {
      setGameState(prev => ({
        ...prev,
        status: 'ended',
        winner: data.winner,
        winningLine: data.winningLine || null,
        isDraw: data.isDraw || false,
        message: data.isDraw 
          ? "It's a draw!" 
          : data.winner === prev.playerSymbol 
            ? 'You won! 🎉' 
            : 'You lost! 😢',
      }));
    });

    socket.on('game-reset', (data) => {
      setGameState(prev => ({
        ...prev,
        board: data.board,
        currentPlayer: data.currentPlayer,
        status: 'playing',
        winner: null,
        winningLine: null,
        isDraw: false,
        message: 'New game started!',
      }));
    });

    socket.on('player-left', (data) => {
      setGameState(prev => ({
        ...prev,
        status: 'ended',
        message: data.message,
      }));
    });

    socket.on('move-error', (data) => {
      setError(data.message);
      setTimeout(() => setError(''), 3000);
    });

    return () => {
      socket.off('joined-game');
      socket.off('join-error');
      socket.off('player-joined');
      socket.off('game-started');
      socket.off('move-made');
      socket.off('game-ended');
      socket.off('game-reset');
      socket.off('player-left');
      socket.off('move-error');
    };
  }, [socket]);

  const handleJoinGame = useCallback((playerName: string, roomId: string) => {
    if (socket) {
      socket.emit('join-game', { playerName, roomId: roomId || undefined });
      setGameState(prev => ({ ...prev, playerName, status: 'waiting' }));
    }
  }, [socket]);

  const handleMakeMove = useCallback((row: number, col: number) => {
    if (socket && gameState.status === 'playing') {
      socket.emit('make-move', { row, col });
    }
  }, [socket, gameState.status]);

  const handleResetGame = useCallback(() => {
    if (socket) {
      socket.emit('reset-game');
    }
  }, [socket]);

  const handleSendMessage = useCallback((message: string) => {
    if (socket) {
      socket.emit('send-message', { message });
    }
  }, [socket]);

  const isMyTurn = gameState.playerSymbol === gameState.currentPlayer;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-2">
            <span className="text-x">X</span>
            <span className="text-gray-600">-</span>
            <span className="text-o">O</span>
            <span className="text-gray-600"> Game</span>
          </h1>
          <p className="text-gray-600">Real-time Multiplayer Tic-Tac-Toe</p>
        </div>

        {/* Connection Status */}
        <div className="flex justify-center mb-6">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
            isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 animate-slide-up">
            {error}
          </div>
        )}

        {/* Join Form */}
        {gameState.status === 'idle' && (
          <JoinForm onJoin={handleJoinGame} />
        )}

        {/* Waiting State */}
        {gameState.status === 'waiting' && (
          <div className="text-center py-12 animate-pulse-slow">
            <div className="inline-block w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-xl text-gray-700">{gameState.message}</p>
            {gameState.roomId && (
              <p className="text-gray-500 mt-2">Room: {gameState.roomId}</p>
            )}
          </div>
        )}

        {/* Game Area */}
        {(gameState.status === 'playing' || gameState.status === 'ended') && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Player Info */}
            <div className="order-2 lg:order-1">
              <PlayerInfo 
                players={gameState.players}
                currentPlayer={gameState.currentPlayer}
                playerSymbol={gameState.playerSymbol}
                roomId={gameState.roomId}
              />
            </div>

            {/* Center: Game Board */}
            <div className="order-1 lg:order-2">
              <StatusBar 
                status={gameState.status}
                currentPlayer={gameState.currentPlayer}
                isMyTurn={isMyTurn}
                playerSymbol={gameState.playerSymbol}
                message={gameState.message}
                onReset={handleResetGame}
              />
              
              <GameBoard 
                board={gameState.board}
                winningLine={gameState.winningLine}
                onCellClick={handleMakeMove}
                disabled={gameState.status !== 'playing' || !isMyTurn}
                playerSymbol={gameState.playerSymbol}
              />
            </div>

            {/* Right: Chat */}
            <div className="order-3">
              <ChatBox 
                socket={socket}
                roomId={gameState.roomId}
                onSendMessage={handleSendMessage}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
