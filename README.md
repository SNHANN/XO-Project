# Online Multiplayer Tic-Tac-Toe Game

A real-time distributed system that allows two players to play Tic-Tac-Toe over the internet using a client-server architecture.

## Features

- **Real-time Multiplayer**: Play against opponents anywhere in real-time
- **Matchmaking**: Automatic matchmaking or create/join custom game rooms
- **Chat System**: Built-in chat to communicate with your opponent
- **Responsive Design**: Works on desktop and mobile devices
- **Game Rooms**: Support for multiple concurrent games

## Architecture

### System Components

```
┌──────────────┐         WebSocket          ┌──────────────┐
│   Client 1   │  ◄──────────────────────►  │              │
│  (Next.js)   │                            │   Game       │
└──────────────┘                            │   Server     │
                                            │  (Node.js)   │
┌──────────────┐         WebSocket          │   Socket.io  │
│   Client 2   │  ◄──────────────────────►  │              │
│  (Next.js)   │                            └──────────────┘
└──────────────┘
```

### Technology Stack

- **Frontend**: Next.js 14, React, TypeScript, TailwindCSS, Lucide Icons
- **Backend**: Node.js, Express, Socket.io
- **Communication**: WebSockets (Socket.io) over TCP
- **Deployment**: Render (server), Vercel (client)

## Project Structure

```
XO-Project/
├── client/                 # Next.js frontend
│   ├── app/               # App router
│   │   ├── globals.css    # Global styles
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Main game page
│   ├── components/        # React components
│   │   ├── JoinForm.tsx
│   │   ├── GameBoard.tsx
│   │   ├── PlayerInfo.tsx
│   │   ├── StatusBar.tsx
│   │   └── ChatBox.tsx
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── server.js      # Main server file
│   │   └── utils/
│   │       └── GameManager.js  # Game logic
│   ├── package.json
│   └── .env.example
│
├── render.yaml            # Render deployment config
├── vercel.json           # Vercel deployment config
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd XO-Project
   ```

2. **Install server dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Install client dependencies**
   ```bash
   cd ../client
   npm install
   ```

### Running Locally

1. **Start the server**
   ```bash
   cd server
   npm run dev
   ```
   Server will run on http://localhost:3001

2. **Start the client** (in a new terminal)
   ```bash
   cd client
   npm run dev
   ```
   Client will run on http://localhost:3000

3. **Open the app**
   - Navigate to http://localhost:3000
   - Enter your name and click "Play Now"
   - Or enter a Room ID to join a specific game

### Development Mode

The server supports hot reloading with nodemon:
```bash
cd server
npm run dev
```

## Deployment

### Deploy Server to Render

1. Create an account on [Render](https://render.com)
2. Create a new Web Service
3. Connect your GitHub repository
4. Configure:
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
   - **Environment Variables**:
     - `PORT`: 3001
     - `NODE_ENV`: production
     - `CLIENT_URL`: Your Vercel app URL

### Deploy Client to Vercel

1. Create an account on [Vercel](https://vercel.com)
2. Import your GitHub repository
3. Configure:
   - **Framework**: Next.js
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Environment Variables**:
     - `NEXT_PUBLIC_SERVER_URL`: Your Render server URL

## How to Play

1. **Joining a Game**
   - Enter your player name
   - Leave Room ID empty for automatic matchmaking
   - Or enter a Room ID to create/join a specific room

2. **Playing**
   - Wait for an opponent to join
   - X always goes first
   - Click on an empty cell to place your mark
   - Get 3 in a row (horizontal, vertical, or diagonal) to win

3. **Chat**
   - Use the chat box on the right to message your opponent

## Communication Protocol

The game uses Socket.io for real-time bidirectional communication:

### Client → Server Events

- `join-game`: Join or create a game room
- `make-move`: Submit a move (row, col)
- `send-message`: Send chat message
- `reset-game`: Request game reset

### Server → Client Events

- `joined-game`: Confirm successful room join
- `player-joined`: Notify of new player
- `game-started`: Game begins
- `move-made`: Broadcast player move
- `game-ended`: Game over (win/draw)
- `chat-message`: Broadcast chat message
- `game-reset`: New game started

## Failure Handling

The system handles various failure scenarios:

- **Omission Failure**: Messages are resent automatically by Socket.io
- **Crash Failure**: Server maintains game state; players can reconnect
- **Network Delay**: Asynchronous design accommodates variable latency
- **Validation**: Server validates all moves to prevent cheating

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
