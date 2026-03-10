# Drawwww

A modern, real-time collaborative drawing application built with React, Fabric.js, and Socket.io.

## 🚀 Features

- **Real-time Collaboration**: Instantly see what others are drawing.
- **Advanced Tools**:
    - **Pencil Variants**: Sketch, Marker (Highlighter), Spray, and Neon (Glow).
    - **Object Eraser**: Click objects to remove them from the canvas.
    - **Extended Shapes**: Rectangle, Circle, Triangle, Diamond, Star, Hexagon, Arrow.
    - **Text Tool**: Add text annotations.
    - **Undo/Redo**: Full command history for your drawing actions.
- **Smart UI**:
    - Nested sub-menus for tool variants.
    - Configuration-driven architecture.
    - Toast notifications and connection status indicators.
    - Responsive and clean interface.
- **Room System**: Create or join private rooms for collaboration.
- **Persistent Rooms**: Canvas state is saved to the database and survives server restarts.

## 🛠️ Setup & Installation

### Option 1: Docker (Recommended)

```bash
# Clone the repo and start all services
docker compose up --build

# App available at:
#   Frontend → http://localhost
#   Backend API → http://localhost:3000
#   MongoDB → localhost:27017
```

To configure Google OAuth and session secrets, create a `.env` file in the project root:

```env
COOKIE_KEY=your_strong_secret_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

To stop:
```bash
docker compose down          # Stop containers
docker compose down -v       # Stop + delete MongoDB data
```

---

### Option 2: Manual Setup

#### Prerequisites
- Node.js (v18+ recommended)
- npm
- MongoDB (local or Atlas)

#### 1. Backend Setup

```bash
cd Backend
cp .env.example .env   # Edit .env with your credentials
npm install
npm run dev
# Server starts on http://localhost:3000
```

#### 2. Frontend Setup

```bash
cd Frontend
npm install
npm run dev
# App starts on http://localhost:5173
```

## 🎮 How to Use

1.  Open the application in your browser.
2.  **Sign Up** with your email and password, or **Sign In** with Google.
3.  **Create or Join a Room** from the lobby.
4.  **Start Drawing!**
    - Click **Pencil** to choose between Sketch, Marker, Spray, or Neon.
    - Click **Shapes** to drag-and-drop geometric forms.
    - Use the **Eraser** to click and remove objects.
    - Use **Undo/Redo** buttons or `Ctrl+Z` / `Ctrl+Y`.
5.  Share the Room ID with a friend to collaborate in real-time.

## 🏗️ Project Structure

```
├── docker-compose.yml          # Full stack orchestration
├── Backend/
│   ├── Dockerfile
│   ├── index.ts                # Express entry point
│   ├── config/passport.ts      # Passport.js / Google OAuth
│   ├── routes/auth.ts          # Auth routes (register, login)
│   ├── socket/handlers.ts      # Socket.io real-time handlers
│   └── models/
│       ├── User.ts             # User model
│       └── Room.ts             # Room persistence model
└── Frontend/
    ├── Dockerfile
    ├── nginx.conf              # Production nginx config
    └── src/
        ├── App.tsx             # Main app (auth, lobby, studio)
        ├── store.ts            # Zustand global state
        ├── constants.ts        # Tool configuration
        └── components/
            ├── Whiteboard.tsx  # Canvas + drawing + socket sync
            ├── Toolbar.tsx     # Tool selection + undo/redo
            └── Toast.tsx       # Toast notifications
```

## 🔧 Configuration

### Environment Variables

**Backend** (see `Backend/.env.example`):
- `MONGO_URI` — MongoDB connection string
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth credentials
- `COOKIE_KEY` — Session secret
- `PORT` — Server port (default: 3000)
- `CLIENT_URL` — Frontend URL for CORS (default: http://localhost:5173)

**Frontend** (see `Frontend/.env.example`):
- `VITE_API_URL` — Backend API URL (default: http://localhost:3000)

Customize tools, colors, and default settings in `Frontend/src/constants.ts`.