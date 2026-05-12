# Distributed Systems Design Document
## XO Arena — Online Multiplayer Tic-Tac-Toe

---

## 1. Architectural Pattern Selection

### 1.1 Selected Pattern: Hybrid Client-Server + P2P

The system uses a **two-tier hybrid architecture**:

- **Tier 1 — Clients**: Next.js browser applications
- **Tier 2 — Server**: Node.js/Express with Socket.io, acting as both the authoritative game server and the WebRTC signaling tracker

Game **state and validation** live on the server (Client-Server).  
Game **move delivery** can optionally flow directly between peers (P2P via WebRTC), mirroring the **Napster hybrid model** from Lecture 8.

#### Pattern Justification

| Evaluation Criteria | Pure Client-Server | Pure P2P | Hybrid (Selected) |
|--------------------|--------------------|----------|-------------------|
| **State Authority** | Centralized ✓ | Distributed ✗ | Server-authoritative ✓ |
| **Move Latency** | Round-trip (moderate) | Direct (low) ✓ | Direct when P2P available ✓ |
| **Cheating Prevention** | Server validates ✓ | Client-modifiable ✗ | Server always validates ✓ |
| **NAT Traversal** | Not needed | Complex ✗ | Via STUN (handled) ✓ |
| **Matchmaking** | Centralized ✓ | Not supported ✗ | Centralized tracker ✓ |
| **Fault Tolerance** | Server SPOF | Resilient ✓ | Server fallback ✓ |

**Conclusion:** Hybrid architecture captures the low latency of P2P for real-time moves while keeping the server as the single source of truth for game state, security, and matchmaking.

### 1.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          XO ARENA SYSTEM                            │
│                                                                     │
│  ┌──────────────────┐  Socket.io/WS   ┌───────────────────────────┐ │
│  │    CLIENT A      │◄───────────────►│                           │ │
│  │  (Next.js/React) │                 │       GAME SERVER         │ │
│  │                  │  WebRTC Signal  │    Node.js / Express      │ │
│  │  ┌────────────┐  │◄───────────────►│                           │ │
│  │  │  WebRTC    │  │                 │  ┌─────────────────────┐  │ │
│  │  │  DataChan  │  │                 │  │  Socket.io Rooms    │  │ │
│  │  └──────┬─────┘  │                 │  │  (Pub-Sub Groups)   │  │ │
│  └─────────┼────────┘                 │  ├─────────────────────┤  │ │
│            │ RTCDataChannel           │  │  GameManager        │  │ │
│            │ (direct P2P moves)       │  │  (State Machine)    │  │ │
│  ┌─────────┼────────┐                 │  ├─────────────────────┤  │ │
│  │    CLIENT B      │  Socket.io/WS   │  │  AI Bot Engine      │  │ │
│  │  (Next.js/React) │◄───────────────►│  ├─────────────────────┤  │ │
│  │                  │                 │  │  Auth Token Store   │  │ │
│  │  ┌────────────┐  │  WebRTC Signal  │  ├─────────────────────┤  │ │
│  │  │  WebRTC    │  │◄───────────────►│  │  REST /api/         │  │ │
│  │  │  DataChan  │  │                 │  │  (Leaderboard)      │  │ │
│  │  └────────────┘  │                 │  └─────────────────────┘  │ │
│  └──────────────────┘                 └───────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

**Move path options:**
1. `Client → Server → Client` (Socket.io, always available, server-validated)
2. `Client → Client` (WebRTC DataChannel, low-latency direct, optional)

---

## 2. Fundamental Models

### 2.1 Interaction Model

#### Type: Asynchronous Distributed System

| Property | Value | Explanation |
|----------|-------|-------------|
| **Communication** | Event-driven message passing | No blocking calls; all operations async |
| **Timing** | Variable latency | Network-dependent; acceptable for turn-based play |
| **Clock** | No global clock | Server timestamps used for chat; no move ordering dispute |
| **State** | Server-authoritative | Server owns board state; clients receive diffs |
| **Delivery** | At-most-once (Socket.io default) | TCP ensures no loss; at-most-once semantics |

#### Interaction Patterns

**Pattern A — Socket.io (Client-Server, always active)**
```
Client A (X)              Server              Client B (O)
     │                       │                      │
     │── join-game ─────────►│                      │
     │◄─ waiting {token} ────│                      │
     │                       │◄─ join-game ──────────│
     │◄─ joined-game ────────│                      │
     │                       │── joined-game ───────►│
     │                       │── game-started ──────►│ (broadcast)
     │◄─ game-started ───────│                      │
     │── make-move {token} ─►│                      │
     │                       │── move-made ─────────►│ (broadcast)
     │◄─ move-made ──────────│                      │
```

**Pattern B — WebRTC DataChannel (P2P, after signaling)**
```
Client A (X)              Server              Client B (O)
     │                       │                      │
     │── webrtc-offer ──────►│── webrtc-offer ──────►│
     │                       │◄─ webrtc-answer ──────│
     │◄─ webrtc-answer ──────│                      │
     │     [ICE exchange via server]                 │
     │                                               │
     │◄══════════ RTCDataChannel (direct) ══════════►│
     │                  make-move                    │ (no server hop)
```

**Key Characteristics:**
- **Non-blocking:** Clients fire events and handle responses asynchronously
- **Multicast:** `io.to(roomId).emit(...)` broadcasts to all room subscribers
- **P2P Fallback:** If WebRTC DataChannel is not open, moves fall back to Socket.io automatically
- **Server Validation:** Server validates all moves regardless of delivery path; P2P moves are optimistic updates

### 2.2 Failure Model

#### Supported Failure Types

| Failure Type | Detection Mechanism | Handling Strategy | Implementation |
|-------------|---------------------|-------------------|----------------|
| **Omission** | Socket.io internal ack | Auto-retry via TCP retransmission | Built into Socket.io/TCP stack |
| **Crash (client)** | `socket.on('disconnect')` | Notify opponent via `opponent-left`; show modal | `disconnect` handler in `server.js` |
| **Graceful leave** | `leave-game` event | Notify opponent; emit `left-game` confirmation | `leave-game` handler with token validation |
| **Network partition** | WebRTC connection failure | Fall back to Socket.io relay | `dcRef.current?.readyState` check before P2P send |
| **Invalid token** | Token mismatch on server | Drop event silently; emit `move-error` | `validTokens.get(socket.id)` check |
| **Invalid move** | `GameManager.makeMove` | Emit `move-error` to sender | Bounds/turn/occupancy checks |
| **Server crash** | Connection loss event | Client shows toast; Socket.io attempts reconnect | `connect_error` handler |

#### Failure Scenario: Opponent Disconnect

```
Player 1 (X)              Server              Player 2 (O)
     │                       │                      │
     │                       │        X── disconnect │
     │                       │◄─ [disconnect event] ─│
     │                       │                      
     │                  1. removePlayer(socketId)   
     │                  2. clean up game state       
     │                  3. delete authToken          
     │◄─ opponent-left ──────│                      
     │  {message: "..."}     │                      
     │                       │                      
  [Modal shown: Opponent Left]
  [Click → resetToIdle()]
```

#### Failure Scenario: Graceful Leave

```
Player 1 (X)              Server              Player 2 (O)
     │── leave-game {token}─►│                      │
     │                  1. validate token            
     │                  2. notify opponent           
     │                       │── opponent-left ─────►│
     │◄─ left-game {success}─│                      │
     │                       │                      │
  [resetToIdle()]         [Modal: Opponent Left]
```

### 2.3 Security Model

#### Threat Analysis

| Threat | Likelihood | Impact | Mitigation | Status |
|--------|------------|--------|------------|--------|
| **Masquerading** (move spoofing) | High | High | SHA-256 `authToken` per session, validated on every event | ✅ Implemented |
| **Denial of Service** | Medium | Medium | `express-rate-limit` — 100 req / 15 min on `/api/` | ✅ Implemented |
| **Room ID guessing** | Medium | Low | 6-character alphanumeric = 36⁶ ≈ 2.1 billion combinations | ✅ Implemented |
| **Move injection via WebRTC** | Low | High | Server re-validates all moves; P2P is optimistic only | ✅ Implemented |
| **Man-in-the-middle** | Low | High | HTTPS/WSS in production (TLS transport encryption) | Deployment-level |
| **Replay attacks** | Low | Medium | Stateful server; token invalidated on disconnect | ✅ Implemented |

#### Auth Token Lifecycle

```
Client                              Server
  │                                    │
  │── join-game { playerName } ───────►│
  │                                    │
  │               const token =        │
  │               crypto.createHash()  │
  │                  .update(socketId + Date.now() + SECRET_KEY)
  │                  .digest('hex')    │
  │               validTokens.set(socketId, token)
  │                                    │
  │◄─ waiting { authToken: token } ───│  (matchmaking path)
  │  OR                                │
  │◄─ joined-game { authToken: token }│  (room path)
  │                                    │
  │  authRef.current = token           │  (stored in useRef — never stale)
  │                                    │
  │── make-move { row, col, authToken }►│
  │                  if (validTokens.get(socketId) !== authToken)
  │                    → drop / emit move-error
  │◄─ move-made ──────────────────────│
  │                                    │
  │── [disconnect] ────────────────────│
  │                  validTokens.delete(socketId)
```

**Why `useRef` for token storage (not `useState`)?**  
Socket.io event listeners are registered once in a `useEffect`. If the token were in `useState`, the listeners would capture a stale closure value from registration time. `useRef` provides a mutable reference always pointing to the latest token value without needing to re-register all listeners on every re-render.

#### Trust Zones

```
┌────────────────────────────────────────────────────────────┐
│  UNTRUSTED ZONE (Browser)                                  │
│  Client can be modified; all inputs treated as untrusted   │
│  Client state = optimistic UI only                         │
└────────────────────────────────────────────────────────────┘
                         │  authToken + event
                         ▼
┌────────────────────────────────────────────────────────────┐
│  TRUSTED ZONE (Server)                                     │
│  GameManager validates: move bounds, turn order, token     │
│  Server state is the single source of truth                │
│  Rate limiter guards public REST endpoints                 │
└────────────────────────────────────────────────────────────┘
```

---

## 3. Inter-Process Communication (IPC) Design

### 3.1 IPC Mechanism Selection

| Mechanism | Pros | Cons | Decision |
|-----------|------|------|----------|
| **WebSocket (Socket.io)** | Full-duplex, low latency, rooms, fallback | Browser-only runtime | ✅ Primary IPC |
| **WebRTC DataChannel** | Direct P2P, lowest latency, no server hop | Requires signaling, NAT traversal | ✅ Optional P2P moves |
| **REST (HTTP GET)** | Stateless, cacheable, universally supported | Polling only, not push | ✅ Leaderboard API |
| **HTTP Long Polling** | Wide compatibility | High latency, server load | ❌ Rejected |
| **gRPC** | Type-safe, binary efficient | Browser support limited, overkill | ❌ Rejected |
| **Server-Sent Events** | Simple server push | Unidirectional only | ❌ Rejected |

### 3.2 Socket.io Protocol Stack

```
┌──────────────────────────────────────────────────────────────┐
│  Application Layer — Socket.io Events                        │
│  JSON-serialized payloads  │  Named events  │  Room multicast │
├──────────────────────────────────────────────────────────────┤
│  Transport Layer — Engine.io                                 │
│  WebSocket preferred  │  HTTP long-polling fallback          │
├──────────────────────────────────────────────────────────────┤
│  Network Layer — TCP                                         │
│  Reliable, ordered, connection-oriented delivery             │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 Room-Based Pub-Sub (Group Communication)

Socket.io Rooms implement the **publish-subscribe** pattern. Each game room is a named group; the server acts as the broker.

```
Room: "ABC123" (Lecture 6 — Group Communication)

 Publisher          Broker (Server)          Subscribers
┌──────────┐       ┌──────────────┐       ┌──────────┐
│ Player 1 │──────►│ io.to(room)  │──────►│ Player 1 │
│  emits   │       │   .emit()    │       └──────────┘
│  move    │       │              │──────►┌──────────┐
└──────────┘       └──────────────┘       │ Player 2 │
                                          └──────────┘

Properties:
  Isolation   — players in Room A cannot receive Room B events
  Multicast   — single emit fans out to all room members
  Ephemeral   — rooms destroyed when all members disconnect
  Asymmetric  — any member can publish; all members subscribe
```

**Subscribed events per room:** `move-made`, `game-started`, `game-ended`, `game-reset`, `chat-message`, `opponent-left`, `bot-joined`

### 3.4 Message Format

**Standard Socket.io event payload:**
```javascript
// Client → Server: Authenticated move request
socket.emit('make-move', {
  row: 1,
  col: 2,
  authToken: 'a3f8c...'   // SHA-256 session token (Lecture 9)
});

// Server → Room: Broadcast move result
io.to(roomId).emit('move-made', {
  row: 1, col: 2,
  symbol: 'X',
  board: [['X',null,null],[null,'O',null],[null,null,null]],
  currentPlayer: 'O'
});

// Server → Client: Token delivery on join
socket.emit('waiting', {
  message: 'Waiting for opponent...',
  authToken: 'a3f8c...'
});
```

**WebRTC DataChannel payload (P2P move):**
```javascript
// Client A → Client B directly (no server hop)
dataChannel.send(JSON.stringify({
  board: [['X',null,null],[null,'O',null],[null,null,null]],
  currentPlayer: 'O'
}));
```

---

## 4. Remote Invocation Design

### 4.1 Why Message Passing over RPC?

| Characteristic | RPC | Message Passing | Our Choice |
|----------------|-----|-----------------|------------|
| **Coupling** | Tight (function signatures) | Loose (event names) | Loose |
| **Push capability** | Request-response only | Server-initiated push | Push |
| **Async-native** | Needs callbacks/futures | Natively event-driven | Event-driven |
| **Multi-recipient** | One-to-one | One-to-many (rooms) | Multicast |
| **Schema rigidity** | IDL/proto required | JSON duck typing | Flexible |

### 4.2 Full Event Protocol

#### Client → Server

| Event | Payload | Response Event | Auth Required | Description |
|-------|---------|----------------|---------------|-------------|
| `join-game` | `{ playerName, roomId? }` | `waiting` or `joined-game` or `join-error` | No | Enter matchmaking or specific room |
| `make-move` | `{ row, col, authToken }` | `move-made` (broadcast) or `move-error` | **Yes** | Place mark on board |
| `send-message` | `{ message }` | `chat-message` (broadcast) | No | Pub-sub chat to room |
| `reset-game` | `{ authToken }` | `game-reset` (broadcast) | **Yes** | Clear board, restart |
| `request-ai-bot` | `{ authToken }` | `bot-joined` (broadcast) | **Yes** | Add AI as second player |
| `leave-game` | `{ authToken }` | `left-game` (unicast) + `opponent-left` (opponent) | **Yes** | Graceful exit |
| `webrtc-offer` | `{ targetSocketId, offer, authToken }` | relayed `webrtc-offer` | **Yes** | P2P signaling relay |
| `webrtc-answer` | `{ targetSocketId, answer, authToken }` | relayed `webrtc-answer` | **Yes** | P2P signaling relay |
| `webrtc-ice-candidate` | `{ targetSocketId, candidate, authToken }` | relayed `webrtc-ice-candidate` | **Yes** | ICE exchange relay |

#### Server → Client

| Event | Payload | Delivery | Trigger |
|-------|---------|----------|---------|
| `waiting` | `{ authToken, message }` | Unicast | Player queued for matchmaking |
| `joined-game` | `{ roomId, symbol, board, players, status, authToken }` | Unicast | Room assigned to player |
| `game-started` | `{ currentPlayer, board, players }` | Multicast | Second player joined room |
| `move-made` | `{ row, col, symbol, board, currentPlayer }` | Multicast | Valid move played |
| `game-ended` | `{ winner, winningLine?, isDraw? }` | Multicast | Win or draw detected |
| `game-reset` | `{ board, currentPlayer }` | Multicast | Game restarted |
| `bot-joined` | `{ board, currentPlayer, players }` | Multicast | AI bot added to room |
| `chat-message` | `{ playerName, symbol, message, timestamp }` | Multicast | Player sent a message |
| `opponent-left` | `{ message }` | Unicast (remaining player) | Opponent disconnected or left |
| `left-game` | `{ success }` | Unicast (leaving player) | Graceful leave confirmed |
| `move-error` | `{ message }` | Unicast | Invalid move or bad token |
| `join-error` | `{ message }` | Unicast | Room full or invalid roomId |

#### REST API (Lecture 7 — Web Services)

| Method | Endpoint | Response Format | Description |
|--------|----------|-----------------|-------------|
| `GET` | `/api/leaderboard` | `application/json` | Ranked player stats + active count |
| `GET` | `/health` | `application/json` | Server uptime check |

**Leaderboard response shape:**
```json
{
  "leaderboard": [
    { "rank": 1, "playerName": "Alice", "wins": 12, "losses": 3, "winRate": "80%" }
  ],
  "totalGames": 47,
  "activePlayers": 4,
  "timestamp": "2026-05-05T20:00:00.000Z"
}
```

### 4.3 Reliability Guarantees

| Guarantee | Mechanism | Notes |
|-----------|-----------|-------|
| **Ordered delivery** | TCP guarantees in-order segments | Socket.io events arrive in emission order |
| **At-most-once** | Socket.io default semantics | No duplicate delivery |
| **No persistence** | In-memory `Map` on server | State lost on server restart |
| **P2P optimistic** | Client updates board immediately on P2P send | Server remains authoritative; mismatch resolved on next Socket.io event |

---

## 5. Web Services & Group Communication Design

### 5.1 RESTful Leaderboard API (Lecture 7)

The leaderboard is exposed as a **traditional REST Web Service** over HTTP, demonstrating the contrast between stateless request-response (REST) and stateful persistent connection (WebSocket) paradigms.

```
Client (Leaderboard.tsx)          Server (/api/leaderboard)
        │                                   │
        │── GET /api/leaderboard ──────────►│
        │                            Rate limiter check
        │                            Build leaderboard from games Map
        │◄── 200 OK { leaderboard: [...] } ─│
        │                                   │
        │  [Auto-repeat every 30 seconds]
```

**Design choices:**
- Stateless HTTP GET — no session cookie needed
- Rate-limited to 100 requests / 15 min via `express-rate-limit`
- Returns computed stats (wins, losses, win rate) from the live in-memory game store
- Client polls every 30 s rather than pushing (WebSocket push would be overengineering for a leaderboard)

### 5.2 Group Communication — Socket.io Rooms (Lecture 6)

| Property | Value |
|----------|-------|
| **Model** | Publish-Subscribe with named groups (rooms) |
| **Membership** | Explicit: `socket.join(roomId)` / `socket.leave(roomId)` |
| **Delivery** | `io.to(roomId).emit(event, data)` — all subscribers receive |
| **Ordering** | FIFO per connection (TCP) |
| **Persistence** | None — ephemeral for session lifetime |
| **Failure** | Member crash removes them; remaining subscribers unaffected |

Chat messages use the same room pub-sub channel as game events, demonstrating that a single group-communication primitive serves multiple application concerns.

---

## 6. AI Bot Design (Lecture 8 — Autonomous Agent)

The AI bot acts as a virtual second player, enabling single-player games without human matchmaking.

### Bot Architecture

```
Server (botRooms Map)
  │
  ├── botRooms.set(roomId, true)   ← when request-ai-bot received
  │
  └── After every valid move-made in a bot room:
          scheduleBotMove(roomId, 600ms delay)
                │
                └── getBotMove(board)
                        │
                        ├── 1. Winning move available? → take it
                        ├── 2. Block opponent win?    → block it
                        ├── 3. Center free?           → take center
                        ├── 4. Corner available?      → take corner
                        └── 5. Fallback: random empty cell
```

**Strategic priority:** win > block > center > corner > random  
**Delay:** 600 ms simulated think time for natural UX

---

## 7. Design Summary

### 7.1 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Hybrid CS + P2P over pure CS | P2P DataChannel cuts move latency; server retains authority |
| Socket.io over raw WebSocket | Built-in rooms, fallback, reconnection, event namespacing |
| `useRef` for auth token | Prevents stale closure in async socket callbacks |
| In-memory state over database | Speed priority; acceptable for session-scoped game state |
| SHA-256 tokens over sessions | Lightweight, stateless verification; no cookie needed |
| Strategic AI over Minimax | O(1) response for 3×3 is sufficient; Minimax overkill |
| REST for leaderboard over WS | Stateless polling fits the use case; avoids unnecessary subscription |

### 7.2 Trade-offs

| Trade-off | Our Choice | Alternative | Impact |
|-----------|-----------|-------------|--------|
| P2P latency vs server authority | Both (hybrid) | One or the other | Best of both; server wins disputes |
| Speed vs persistence | Speed (in-memory) | Database | Fast gameplay; data lost on crash |
| Availability vs consistency | Availability | Strict consistency | Players continue with slight delay |
| Client UX vs complexity | Optimistic P2P updates | All-synchronous | Snappier feel; minor resync risk |
| Simplicity vs features | Moderate complexity | Feature-sparse | Core features all working reliably |

---

## 8. Future Enhancements

| Enhancement | Design Impact |
|-------------|-------------|
| **Database persistence** | Add data tier; leaderboard survives restarts |
| **Session reconnection** | Store game state keyed by player name; re-join on socket reconnect |
| **Spectator mode** | Add observer role to rooms; emit read-only `game-update` events |
| **Multi-room scaling** | Redis adapter for Socket.io; horizontal server scaling |
| **WebRTC TURN server** | Handle symmetric NAT for corporate/mobile networks |
| **Minimax AI** | Replace strategic heuristic with full minimax for harder difficulty |

---

**Document Version:** 2.0  
**Last Updated:** 2026-05-05  
**Author:** System Designer
