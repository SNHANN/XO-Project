const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { GameManager } = require('./utils/GameManager');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const gameManager = new GameManager();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', playersOnline: gameManager.getPlayerCount() });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Handle player joining
  socket.on('join-game', ({ playerName, roomId }) => {
    const result = gameManager.addPlayer(socket.id, playerName, roomId);

    if (result.success) {
      // Handle waiting state (no room yet, waiting for opponent)
      if (!result.roomId) {
        socket.emit('waiting', { message: result.message || 'Waiting for opponent...' });
        return;
      }

      // Check if there's another player in this game (matchmaking scenario)
      const otherPlayer = result.gameState.players.find(p => p.id !== socket.id);

      // If there's another player, make sure they're in the room and notified
      if (otherPlayer) {
        const otherSocket = io.sockets.sockets.get(otherPlayer.id);
        if (otherSocket) {
          otherSocket.join(result.roomId);
          otherSocket.playerId = otherPlayer.id;
          otherSocket.roomId = result.roomId;
          otherSocket.playerSymbol = otherPlayer.symbol;

          // Notify the other player they've joined
          otherSocket.emit('joined-game', {
            roomId: result.roomId,
            symbol: otherPlayer.symbol,
            board: result.gameState.board,
            currentPlayer: result.gameState.currentPlayer,
            players: result.gameState.players,
            status: result.gameState.status
          });
        }
      }

      // Add current player to room
      socket.join(result.roomId);
      socket.playerId = socket.id;
      socket.roomId = result.roomId;
      socket.playerSymbol = result.symbol;

      // Notify current player
      socket.emit('joined-game', {
        roomId: result.roomId,
        symbol: result.symbol,
        board: result.gameState.board,
        currentPlayer: result.gameState.currentPlayer,
        players: result.gameState.players,
        status: result.gameState.status
      });

      // If game is ready (2 players), notify both
      if (result.gameState.status === 'playing') {
        io.to(result.roomId).emit('game-started', {
          currentPlayer: result.gameState.currentPlayer,
          board: result.gameState.board
        });
      }
    } else {
      socket.emit('join-error', { message: result.message });
    }
  });

  // Handle player moves
  socket.on('make-move', ({ row, col }) => {
    if (!socket.roomId) return;

    const result = gameManager.makeMove(socket.roomId, socket.id, row, col);

    if (result.success) {
      // Broadcast move to all players in room
      io.to(socket.roomId).emit('move-made', {
        row,
        col,
        symbol: result.symbol,
        board: result.gameState.board,
        currentPlayer: result.gameState.currentPlayer,
        lastMove: { row, col, symbol: result.symbol }
      });

      // Check for game end
      if (result.gameState.winner) {
        io.to(socket.roomId).emit('game-ended', {
          winner: result.gameState.winner,
          winningLine: result.gameState.winningLine,
          board: result.gameState.board
        });
      } else if (result.gameState.status === 'draw') {
        io.to(socket.roomId).emit('game-ended', {
          winner: null,
          isDraw: true,
          board: result.gameState.board
        });
      }
    } else {
      socket.emit('move-error', { message: result.message });
    }
  });

  // Handle chat messages
  socket.on('send-message', ({ message }) => {
    if (!socket.roomId) return;

    const player = gameManager.getPlayer(socket.id);
    if (player) {
      io.to(socket.roomId).emit('chat-message', {
        playerName: player.name,
        symbol: player.symbol,
        message,
        timestamp: Date.now()
      });
    }
  });

  // Handle game reset
  socket.on('reset-game', () => {
    if (!socket.roomId) return;

    const result = gameManager.resetGame(socket.roomId);
    if (result.success) {
      io.to(socket.roomId).emit('game-reset', {
        board: result.gameState.board,
        currentPlayer: result.gameState.currentPlayer,
        status: result.gameState.status,
        winner: null,
        winningLine: null
      });
    }
  });

  // Handle player disconnection
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    
    if (socket.roomId) {
      const result = gameManager.removePlayer(socket.id);
      if (result.success) {
        socket.to(socket.roomId).emit('player-left', {
          playerId: socket.id,
          message: 'Opponent has left the game'
        });
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Tic-Tac-Toe Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
