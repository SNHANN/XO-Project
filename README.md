# XO Arena — Online Multiplayer Tic-Tac-Toe

A production-grade real-time multiplayer Tic-Tac-Toe game implementing distributed systems concepts from **Lectures 1–9**. Features a dark glassmorphism UI, hybrid P2P architecture via WebRTC, a RESTful leaderboard API, secure token-based authentication, AI bot fallback, and a live pub-sub chat system.

---

## Distributed Systems Concepts Implemented

| Lecture | Concept | Implementation |
|---------|---------|----------------|
| L1–L5 | **IPC via WebSockets** | Socket.io over TCP with JSON marshalling for all game events |
| L6 | **Group Communication / Pub-Sub** | Socket.io Rooms — chat and game events broadcast to room subscribers |
| L7 | **Web Services / REST API** | `GET /api/leaderboard` returns JSON; consumed by the Leaderboard component |
| L8 | **Hybrid P2P Architecture** | Server as centralized tracker (Napster-style); WebRTC DataChannel for direct move relay |
| L9 | **Security Mitigations** | SHA-256 token per session (masquerading); `express-rate-limit` on `/api/` (DoS) |

---

## Features

- **Real-time Multiplayer** — Socket.io WebSocket connections with sub-100 ms round-trips
- **Quick Match & Private Rooms** — automatic matchmaking queue or 6-char room codes
- **Waiting Lounge** — animated overlay with room code copy and AI bot option
- **AI Bot Fallback** — strategic AI (win → block → center → corner) that responds after every move
- **Hybrid P2P Moves** — optional WebRTC DataChannel for direct peer-to-peer move delivery; Socket.io fallback
- **Live Chat** — pub-sub chat with styled bubbles, timestamps, and auto-scroll
- **RESTful Leaderboard** — polled every 30 s from `/api/leaderboard`
- **Graceful Disconnect** — modal notification when opponent leaves or disconnects
- **Secure Token Lifecycle** — token generated on join, stored in `useRef`, attached to every sensitive emission
- **Dark Glassmorphism UI** — deep `#07071a` background, neon X/O symbols, frosted-glass cards, smooth animations

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      XO ARENA SYSTEM                        │
│                                                             │
│  ┌──────────────┐   Socket.io    ┌──────────────────────┐   │
│  │  Client A    │◄──────────────►│                      │   │
│  │  (Next.js)   │   WebSocket    │   Game Server        │   │
│  │              │                │   Node.js/Express    │   │
│  │  WebRTC ◄────┼────────────────┼──── Signaling ───────┤   │
│  └──────┬───────┘                │   Socket.io Rooms    │   │
│         │ RTCDataChannel         │   Rate Limiter       │   │
│         │ (direct P2P)           │   Auth Tokens        │   │
│  ┌──────▼───────┐   Socket.io    │   GameManager        │   │
│  │  Client B    │◄──────────────►│   AI Bot Engine      │   │
│  │  (Next.js)   │   WebSocket    │   REST /api/         │   │
│  └──────────────┘                └──────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Two-tier architecture**: Next.js client (tier 1) ↔ Node.js/Express server (tier 2).  
Server acts as both the Socket.io relay and WebRTC signaling server (centralized tracker).  
Once the P2P handshake completes, game moves flow directly between peers via `RTCDataChannel`.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14, React 18, TypeScript |
| **Styling** | TailwindCSS 3, custom glassmorphism CSS |
| **Icons** | Lucide React |
| **Backend** | Node.js, Express |
| **Real-time IPC** | Socket.io 4 (WebSocket over TCP) |
| **P2P** | WebRTC `RTCDataChannel` |
| **Security** | `crypto` SHA-256 tokens, `express-rate-limit` |

---

## Project Structure

```
XO-Project/
├── client/                       # Next.js 14 frontend
│   ├── app/
│   │   ├── globals.css           # Dark glassmorphism theme + animations
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Main orchestrator — socket logic, state, P2P
│   ├── components/
│   │   ├── JoinForm.tsx          # Quick Match / Private Room form
│   │   ├── WaitingLounge.tsx     # Animated waiting overlay with AI button
│   │   ├── GameBoard.tsx         # 3×3 board with neon marks and win animations
│   │   ├── ChatBox.tsx           # Pub-sub chat with message bubbles
│   │   └── Leaderboard.tsx       # REST API consumer, auto-refreshes every 30 s
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── server/
│   ├── src/
│   │   ├── server.js             # Express + Socket.io + WebRTC signaling + AI bot
│   │   └── utils/
│   │       └── GameManager.js    # Game state, matchmaking, move validation
│   ├── package.json
│   └── .env.example
│
├── config.js                     # Centralized URL configuration helper
├── render.yaml                   # Render deployment config
├── .env.example
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# 1. Clone
git clone <repository-url>
cd XO-Project

# 2. Server dependencies
cd server && npm install

# 3. Client dependencies
cd ../client && npm install
```

### Environment Variables

**`server/.env`**
```
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:3000
SECRET_KEY=your-secret-key-here
```

**`client/.env.local`**
```
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
```

### Run Locally

```bash
# Terminal 1 — server (port 3001)
cd server
npm run dev

# Terminal 2 — client (port 3000)
cd client
npm run dev
```

Open **http://localhost:3000** in two browser tabs to test multiplayer.

---

## How to Play

1. **Quick Match** — enter your name, click *Find a Match*; server queues you automatically
2. **Private Room** — switch to *Private Room* tab, leave Room ID blank to create, or enter a code to join
3. **Waiting Lounge** — copy the room code and share it, or click **Play Against AI Bot** to start instantly
4. **Gameplay** — X goes first; click any empty cell on your turn
5. **P2P Mode** — enable the toggle in-game; click *Establish P2P* to route moves via WebRTC DataChannel
6. **Chat** — message your opponent via the chat panel on the right
7. **Leave** — click 🚪 *Leave Game* to exit gracefully; your opponent is notified

---

## Communication Protocol

### Client → Server (Socket.io events)

| Event | Payload | Description |
|-------|---------|-------------|
| `join-game` | `{ playerName, roomId? }` | Join matchmaking queue or specific room |
| `make-move` | `{ row, col, authToken }` | Submit a move (token validated server-side) |
| `send-message` | `{ message }` | Publish chat message to room |
| `reset-game` | `{ authToken }` | Request game reset |
| `request-ai-bot` | `{ authToken }` | Add AI bot as second player |
| `leave-game` | `{ authToken }` | Graceful exit with opponent notification |
| `webrtc-offer` | `{ targetSocketId, offer, authToken }` | WebRTC signaling — offer |
| `webrtc-answer` | `{ targetSocketId, answer, authToken }` | WebRTC signaling — answer |
| `webrtc-ice-candidate` | `{ targetSocketId, candidate, authToken }` | WebRTC ICE exchange |

### Server → Client (Socket.io events)

| Event | Payload | Description |
|-------|---------|-------------|
| `waiting` | `{ authToken, message }` | Player queued for matchmaking; token delivered |
| `joined-game` | `{ roomId, symbol, board, players, authToken }` | Room assigned; token delivered/confirmed |
| `game-started` | `{ currentPlayer, board, players }` | Both players present; board unlocked |
| `move-made` | `{ row, col, symbol, board, currentPlayer }` | Move broadcast to room |
| `game-ended` | `{ winner, winningLine?, isDraw? }` | Game over |
| `game-reset` | `{ board, currentPlayer }` | Board cleared for new round |
| `bot-joined` | `{ board, currentPlayer, players }` | AI bot added to game |
| `chat-message` | `{ playerName, symbol, message, timestamp }` | Chat message published to room |
| `opponent-left` | `{ message }` | Opponent disconnected or left gracefully |
| `left-game` | `{ success }` | Confirms graceful leave for departing player |
| `move-error` | `{ message }` | Invalid move or auth failure |

### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/leaderboard` | Returns JSON leaderboard + active player count |
| `GET` | `/health` | Server health check |

---

## Security

- **Masquerading Mitigation** — SHA-256 `authToken` generated per session on join, validated on every `make-move`, `leave-game`, and WebRTC signaling event
- **DoS Mitigation** — `express-rate-limit` limits `/api/` routes to 100 requests per 15-minute window
- **Token Storage** — client stores token in `useRef` (not `useState`) to prevent stale closure vulnerabilities in async event handlers

---

## Failure Handling

| Failure Type | Handling |
|---|---|
| **Omission** | Socket.io auto-reconnects and replays events; at-most-once semantics |
| **Crash (opponent)** | `opponent-left` event fires; modal shown; game ends gracefully |
| **Network partition** | WebRTC falls back to Socket.io relay automatically |
| **Invalid move** | Server validates all moves; `move-error` sent back to client |
| **Token mismatch** | Server silently drops or rejects the event |

---

## Deployment

### Server → Render

```yaml
# render.yaml is pre-configured
Build Command:  cd server && npm install
Start Command:  cd server && npm start
Env Vars:       PORT, NODE_ENV, CLIENT_URL, SECRET_KEY
```

### Client → Vercel

```
Root Directory:   client
Framework:        Next.js
Env Vars:         NEXT_PUBLIC_SERVER_URL=<your Render URL>
```

### Quick Config

```bash
# Edit config.js with your deployed URLs, then run:
node config.js
# Automatically patches render.yaml, next.config.js, and .env files
```

---

## License

MIT
