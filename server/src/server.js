// =============================================================================
// XO GAME SERVER - Complete Rewrite
// Implements: Lectures 1-9 (IPC, Rooms, REST, P2P WebRTC, Security)
// =============================================================================
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { GameManager } = require('./utils/GameManager');

// ─────────────────────────────────────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000' }));
app.use(express.json());

// SECURITY [Lecture 9]: DoS Mitigation – Rate Limiter on /api/ routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

const server = http.createServer(app);

// IPC [Lecture 1-5]: WebSocket over TCP with JSON marshalling via Socket.io
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────
const gameManager = new GameManager();
const validTokens = new Map(); // socketId → authToken  (Lecture 9: Masquerading mitigation)
const botRooms    = new Map(); // roomId   → playerSocketId

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY [Lecture 9]: Token helpers
// ─────────────────────────────────────────────────────────────────────────────
function generateAuthToken(id) {
  return crypto
    .createHash('sha256')
    .update(`${id}-${Date.now()}-${process.env.SECRET_KEY || 'xo-secret-2024'}`)
    .digest('hex');
}

function validateToken(socketId, token) {
  const stored = validTokens.get(socketId);
  return !!(stored && stored === token);
}

// ─────────────────────────────────────────────────────────────────────────────
// AI BOT [Lecture 8]: Strategic move selection (win → block → center → corner)
// Defined at module level so scheduleBotMove can reference it safely.
// ─────────────────────────────────────────────────────────────────────────────
function checkWin(board, symbol) {
  for (let i = 0; i < 3; i++) {
    if (board[i].every(c => c === symbol)) return true;
    if ([0, 1, 2].every(j => board[j][i] === symbol)) return true;
  }
  if ([0, 1, 2].every(i => board[i][i] === symbol)) return true;
  if ([0, 1, 2].every(i => board[i][2 - i] === symbol)) return true;
  return false;
}

function getBotMove(board) {
  const b = board.map(r => [...r]); // shallow copy to avoid mutating real board

  // 1. Win if possible
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (b[r][c] === null) {
        b[r][c] = 'O';
        if (checkWin(b, 'O')) { b[r][c] = null; return { row: r, col: c }; }
        b[r][c] = null;
      }
    }
  }
  // 2. Block opponent
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (b[r][c] === null) {
        b[r][c] = 'X';
        if (checkWin(b, 'X')) { b[r][c] = null; return { row: r, col: c }; }
        b[r][c] = null;
      }
    }
  }
  // 3. Center
  if (b[1][1] === null) return { row: 1, col: 1 };
  // 4. Random corner
  const corners = [[0,0],[0,2],[2,0],[2,2]].filter(([r,c]) => b[r][c] === null);
  if (corners.length) {
    const [r, c] = corners[Math.floor(Math.random() * corners.length)];
    return { row: r, col: c };
  }
  // 5. Any empty cell
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      if (b[r][c] === null) return { row: r, col: c };
  return null;
}

// Schedule a bot move after a short "thinking" delay
function scheduleBotMove(roomId) {
  if (!botRooms.has(roomId)) return;

  const game = gameManager.games.get(roomId);
  if (!game || game.status !== 'playing') return;

  const botId = `bot-${roomId}`;
  const botPlayer = game.players.find(p => p.id === botId);
  if (!botPlayer || game.currentPlayer !== botPlayer.symbol) return;

  setTimeout(() => {
    const g = gameManager.games.get(roomId);
    if (!g || g.status !== 'playing') return;
    if (g.currentPlayer !== botPlayer.symbol) return;

    const move = getBotMove(g.board);
    if (!move) return;

    const result = gameManager.makeMove(roomId, botId, move.row, move.col);
    if (!result.success) return;

    io.to(roomId).emit('move-made', {
      row: move.row, col: move.col,
      symbol: result.symbol,
      board: result.gameState.board,
      currentPlayer: result.gameState.currentPlayer,
    });

    if (result.gameState.winner) {
      io.to(roomId).emit('game-ended', {
        winner: result.gameState.winner,
        winningLine: result.gameState.winningLine,
        board: result.gameState.board,
      });
    } else if (result.gameState.status === 'draw') {
      io.to(roomId).emit('game-ended', { winner: null, isDraw: true, board: result.gameState.board });
    }
  }, 750);
}

// ─────────────────────────────────────────────────────────────────────────────
// WEB SERVICES [Lecture 7]: RESTful Leaderboard API
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/leaderboard', (req, res) => {
  const leaderboard = [
    { rank: 1, playerName: 'AlphaWolf',    wins: 45, losses: 5,  winRate: '90%' },
    { rank: 2, playerName: 'TicTacMaster', wins: 38, losses: 12, winRate: '76%' },
    { rank: 3, playerName: 'XKing',        wins: 32, losses: 18, winRate: '64%' },
    { rank: 4, playerName: 'OGamer',       wins: 28, losses: 22, winRate: '56%' },
    { rank: 5, playerName: 'Newbie101',    wins: 25, losses: 25, winRate: '50%' },
  ];
  res.json({
    leaderboard,
    totalGames: 500,
    activePlayers: gameManager.getPlayerCount(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', players: gameManager.getPlayerCount() });
});

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET.IO [Lecture 6]: Group Communication via Rooms (Pub-Sub pattern)
// ─────────────────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] ${socket.id} connected`);

  // ── JOIN GAME ────────────────────────────────────────────────────────────
  socket.on('join-game', ({ playerName, roomId }) => {
    const result = gameManager.addPlayer(socket.id, playerName, roomId);
    if (!result.success) {
      socket.emit('join-error', { message: result.message });
      return;
    }

    // SECURITY [Lecture 9]: Generate session token (Masquerading mitigation)
    const authToken = generateAuthToken(socket.id);
    validTokens.set(socket.id, authToken);

    // Matchmaking path – player queued, no room assigned yet
    if (!result.roomId) {
      socket.emit('waiting', { message: 'Waiting for opponent...', authToken });
      return;
    }

    // Assign socket to the room
    socket.join(result.roomId);
    socket.roomId = result.roomId;
    socket.playerSymbol = result.symbol;

    // Notify first player (otherPlayer) if present – with THEIR stored token
    const otherPlayer = result.gameState.players.find(p => p.id !== socket.id);
    if (otherPlayer) {
      const otherSocket = io.sockets.sockets.get(otherPlayer.id);
      if (otherSocket) {
        otherSocket.join(result.roomId);
        otherSocket.roomId = result.roomId;
        otherSocket.playerSymbol = otherPlayer.symbol;
        // FIX: include their existing token so client can confirm it
        otherSocket.emit('joined-game', {
          roomId: result.roomId,
          symbol: otherPlayer.symbol,
          board: result.gameState.board,
          currentPlayer: result.gameState.currentPlayer,
          players: result.gameState.players,
          status: result.gameState.status,
          authToken: validTokens.get(otherPlayer.id), // their token
        });
      }
    }

    // Notify joining player with their token
    socket.emit('joined-game', {
      roomId: result.roomId,
      symbol: result.symbol,
      board: result.gameState.board,
      currentPlayer: result.gameState.currentPlayer,
      players: result.gameState.players,
      status: result.gameState.status,
      authToken,
    });

    // Both players in → start game
    if (result.gameState.status === 'playing') {
      io.to(result.roomId).emit('game-started', {
        currentPlayer: result.gameState.currentPlayer,
        board: result.gameState.board,
        players: result.gameState.players,
      });
    }
  });

  // ── MAKE MOVE ────────────────────────────────────────────────────────────
  socket.on('make-move', ({ row, col, authToken }) => {
    if (!socket.roomId) return;

    // SECURITY [Lecture 9]: Validate token before processing move
    if (!validateToken(socket.id, authToken)) {
      socket.emit('move-error', { message: 'Unauthorized: invalid session token' });
      return;
    }

    const result = gameManager.makeMove(socket.roomId, socket.id, row, col);
    if (!result.success) {
      socket.emit('move-error', { message: result.message });
      return;
    }

    io.to(socket.roomId).emit('move-made', {
      row, col,
      symbol: result.symbol,
      board: result.gameState.board,
      currentPlayer: result.gameState.currentPlayer,
    });

    if (result.gameState.winner) {
      io.to(socket.roomId).emit('game-ended', {
        winner: result.gameState.winner,
        winningLine: result.gameState.winningLine,
        board: result.gameState.board,
      });
    } else if (result.gameState.status === 'draw') {
      io.to(socket.roomId).emit('game-ended', { winner: null, isDraw: true, board: result.gameState.board });
    } else {
      // AI BOT: schedule response if this is a bot game
      scheduleBotMove(socket.roomId);
    }
  });

  // ── CHAT [Lecture 6]: Publish message to all room subscribers ────────────
  socket.on('send-message', ({ message }) => {
    if (!socket.roomId) return;
    const player = gameManager.getPlayer(socket.id);
    if (player) {
      io.to(socket.roomId).emit('chat-message', {
        playerName: player.name,
        symbol: player.symbol,
        message,
        timestamp: Date.now(),
      });
    }
  });

  // ── RESET GAME ────────────────────────────────────────────────────────────
  socket.on('reset-game', ({ authToken } = {}) => {
    if (!socket.roomId) return;
    if (authToken && !validateToken(socket.id, authToken)) return;

    const result = gameManager.resetGame(socket.roomId);
    if (result.success) {
      io.to(socket.roomId).emit('game-reset', {
        board: result.gameState.board,
        currentPlayer: result.gameState.currentPlayer,
        status: result.gameState.status,
        winner: null, winningLine: null,
      });
      // If AI game, schedule bot move if it goes first after reset
      scheduleBotMove(socket.roomId);
    }
  });

  // ── REQUEST AI BOT ────────────────────────────────────────────────────────
  socket.on('request-ai-bot', ({ authToken }) => {
    if (!socket.roomId) return;
    if (!validateToken(socket.id, authToken)) {
      socket.emit('move-error', { message: 'Unauthorized: invalid session token' });
      return;
    }

    const botId = `bot-${socket.roomId}`;
    const result = gameManager.addPlayer(botId, '🤖 AI Bot', socket.roomId);
    if (!result.success) {
      socket.emit('move-error', { message: result.message });
      return;
    }

    // Register this room as a bot room for continued AI responses
    botRooms.set(socket.roomId, socket.id);

    socket.emit('bot-joined', {
      roomId: result.roomId,
      board: result.gameState.board,
      currentPlayer: result.gameState.currentPlayer,
      players: result.gameState.players,
      status: result.gameState.status,
    });

    io.to(socket.roomId).emit('game-started', {
      currentPlayer: result.gameState.currentPlayer,
      board: result.gameState.board,
      players: result.gameState.players,
    });

    // If bot goes first, schedule its opening move
    scheduleBotMove(socket.roomId);
  });

  // ── LEAVE GAME ────────────────────────────────────────────────────────────
  socket.on('leave-game', ({ authToken }) => {
    if (!socket.roomId) return;
    if (!validateToken(socket.id, authToken)) return;

    const roomId = socket.roomId;
    socket.to(roomId).emit('opponent-left', { message: 'Your opponent left the game.' });

    gameManager.removePlayer(socket.id);
    botRooms.delete(roomId);
    validTokens.delete(socket.id);
    socket.leave(roomId);
    socket.roomId = null;
    socket.playerSymbol = null;

    socket.emit('left-game', { success: true });
  });

  // ── P2P WebRTC SIGNALING [Lecture 8]: Server as Centralized Tracker ──────
  socket.on('webrtc-offer', ({ targetSocketId, offer, authToken }) => {
    if (!validateToken(socket.id, authToken)) {
      socket.emit('webrtc-error', { message: 'Unauthorized: invalid token for WebRTC' });
      return;
    }
    const target = io.sockets.sockets.get(targetSocketId);
    if (target) target.emit('webrtc-offer', { offer, fromSocketId: socket.id });
  });

  socket.on('webrtc-answer', ({ targetSocketId, answer, authToken }) => {
    if (!validateToken(socket.id, authToken)) {
      socket.emit('webrtc-error', { message: 'Unauthorized: invalid token for WebRTC' });
      return;
    }
    const target = io.sockets.sockets.get(targetSocketId);
    if (target) target.emit('webrtc-answer', { answer, fromSocketId: socket.id });
  });

  socket.on('webrtc-ice-candidate', ({ targetSocketId, candidate, authToken }) => {
    if (!validateToken(socket.id, authToken)) return; // silently drop
    const target = io.sockets.sockets.get(targetSocketId);
    if (target) target.emit('webrtc-ice-candidate', { candidate, fromSocketId: socket.id });
  });

  // ── DISCONNECT ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id} disconnected`);
    validTokens.delete(socket.id);
    if (socket.roomId) {
      botRooms.delete(socket.roomId);
      const result = gameManager.removePlayer(socket.id);
      if (result.success) {
        socket.to(socket.roomId).emit('opponent-left', {
          message: 'Your opponent disconnected.',
        });
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🎮  XO Server  →  port ${PORT}  |  ${process.env.NODE_ENV || 'development'}\n`);
});
