class GameManager {
  constructor() {
    this.games = new Map(); // roomId -> gameState
    this.players = new Map(); // socketId -> { roomId, symbol, name }
    this.waitingPlayers = []; // Queue for matchmaking
  }

  addPlayer(socketId, playerName, requestedRoomId = null) {
    // If player requests specific room
    if (requestedRoomId) {
      return this.joinOrCreateRoom(socketId, playerName, requestedRoomId);
    }

    // Matchmaking: Check waiting queue
    if (this.waitingPlayers.length > 0) {
      const waitingPlayer = this.waitingPlayers.shift();
      return this.createGame(socketId, playerName, waitingPlayer);
    }

    // Add to waiting queue
    this.waitingPlayers.push({ socketId, playerName });
    return {
      success: true,
      roomId: null,
      symbol: null,
      gameState: null,
      message: 'Waiting for opponent...'
    };
  }

  joinOrCreateRoom(socketId, playerName, roomId) {
    const existingGame = this.games.get(roomId);

    if (!existingGame) {
      // Create new room with this player
      const gameState = this.createEmptyGameState();
      gameState.players.push({ id: socketId, name: playerName, symbol: 'X' });
      gameState.roomId = roomId;
      this.games.set(roomId, gameState);
      this.players.set(socketId, { roomId, symbol: 'X', name: playerName });

      return {
        success: true,
        roomId,
        symbol: 'X',
        gameState
      };
    }

    // Join existing room
    if (existingGame.players.length >= 2) {
      return { success: false, message: 'Room is full' };
    }

    const symbol = existingGame.players[0].symbol === 'X' ? 'O' : 'X';
    existingGame.players.push({ id: socketId, name: playerName, symbol });
    existingGame.status = 'playing';
    this.players.set(socketId, { roomId, symbol, name: playerName });

    return {
      success: true,
      roomId,
      symbol,
      gameState: existingGame
    };
  }

  createGame(player1Id, player1Name, waitingPlayer) {
    const roomId = this.generateRoomId();
    
    const gameState = this.createEmptyGameState();
    gameState.roomId = roomId;
    gameState.players = [
      { id: waitingPlayer.socketId, name: waitingPlayer.playerName, symbol: 'X' },
      { id: player1Id, name: player1Name, symbol: 'O' }
    ];
    gameState.status = 'playing';

    this.games.set(roomId, gameState);
    this.players.set(waitingPlayer.socketId, { 
      roomId, 
      symbol: 'X', 
      name: waitingPlayer.playerName 
    });
    this.players.set(player1Id, { 
      roomId, 
      symbol: 'O', 
      name: player1Name 
    });

    return {
      success: true,
      roomId,
      symbol: 'O',
      gameState
    };
  }

  createEmptyGameState() {
    return {
      roomId: null,
      board: Array(3).fill(null).map(() => Array(3).fill(null)),
      currentPlayer: 'X',
      players: [],
      status: 'waiting', // waiting, playing, ended
      winner: null,
      winningLine: null,
      moves: []
    };
  }

  makeMove(roomId, playerId, row, col) {
    const game = this.games.get(roomId);
    if (!game) {
      return { success: false, message: 'Game not found' };
    }

    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, message: 'Player not found' };
    }

    // Validation checks
    if (game.status !== 'playing') {
      return { success: false, message: 'Game is not active' };
    }

    if (game.currentPlayer !== player.symbol) {
      return { success: false, message: 'Not your turn' };
    }

    if (row < 0 || row > 2 || col < 0 || col > 2) {
      return { success: false, message: 'Invalid position' };
    }

    if (game.board[row][col] !== null) {
      return { success: false, message: 'Position already occupied' };
    }

    // Make the move
    game.board[row][col] = player.symbol;
    game.moves.push({ row, col, symbol: player.symbol, playerId });

    // Check for winner
    const winResult = this.checkWinner(game.board, row, col, player.symbol);
    if (winResult.winner) {
      game.winner = player.symbol;
      game.winningLine = winResult.line;
      game.status = 'ended';
    } else if (this.isBoardFull(game.board)) {
      game.status = 'draw';
    } else {
      // Switch turns
      game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X';
    }

    return {
      success: true,
      symbol: player.symbol,
      gameState: game
    };
  }

  checkWinner(board, row, col, symbol) {
    // Check row
    if (board[row].every(cell => cell === symbol)) {
      return { winner: true, line: [[row, 0], [row, 1], [row, 2]] };
    }

    // Check column
    if (board.every(r => r[col] === symbol)) {
      return { winner: true, line: [[0, col], [1, col], [2, col]] };
    }

    // Check main diagonal
    if (row === col && board.every((r, i) => r[i] === symbol)) {
      return { winner: true, line: [[0, 0], [1, 1], [2, 2]] };
    }

    // Check anti-diagonal
    if (row + col === 2 && board.every((r, i) => r[2 - i] === symbol)) {
      return { winner: true, line: [[0, 2], [1, 1], [2, 0]] };
    }

    return { winner: false };
  }

  isBoardFull(board) {
    return board.every(row => row.every(cell => cell !== null));
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (!player) {
      return { success: false };
    }

    const { roomId } = player;
    const game = this.games.get(roomId);

    if (game) {
      // Remove player from game
      game.players = game.players.filter(p => p.id !== socketId);

      // End the game if it was playing
      if (game.status === 'playing') {
        game.status = 'abandoned';
      }

      // Clean up empty games
      if (game.players.length === 0) {
        this.games.delete(roomId);
      }
    }

    // Remove from waiting queue if present
    this.waitingPlayers = this.waitingPlayers.filter(p => p.socketId !== socketId);

    this.players.delete(socketId);
    return { success: true, roomId };
  }

  resetGame(roomId) {
    const game = this.games.get(roomId);
    if (!game) {
      return { success: false, message: 'Game not found' };
    }

    // Reset game state but keep players
    game.board = Array(3).fill(null).map(() => Array(3).fill(null));
    game.currentPlayer = 'X';
    game.status = 'playing';
    game.winner = null;
    game.winningLine = null;
    game.moves = [];

    return { success: true, gameState: game };
  }

  getPlayer(socketId) {
    return this.players.get(socketId);
  }

  getPlayerCount() {
    return this.players.size;
  }

  generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}

module.exports = { GameManager };
