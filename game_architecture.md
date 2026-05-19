# 🎮 "Draw This Shytt" — Game Architecture

## Full Game Flow Diagram

```mermaid
sequenceDiagram
    participant Host
    participant Server
    participant Players
    participant Gemini as Gemini Vision API
    participant Groq as Groq LLM API

    Note over Host,Players: 🏠 LOBBY PHASE
    Host->>Server: create-game-room (settings)
    Server-->>Host: room-code + game-state
    Players->>Server: join-game-room (code)
    Server-->>Host: player-joined
    Server-->>Players: game-lobby-state (player list)
    Host->>Server: start-game
    Server-->>Host: game-started
    Server-->>Players: game-started

    loop For each Round (default 3)
        loop For each Turn (3 turns per round)
            Note over Server: 🎯 PICKER SELECTION
            Server->>Server: Pick random user (fair rotation)
            
            alt Word List: AI Generated
                Server->>Groq: Generate 3 drawable words
                Groq-->>Server: ["cat", "house", "sun"]
            else Word List: Predefined Category
                Server->>Server: Pull 3 random from category
            end
            
            Server-->>Host: turn-started (role: picker/drawer)
            Server-->>Players: turn-started (role: picker/drawer)
            
            Note over Server: ⏳ WORD PICK PHASE (15s)
            Server-->>Players: picker-selecting (wait screen)
            Server->>Server: Start 15s pick timer
            
            alt Picker picks within 15s
                Host->>Server: word-picked (word)
            else Timer expires
                Server->>Server: Auto-select random word
            end
            
            Server-->>Players: drawing-countdown (3...2...1)
            
            Note over Server: 🎨 DRAWING PHASE
            Server->>Server: Start drawing timer (default 60s)
            
            loop Every second
                Server-->>Host: timer-tick (remaining)
                Server-->>Players: timer-tick (remaining)
            end
            
            Note over Players: Each drawer draws on isolated canvas
            Note over Host: Picker spectates all canvases live
            
            Players->>Server: game-stroke-live (drawing data)
            Server-->>Host: spectator-stroke (from picker's view)
            
            Server-->>Host: drawing-ended
            Server-->>Players: drawing-ended
            
            Note over Server: 🤖 AI SCORING PHASE
            Players->>Server: POST /api/game/score (canvas PNG)
            Server->>Gemini: Score each drawing vs word
            Gemini-->>Server: Score (0-100) per drawing
            
            Server-->>Host: turn-scores (all drawings + scores)
            Server-->>Players: turn-scores (all drawings + scores)
            
            Note over Server: ⏳ 10s auto-countdown to next turn
        end
    end
    
    Note over Server: 🏆 FINAL LEADERBOARD
    Server-->>Host: game-ended (final scores)
    Server-->>Players: game-ended (final scores)
```

## System Architecture

```mermaid
graph TD
    subgraph Frontend [Client — React / Vite]
        GameMenu[Game Menu Button in Lobby]
        
        subgraph GameScreens [Game Mode Screens]
            GLobby[Game Lobby Screen]
            WPicker[Word Picker Screen]
            WWait[Waiting Screen]
            GDraw[Drawing Screen<br/>Isolated Canvas]
            GSpec[Spectator Screen<br/>Canvas Switcher]
            GReveal[Reveal Screen]
            GFinal[Final Leaderboard]
        end
        
        GameStore[Game Zustand Store]
        GameSocket[Game Socket Hook]
        
        GameMenu --> GLobby
        GLobby --> WPicker
        GLobby --> WWait
        WWait --> GDraw
        WPicker --> GSpec
        GDraw --> GReveal
        GSpec --> GReveal
        GReveal --> WPicker
        GReveal --> GFinal
        
        GameScreens --> GameStore
        GameScreens --> GameSocket
    end
    
    subgraph Backend [Server — Node.js / Express]
        subgraph ExistingHandlers [Existing Whiteboard]
            WBHandlers[socket/handlers.ts<br/>UNCHANGED]
        end
        
        subgraph GameHandlers [New Game Handlers]
            GHandlers[socket/gameHandlers.ts]
            GTimer[Server-side Timer]
            GState[Game Room State<br/>In-Memory]
            GScoring[Score Route<br/>POST /api/game/score]
        end
        
        subgraph APIs [External APIs]
            GeminiAPI[Gemini Vision API]
            GroqAPI[Groq LLM API]
        end
        
        GHandlers --> GTimer
        GHandlers --> GState
        GScoring --> GeminiAPI
        GHandlers --> GroqAPI
    end
    
    GameSocket <-->|WebSocket| GHandlers
    GDraw -->|POST PNG| GScoring
```

## File Structure (New Files Only)

```
Backend/
├── socket/
│   ├── handlers.ts              # UNCHANGED
│   └── gameHandlers.ts          # NEW — all game socket events
├── routes/
│   └── gameRoutes.ts            # NEW — /api/game/score endpoint
├── game/
│   ├── gameState.ts             # NEW — game room state management
│   ├── wordLists.ts             # NEW — predefined word categories
│   └── timer.ts                 # NEW — server-side timer
└── index.ts                     # MODIFIED — register game handlers + routes

Frontend/src/
├── game/
│   ├── gameStore.ts             # NEW — Zustand store for game state
│   ├── gameSocket.ts            # NEW — game socket hook
│   ├── GameLobby.tsx            # NEW — lobby with settings
│   ├── WordPicker.tsx           # NEW — 3-card word selection
│   ├── WaitingScreen.tsx        # NEW — "picker is choosing"
│   ├── DrawingScreen.tsx        # NEW — isolated canvas + timer
│   ├── SpectatorScreen.tsx      # NEW — picker's canvas switcher
│   ├── RevealScreen.tsx         # NEW — scores + drawings reveal
│   ├── FinalLeaderboard.tsx     # NEW — end-of-game leaderboard
│   └── GameCanvas.tsx           # NEW — reusable isolated canvas
├── App.tsx                      # MODIFIED — add game route
└── store.ts                     # UNCHANGED
```

## Socket Events (Game-Specific)

| Event | Direction | Payload |
|-------|-----------|---------|
| `create-game-room` | Client → Server | `{ settings, nickname, avatar }` |
| `join-game-room` | Client → Server | `{ roomCode, nickname, avatar }` |
| `game-lobby-state` | Server → Client | `{ players[], settings, hostId, roomCode }` |
| `start-game` | Client → Server | `{ roomCode }` |
| `game-started` | Server → Client | `{ totalRounds, turnsPerRound }` |
| `turn-started` | Server → Client | `{ round, turn, pickerId, role, words? }` |
| `word-picked` | Client → Server | `{ roomCode, word }` |
| `picker-selecting` | Server → Client | `{ pickerId, pickerName }` |
| `drawing-countdown` | Server → Client | `{ count: 3/2/1 }` |
| `timer-tick` | Server → Client | `{ remaining: number }` |
| `drawing-ended` | Server → Client | `{}` |
| `game-stroke-live` | Client → Server | `{ roomCode, strokeData }` |
| `spectator-stroke` | Server → Client | `{ fromUser, strokeData }` |
| `canvas-snapshot` | Client → Server | `{ roomCode, pngBase64 }` |
| `turn-scores` | Server → Client | `{ scores[], drawings[] }` |
| `next-turn-countdown` | Server → Client | `{ remaining: number }` |
| `game-ended` | Server → Client | `{ finalScores[], winner }` |
| `player-left-game` | Server → Client | `{ playerId }` |

## Scoring Rules

- Points per turn = Gemini score (0–100)
- Picker gets 0 points for their turn
- Cumulative across all rounds
- Stored in server memory (ephemeral, no DB)
