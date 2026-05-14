// ─────────────────────────────────────────────────────────────────────────────
// XO GAME CLIENT — page.tsx (main orchestrator)
// Implements all DS lectures: IPC, Rooms, REST, P2P WebRTC, Security
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import GameBoard    from '@/components/GameBoard';
import ChatBox      from '@/components/ChatBox';
import JoinForm     from '@/components/JoinForm';
import Leaderboard  from '@/components/Leaderboard';
import WaitingLounge from '@/components/WaitingLounge';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

// ── Types ────────────────────────────────────────────────────────────────────
interface Player { id: string; name: string; symbol: 'X' | 'O'; }
interface GameState {
  board: (string | null)[][];
  currentPlayer: 'X' | 'O';
  status: 'idle' | 'waiting' | 'playing' | 'ended';
  winner: 'X' | 'O' | null;
  winningLine: number[][] | null;
  isDraw: boolean;
  playerSymbol: 'X' | 'O' | null;
  roomId: string | null;
  players: Player[];
  playerName: string;
  isMatchmaking: boolean; // true = random queue (no roomId)
  isAIGame: boolean;
}

const INIT: GameState = {
  board: Array(3).fill(null).map(() => Array(3).fill(null)),
  currentPlayer: 'X',
  status: 'idle',
  winner: null,
  winningLine: null,
  isDraw: false,
  playerSymbol: null,
  roomId: null,
  players: [],
  playerName: '',
  isMatchmaking: false,
  isAIGame: false,
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [socket, setSocket]       = useState<Socket | null>(null);
  const [gs, setGs]               = useState<GameState>(INIT);
  const [isConnected, setConn]    = useState(false);
  const [toast, setToast]         = useState<{ msg: string; ok?: boolean } | null>(null);
  const [modal, setModal]         = useState<{ title: string; body: string } | null>(null);
  const [resultModal, setResultModal] = useState<'X' | 'O' | 'draw' | null>(null);

  // SECURITY [Lecture 9]: Store token in useRef to avoid stale closures
  // in event-handler callbacks. Keeps the value always fresh without
  // re-registering listeners on every render.
  const authRef  = useRef<string | null>(null);

  // P2P [Lecture 8]: WebRTC references
  const [p2pStatus, setP2P]       = useState<'off' | 'connecting' | 'ready'>('off');
  const [useP2P, setUseP2P]       = useState(false);
  const pcRef    = useRef<RTCPeerConnection | null>(null);
  const dcRef    = useRef<RTCDataChannel | null>(null);

  // ── Toast helper ─────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string, ok = false) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  }, []);

  // ── Reset to idle ─────────────────────────────────────────────────────────
  const resetToIdle = useCallback(() => {
    authRef.current = null;
    setGs(INIT);
    setModal(null);
    setResultModal(null);
    setP2P('off');
    setUseP2P(false);
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    dcRef.current = null;
  }, []);

  // ── Socket init ───────────────────────────────────────────────────────────
  useEffect(() => {
    // IPC [Lecture 1-5]: WebSocket connection over TCP, JSON marshalling
    const s = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    s.on('connect',       () => setConn(true));
    s.on('disconnect',    () => setConn(false));
    s.on('connect_error', () => showToast('Cannot reach server. Retrying…'));
    setSocket(s);
    return () => { s.close(); };
  }, [showToast]);

  // ── Game event listeners ──────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // ── waiting: queued for matchmaking (no roomId yet) ───────────────────
    socket.on('waiting', ({ authToken }: { authToken: string; message: string }) => {
      // SECURITY [Lecture 9]: Token delivered for matchmaking path
      authRef.current = authToken;
    });

    // ── joined-game: room assigned (both paths) ───────────────────────────
    socket.on('joined-game', (data: {
      roomId: string; symbol: 'X' | 'O'; board: (string|null)[][];
      currentPlayer: 'X'|'O'; players: Player[]; status: string; authToken: string;
    }) => {
      // SECURITY [Lecture 9]: Overwrite/confirm token (always latest value)
      if (data.authToken) authRef.current = data.authToken;

      setGs(prev => ({
        ...prev,
        roomId: data.roomId,
        playerSymbol: data.symbol,
        board: data.board,
        currentPlayer: data.currentPlayer,
        players: data.players,
        status: data.status === 'playing' ? 'playing' : 'waiting',
      }));
    });

    socket.on('join-error', ({ message }: { message: string }) => {
      showToast(message);
      resetToIdle();
    });

    // ── game-started: both players present, board unlocks ─────────────────
    socket.on('game-started', (data: { currentPlayer: 'X'|'O'; board: (string|null)[][]; players: Player[] }) => {
      setGs(prev => ({
        ...prev,
        status: 'playing',
        currentPlayer: data.currentPlayer,
        board: data.board,
        players: data.players,
      }));
    });

    // ── move-made ─────────────────────────────────────────────────────────
    socket.on('move-made', (data: { board: (string|null)[][]; currentPlayer: 'X'|'O' }) => {
      setGs(prev => ({ ...prev, board: data.board, currentPlayer: data.currentPlayer }));
    });

    // ── game-ended ────────────────────────────────────────────────────────
    socket.on('game-ended', (data: { winner: 'X'|'O'|null; winningLine?: number[][]; isDraw?: boolean }) => {
      setGs(prev => ({
        ...prev,
        status: 'ended',
        winner: data.winner,
        winningLine: data.winningLine || null,
        isDraw: !!data.isDraw,
      }));
      setResultModal(data.isDraw ? 'draw' : (data.winner ?? null));
    });

    // ── game-reset ────────────────────────────────────────────────────────
    socket.on('game-reset', (data: { board: (string|null)[][]; currentPlayer: 'X'|'O' }) => {
      setGs(prev => ({
        ...prev,
        board: data.board,
        currentPlayer: data.currentPlayer,
        status: 'playing',
        winner: null, winningLine: null, isDraw: false,
      }));
      setResultModal(null);
    });

    // ── bot joined ────────────────────────────────────────────────────────
    socket.on('bot-joined', (data: { board: (string|null)[][]; currentPlayer: 'X'|'O'; players: Player[]; status: string }) => {
      setGs(prev => ({
        ...prev,
        players: data.players,
        board: data.board,
        currentPlayer: data.currentPlayer,
        isAIGame: true,
      }));
      showToast('🤖 AI Bot joined! Game starting…', true);
    });

    // ── opponent left / disconnect ────────────────────────────────────────
    socket.on('opponent-left', ({ message }: { message: string }) => {
      setGs(prev => ({ ...prev, status: 'ended' }));
      setModal({ title: '🏆 Opponent Left', body: message });
    });

    // ── left-game confirmation ────────────────────────────────────────────
    socket.on('left-game', ({ success }: { success: boolean }) => {
      if (success) resetToIdle();
    });

    // ── move-error ────────────────────────────────────────────────────────
    socket.on('move-error', ({ message }: { message: string }) => showToast(message));

    // ── P2P WebRTC SIGNALING [Lecture 8] ──────────────────────────────────
    socket.on('webrtc-offer', async ({ offer, fromSocketId }: { offer: RTCSessionDescriptionInit; fromSocketId: string }) => {
      if (!useP2P) return;
      setP2P('connecting');
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pcRef.current = pc;
      pc.ondatachannel = (e) => {
        dcRef.current = e.channel;
        e.channel.onopen = () => setP2P('ready');
        e.channel.onmessage = (ev) => {
          const d = JSON.parse(ev.data);
          setGs(prev => ({ ...prev, board: d.board, currentPlayer: d.currentPlayer }));
        };
      };
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit('webrtc-ice-candidate', { targetSocketId: fromSocketId, candidate: e.candidate, authToken: authRef.current });
      };
      socket.emit('webrtc-answer', { targetSocketId: fromSocketId, answer, authToken: authRef.current });
    });

    socket.on('webrtc-answer', async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      if (pcRef.current) await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('webrtc-ice-candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      if (pcRef.current) await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('webrtc-error', ({ message }: { message: string }) => {
      showToast(message);
      setUseP2P(false);
      setP2P('off');
    });

    return () => {
      ['waiting','joined-game','join-error','game-started','move-made','game-ended',
       'game-reset','bot-joined','opponent-left','left-game','move-error',
       'webrtc-offer','webrtc-answer','webrtc-ice-candidate','webrtc-error',
      ].forEach(ev => socket.off(ev));
    };
  }, [socket, useP2P, showToast, resetToIdle]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleJoin = useCallback((playerName: string, roomId: string) => {
    if (!socket) return;
    socket.emit('join-game', { playerName, roomId: roomId || undefined });
    setGs(prev => ({
      ...prev,
      playerName,
      status: 'waiting',
      isMatchmaking: !roomId,
    }));
  }, [socket]);

  // SECURITY [Lecture 9]: Token attached to every move emission
  const handleMove = useCallback((row: number, col: number) => {
    if (!socket || gs.status !== 'playing') return;
    const token = authRef.current;
    if (!token) { showToast('Session token missing. Please rejoin.'); return; }

    // P2P [Lecture 8]: Send via WebRTC DataChannel if P2P is ready
    if (useP2P && dcRef.current?.readyState === 'open') {
      const next: 'X'|'O' = gs.currentPlayer === 'X' ? 'O' : 'X';
      const newBoard = gs.board.map((r, ri) => r.map((c, ci) => ri === row && ci === col ? gs.playerSymbol : c));
      dcRef.current.send(JSON.stringify({ board: newBoard, currentPlayer: next }));
      setGs(prev => ({ ...prev, board: newBoard, currentPlayer: next }));
    } else {
      // Fallback: Socket.io Client-Server [Lecture 1-5]
      socket.emit('make-move', { row, col, authToken: token });
    }
  }, [socket, gs.status, gs.currentPlayer, gs.playerSymbol, gs.board, useP2P, showToast]);

  const handleLeave = useCallback(() => {
    if (socket && authRef.current) socket.emit('leave-game', { authToken: authRef.current });
    else resetToIdle();
  }, [socket, resetToIdle]);

  const handleReset = useCallback(() => {
    if (socket) socket.emit('reset-game', { authToken: authRef.current });
  }, [socket]);

  const handleCopyRoom = useCallback(() => {
    if (!gs.roomId) return;
    navigator.clipboard.writeText(gs.roomId).then(() => showToast('Room ID copied!', true));
  }, [gs.roomId, showToast]);

  const handleRequestAI = useCallback((difficulty: string) => {
    if (socket && authRef.current) socket.emit('request-ai-bot', { authToken: authRef.current, difficulty });
  }, [socket]);

  const handleSendMessage = useCallback((message: string) => {
    if (socket) socket.emit('send-message', { message });
  }, [socket]);

  // P2P [Lecture 8]: Initiate WebRTC offer (server is Centralized Tracker)
  const initiateP2P = useCallback(async () => {
    if (!socket || gs.players.length < 2) { showToast('Need 2 players for P2P'); return; }
    const other = gs.players.find(p => p.id !== socket.id);
    if (!other) return;
    setP2P('connecting');
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;
    const dc = pc.createDataChannel('moves');
    dcRef.current = dc;
    dc.onopen = () => setP2P('ready');
    dc.onmessage = (e) => {
      const d = JSON.parse(e.data);
      setGs(prev => ({ ...prev, board: d.board, currentPlayer: d.currentPlayer }));
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('webrtc-ice-candidate', { targetSocketId: other.id, candidate: e.candidate, authToken: authRef.current });
    };
    socket.emit('webrtc-offer', { targetSocketId: other.id, offer, authToken: authRef.current });
  }, [socket, gs.players, showToast]);

  // ── Derived values ────────────────────────────────────────────────────────
  const isMyTurn    = gs.playerSymbol === gs.currentPlayer && gs.status === 'playing';
  const boardLocked = gs.status !== 'playing' || !isMyTurn || gs.players.length < 2;

  const resultMsg = gs.isDraw
    ? "It's a Draw! 🤝"
    : gs.winner === gs.playerSymbol
      ? 'You Win! 🎉'
      : gs.winner ? 'You Lose 😢' : '';

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen p-4 md:p-6">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between max-w-6xl mx-auto mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            <span className="symbol-x">X</span>
            <span className="text-slate-500 mx-0.5">·</span>
            <span className="symbol-o">O</span>
            <span className="text-slate-300 ml-2">Arena</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium glass ${
            isConnected ? 'text-green-400' : 'text-rose-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400' : 'bg-rose-400 badge-pulse'}`} />
            {isConnected ? 'Online' : 'Offline'}
          </div>

          {/* P2P badge */}
          {p2pStatus !== 'off' && (
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium glass ${
              p2pStatus === 'ready' ? 'text-violet-400' : 'text-yellow-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${p2pStatus === 'ready' ? 'bg-violet-400' : 'bg-yellow-400 badge-pulse'}`} />
              P2P {p2pStatus === 'ready' ? 'Active' : '…'}
            </div>
          )}
        </div>
      </header>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-medium slide-up shadow-2xl ${
          toast.ok ? 'bg-green-900/80 text-green-300 border border-green-700/40' : 'bg-rose-900/80 text-rose-300 border border-rose-700/40'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* ── Waiting Lounge ────────────────────────────────────────────────── */}
      {gs.status === 'waiting' && (
        <WaitingLounge
          roomId={gs.roomId}
          playerName={gs.playerName}
          onRequestAI={handleRequestAI}
          onCopyRoomId={handleCopyRoom}
          onLeave={resetToIdle}
          isMatchmaking={gs.isMatchmaking}
        />
      )}

      {/* ── Opponent-left / Result modal ──────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm fade-in">
          <div className="glass rounded-3xl p-8 max-w-sm w-full text-center scale-in">
            <div className="text-5xl mb-4">{modal.title.slice(0, 2)}</div>
            <h2 className="text-xl font-bold text-slate-100 mb-2">{modal.title.slice(2).trim()}</h2>
            <p className="text-slate-400 text-sm mb-6">{modal.body}</p>
            <button onClick={resetToIdle} className="btn-primary w-full text-white font-bold py-3 rounded-xl">
              Return to Home
            </button>
          </div>
        </div>
      )}

      {/* ── Game Result Modal ───────────────────────────────────────────── */}
      {resultModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm fade-in">
          <div className="glass rounded-3xl p-8 max-w-sm w-full text-center scale-in">
            {resultModal === 'draw' ? (
              <>
                <div className="text-6xl mb-4">🤝</div>
                <h2 className="text-2xl font-bold text-slate-100 mb-2">It&apos;s a Draw!</h2>
                <p className="text-slate-400 text-sm mb-6">A perfectly balanced game — well played!</p>
              </>
            ) : resultModal === gs.playerSymbol ? (
              <>
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold text-green-400 mb-2">You Win!</h2>
                <p className="text-slate-400 text-sm mb-6">Outstanding! You dominated the board.</p>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">😢</div>
                <h2 className="text-2xl font-bold text-rose-400 mb-2">You Lose</h2>
                <p className="text-slate-400 text-sm mb-6">Better luck next time. Keep practicing!</p>
              </>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setResultModal(null); handleReset(); }}
                className="btn-primary flex-1 text-white font-bold py-3 rounded-xl"
              >
                🔄 Play Again
              </button>
              <button
                onClick={() => { setResultModal(null); handleLeave(); }}
                className="btn-danger flex-1 text-white font-bold py-3 rounded-xl"
              >
                🚪 Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── IDLE: join form + leaderboard ─────────────────────────────────── */}
      {gs.status === 'idle' && (
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <JoinForm onJoin={handleJoin} />
          <Leaderboard />
        </div>
      )}

      {/* ── GAME area ─────────────────────────────────────────────────────── */}
      {(gs.status === 'playing' || gs.status === 'ended') && (
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[260px_1fr_260px] gap-4 items-start">

          {/* ── LEFT: Players + Controls ───────────────────────────────────── */}
          <div className="order-2 lg:order-1 space-y-3">

            {/* Player cards */}
            {(['X','O'] as const).map(sym => {
              const p  = gs.players.find(pl => pl.symbol === sym);
              const me = sym === gs.playerSymbol;
              const active = gs.currentPlayer === sym && gs.status === 'playing';
              return (
                <div key={sym} className={`glass rounded-2xl p-4 transition-all ${active ? 'border-violet-500/50 shadow-lg shadow-violet-900/20' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl font-black
                      ${sym === 'X' ? 'bg-rose-900/40 symbol-x' : 'bg-blue-900/40 symbol-o'}`}>
                      {sym}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-200 text-sm truncate">
                        {p ? p.name : <span className="text-slate-500 italic">Empty slot</span>}
                        {me && <span className="ml-1 text-violet-400 text-xs">(you)</span>}
                        {p?.name === '🤖 AI Bot' && <span className="ml-1 text-slate-500 text-xs">AI</span>}
                      </p>
                      <p className={`text-xs ${active ? 'text-violet-400 font-medium' : 'text-slate-600'}`}>
                        {active ? '● Your turn' : sym === 'X' ? 'Player X' : 'Player O'}
                      </p>
                    </div>
                    {active && <div className="w-2 h-2 rounded-full bg-violet-400 badge-pulse" />}
                  </div>
                </div>
              );
            })}

            {/* Controls */}
            <div className="glass rounded-2xl p-4 space-y-2">
              {gs.roomId && (
                <button onClick={handleCopyRoom}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl glass glass-hover text-slate-300 text-sm transition-all">
                  📋 Copy Room ID
                </button>
              )}
              <button onClick={handleLeave}
                className="btn-danger w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-white text-sm">
                🚪 Leave Game
              </button>
              {gs.status === 'ended' && (
                <button onClick={handleReset}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-white text-sm">
                  🔄 Play Again
                </button>
              )}
            </div>

            {/* P2P Panel [Lecture 8] */}
            {!gs.isAIGame && (
              <div className="glass rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">P2P Mode</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={useP2P}
                      onChange={e => {
                        setUseP2P(e.target.checked);
                        if (!e.target.checked) { setP2P('off'); pcRef.current?.close(); pcRef.current = null; }
                      }} disabled={gs.players.length < 2} />
                    <div className="w-9 h-5 bg-slate-700 rounded-full peer-checked:bg-violet-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:w-4 after:h-4 after:transition-all peer-checked:after:translate-x-4" />
                  </label>
                </div>
                {useP2P && p2pStatus !== 'ready' && (
                  <button onClick={initiateP2P} disabled={p2pStatus === 'connecting'}
                    className="w-full py-1.5 rounded-lg text-xs btn-primary text-white disabled:opacity-50">
                    {p2pStatus === 'connecting' ? 'Connecting…' : 'Establish P2P'}
                  </button>
                )}
                <p className="text-[10px] text-slate-600">
                  {useP2P && p2pStatus === 'ready' ? '✓ Moves flow P2P via WebRTC DataChannel' : 'Moves via Socket.io (fallback)'}
                </p>
              </div>
            )}
          </div>

          {/* ── CENTER: Board + Status ─────────────────────────────────────── */}
          <div className="order-1 lg:order-2 space-y-3">

            {/* Status bar */}
            <div className={`glass rounded-2xl px-5 py-3 flex items-center justify-between ${
              gs.status === 'ended' ? 'border-yellow-500/30' : ''
            }`}>
              {gs.status === 'ended' ? (
                <span className="font-bold text-slate-100">{resultMsg}</span>
              ) : (
                <span className="text-slate-300 text-sm">
                  {isMyTurn
                    ? <><span className="text-violet-400 font-semibold">Your turn</span> — place your {gs.playerSymbol}</>
                    : "Waiting for opponent's move…"}
                </span>
              )}
              {gs.roomId && (
                <span className="text-xs font-mono text-slate-600 bg-black/30 px-2 py-1 rounded-lg">
                  #{gs.roomId}
                </span>
              )}
            </div>

            {/* Board */}
            <GameBoard
              board={gs.board}
              winningLine={gs.winningLine}
              onCellClick={handleMove}
              disabled={boardLocked}
              playerSymbol={gs.playerSymbol}
            />

            {/* Waiting for opponent overlay on board */}
            {gs.players.length < 2 && gs.status === 'playing' && (
              <p className="text-center text-xs text-slate-500">Waiting for a second player to join…</p>
            )}
          </div>

          {/* ── RIGHT: Chat ────────────────────────────────────────────────── */}
          <div className="order-3 lg:min-h-[440px]">
            <ChatBox
              socket={socket}
              roomId={gs.roomId}
              playerSymbol={gs.playerSymbol}
              onSendMessage={handleSendMessage}
            />
          </div>
        </div>
      )}
    </main>
  );
}
