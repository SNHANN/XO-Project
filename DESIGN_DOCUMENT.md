# Distributed Systems Design Document
## Online Multiplayer Tic-Tac-Toe Game

---

## 1. Architectural Pattern Selection

### 1.1 Selected Pattern: Client-Server Architecture

#### Justification

| Evaluation Criteria | Client-Server | Peer-to-Peer | Winner |
|-------------------|---------------|--------------|--------|
| **State Management** | Centralized (easy to sync) | Distributed (complex sync) | CS |
| **Cheating Prevention** | Server validates all moves | Clients can modify logic | CS |
| **Scalability** | Horizontal scaling possible | Limited by peer connections | CS |
| **Latency for 2-Player** | Moderate (round-trip) | Low (direct connection) | Tie |
| **Implementation Complexity** | Moderate | High (NAT traversal) | CS |
| **Single Source of Truth** | Server owns state | Multiple copies | CS |

**Conclusion:** Client-Server is optimal for multiplayer games requiring central authority.

### 1.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Player 1   │  │  Player 2   │  │  Player N   │              │
│  │  Browser    │  │  Browser    │  │  Browser    │              │
│  │  (Next.js)  │  │  (Next.js)  │  │  (Next.js)  │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          │ WebSocket (TCP)                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                         SERVER LAYER                             │
│                          │                                        │
│  ┌───────────────────────┴───────────────────────┐               │
│  │           Socket.io Server                    │               │
│  │  ┌─────────────┐    ┌─────────────────────┐   │               │
│  │  │  Connection │◄──►│   GameManager       │   │               │
│  │  │  Handler    │    │  (State Machine)    │   │               │
│  │  └─────────────┘    └─────────────────────┘   │               │
│  │                          │                    │               │
│  │                    ┌─────┴─────┐              │               │
│  │                    │ In-Memory │              │               │
│  │                    │   Store   │              │               │
│  │                    │ (Games Map)│              │               │
│  │                    └───────────┘              │               │
│  └───────────────────────────────────────────────┘               │
└───────────────────────────────────────────────────────────────────┘
```

---

## 2. Fundamental Models

### 2.1 Interaction Model

#### Type: Asynchronous Distributed System

| Property | Value | Explanation |
|----------|-------|-------------|
| **Communication** | Event-driven (Message Passing) | No blocking calls |
| **Timing** | Variable latency | Network-dependent |
| **Clock** | No global clock | Logical timestamps only |
| **State** | Eventually consistent | All clients receive updates |

#### Interaction Patterns

```
┌──────────┐                    ┌──────────┐
│ Client A │ ──1. make-move──►  │  Server  │
│   (X)    │                    │          │
└──────────┘                    │ Validate │
                                  │  Update  │
┌──────────┐                    │  State   │
│ Client B │ ◄──2. move-made──  │          │
│   (O)    │                    │  Check   │
└──────────┘                    │  Win?    │
           ◄──3. game-ended──   │          │
                                  └──────────┘
```

**Key Characteristics:**
- **Non-blocking:** Client does not wait for response
- **Multicast:** Server broadcasts to all room members
- **Ordered:** Socket.io guarantees message order per room

### 2.2 Failure Model

#### Supported Failure Types

| Failure Type | Detection | Handling Strategy | Implementation |
|-------------|-----------|-------------------|----------------|
| **Omission** (lost messages) | Timeout + Ack | Socket.io auto-retry | Built-in retry with exponential backoff |
| **Crash** (client disconnect) | `disconnect` event | Notify opponent, end game | `socket.on('disconnect', ...)` |
| **Network Delay** | High latency detection | Continue with stale state | Acceptable for turn-based game |
| **Server Crash** | Connection loss | Client shows error, allows reconnect | Future: implement reconnection |

#### Failure Scenarios & Responses

```
Scenario 1: Player disconnects mid-game
┌─────────┐         ┌─────────┐         ┌─────────┐
│ Player 1│◄────X───►│ Server  │◄───────►│ Player 2│
│  (X)    │  disconnect │         │         │  (O)    │
└─────────┘         └────┬────┘         └─────────┘
                         │
                    1. Detect disconnect
                    2. Update game status = 'abandoned'
                    3. Emit 'player-left' to Player 2
                    4. Player 2 sees: "Opponent has left the game"

Scenario 2: Message loss (rare with TCP)
┌─────────┐         ┌─────────┐
│ Client  │──move?─►│ Server  │ (message lost)
│         │         │         │
│         │──move?─►│ Server  │ (retry)
│         │◄─ack───│         │ (received)
└─────────┘         └─────────┘
```

### 2.3 Security Model

#### Threat Analysis

| Threat | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| Move spoofing | High | High | Server validates all moves |
| Room ID guessing | Medium | Low | 6-character random IDs |
| Man-in-the-middle | Low | High | HTTPS/WSS encryption |
| Replay attacks | Low | Medium | No action replay (stateful) |
| DoS | Low | Medium | Rate limiting (future) |

#### Security Measures Implemented

```javascript
// Server-side validation example (GameManager.js)
makeMove(roomId, playerId, row, col) {
  // 1. Verify game exists
  if (!game) return { success: false, message: 'Game not found' };
  
  // 2. Verify player is in this game
  if (!player) return { success: false, message: 'Player not found' };
  
  // 3. Verify it is player's turn
  if (game.currentPlayer !== player.symbol) {
    return { success: false, message: 'Not your turn' };
  }
  
  // 4. Verify position is valid and empty
  if (row < 0 || row > 2 || col < 0 || col > 2 || 
      game.board[row][col] !== null) {
    return { success: false, message: 'Invalid move' };
  }
  
  // 5. Only then apply move
  game.board[row][col] = player.symbol;
}
```

#### Trust Zones

```
┌─────────────────────────────────────────┐
│           UNTRUSTED ZONE                │
│  (Browser - Client can be modified)     │
│  Never trust client-side validation     │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│            TRUSTED ZONE                 │
│  (Server - GameManager validation)      │
│  Only server state is authoritative     │
└─────────────────────────────────────────┘
```

---

## 3. Inter-Process Communication (IPC) Design

### 3.1 IPC Mechanism Selection

| Mechanism | Pros | Cons | Decision |
|-----------|------|------|----------|
| **WebSocket** | Full-duplex, low latency, event-driven | Browser-only | Selected |
| **HTTP Long Polling** | Wide compatibility | High latency, inefficient | Rejected |
| **WebRTC P2P** | Direct connection, low latency | Complex NAT traversal, no central authority | Rejected |
| **gRPC** | Type-safe, efficient | Overkill, browser support limited | Rejected |
| **Server-Sent Events** | Simple one-way | No client-to-server push | Rejected |

### 3.2 Socket.io Design Decisions

```
┌─────────────────────────────────────────────────────────┐
│                    SOCKET.IO STACK                       │
┌─────────────────────────────────────────────────────────┐
│  Socket.io (Application Layer)                          │
│  - Event namespacing                                    │
│  - Room management                                      │
│  - Fallback to polling if WebSocket fails               │
├─────────────────────────────────────────────────────────┤
│  Engine.io (Transport Layer)                            │
│  - WebSocket preferred                                  │
│  - HTTP long-polling fallback                           │
├─────────────────────────────────────────────────────────┤
│  TCP (Network Layer)                                    │
│  - Reliable, ordered delivery                           │
│  - Connection-oriented                                  │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Room-Based Communication

```
Room: "ABC123"
┌──────────┐     ┌──────────┐
│ Player 1 │◄───►│ Player 2 │
│ (Socket) │     │ (Socket) │
└────┬─────┘     └────┬─────┘
     │                │
     └────┬───────────┘
          │
    ┌─────┴─────┐
    │  Server   │
    │ io.to()   │
    │ .emit()   │
    └───────────┘

Benefits:
- Isolation: Players in different rooms do not see each other
- Multicast: Efficient broadcast to room members
- Scalability: Rooms can be distributed across servers
```

### 3.4 Message Format

```javascript
// Event Structure (Socket.io)
{
  event: "make-move",           // Event name
  data: { row: 1, col: 2 },     // Payload
  room: "ABC123",               // Room ID (implicit via socket.join)
  timestamp: 1699123456789      // Client-side timestamp (optional)
}

// Server Response Pattern
socket.emit('move-made', {
  row: 1,
  col: 2,
  symbol: 'X',
  board: [...],
  currentPlayer: 'O',
  serverTimestamp: Date.now()  // Server validation
});
```

---

## 4. Remote Invocation Design

### 4.1 Why Message Passing over RPC?

| Characteristic | RPC (Remote Procedure Call) | Message Passing | Our Choice |
|----------------|----------------------------|-----------------|------------|
| **Coupling** | Tight (function signatures) | Loose (event names) | Loose |
| **Flexibility** | Low (fixed interfaces) | High (dynamic events) | High |
| **Real-time** | Request-response only | Push notifications | Push |
| **Game Events** | Sync calls | Async events | Async |
| **Complexity** | IDL definitions needed | Simple event names | Simple |

### 4.2 Remote Invocation Pattern

```
Pattern: Event-Driven Message Passing
Style: Fire-and-Forget + Acknowledgment

Client A                          Server
   │                                │
   │──1. Emit: join-game──────────►│
   │                                │
   │◄──2. Ack: joined-game─────────│
   │                                │
   │──3. Emit: make-move──────────►│
   │                                │
   │◄──4. Broadcast: move-made───────│ (to all in room)
   │                                │
   │◄──5. Broadcast: game-ended──────│ (if game over)
   │                                │
```

### 4.3 Event Protocol Specification

#### Client to Server (Invocations)

| Event | Payload | Response | Description |
|-------|---------|----------|-------------|
| `join-game` | `{ playerName, roomId? }` | `joined-game` or `join-error` | Join or create game |
| `make-move` | `{ row, col }` | `move-made` or `move-error` | Make a move |
| `send-message` | `{ message }` | `chat-message` (broadcast) | Send chat |
| `reset-game` | - | `game-reset` (broadcast) | Restart game |

#### Server to Client (Callbacks/Broadcasts)

| Event | Payload | Trigger | Delivery |
|-------|---------|---------|----------|
| `joined-game` | Game state | Player joins successfully | Unicast |
| `game-started` | Initial state | Second player joins | Multicast |
| `move-made` | Move + new state | Valid move played | Multicast |
| `game-ended` | Winner/Draw info | Game completed | Multicast |
| `chat-message` | Message data | Player sends message | Multicast |
| `player-left` | Disconnect info | Player disconnects | Multicast to room |

### 4.4 Reliability Guarantees

| Guarantee | Implementation | Notes |
|-----------|----------------|-------|
| **At-Most-Once** | Socket.io default | No duplicate delivery |
| **Ordered Delivery** | TCP guarantees | Events arrive in order |
| **No Persistence** | Memory-only | Lost on server restart |
| **No QoS** | Best-effort | No priority levels |

---

## 5. Design Summary

### 5.1 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Client-Server over P2P | Central authority needed for game validation |
| WebSocket over HTTP | Real-time bidirectional communication required |
| Message Passing over RPC | Better fit for event-driven game updates |
| In-Memory over Database | Speed priority, acceptable data loss on crash |
| Room-based multicast | Efficient multi-player synchronization |

### 5.2 Trade-offs

| Trade-off | Our Choice | Alternative | Impact |
|-----------|-----------|-------------|--------|
| Speed vs Persistence | Speed (in-memory) | Database | Fast gameplay, lose data on crash |
| Consistency vs Availability | Availability | Strict consistency | Players can continue with slight delay |
| Complexity vs Features | Moderate complexity | Rich features | Core features work reliably |

---

## 6. Future Enhancements

| Enhancement | Design Impact |
|-------------|-------------|
| Database persistence | Add data tier, update failure model |
| Authentication | Add auth layer, update security model |
| Reconnection | Add session recovery, update failure model |
| Spectator mode | Add observer pattern to interaction model |
| AI opponents | Add bot player to architecture |

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-14  
**Author:** System Designer
