# Drawwww

A modern, ultra-low latency collaborative drawing application built with React, Socket.io, and a custom **High-Performance HTML5 Raster Engine**.

## 🚀 Features

- **Real-time Collaboration**: Instantly see what others are drawing via optimized command-log syncing.
- **Advanced 3-Layer Raster Engine**: 
    - Replaced traditional heavy vector libraries with a custom raw Canvas 2D engine for iPad-like drawing performance.
    - Features `perfect-freehand` for silky smooth, pressure-simulated strokes.
- **Advanced Tools**:
    - **Pencil Variants**: Sketch, Marker, Spray, and **Highlighter** (using `multiply` compositing).
    - **True Pixel Eraser**: A destructive `destination-out` eraser that perfectly cuts through raster pixels in real-time.
    - **Fluid Shapes**: Rectangle, Circle, Triangle, Diamond, Star, Hexagon, Arrow (baked instantly to raster).
- **Hybrid Object Overlay (Text)**: 
    - Instagram-style floating text annotations! Text floats in a DOM layer above the canvas.
    - Drag to move, type to auto-resize, and pull the handle to scale natively without interfering with raster artwork.
- **Smart Viewport**:
    - A fixed 1920x1080 canvas that automatically scales to perfectly fit any device screen without pixel distortion or scrollbars.
- **Persistent Rooms**: Canvas state (both raster commands and floating objects) is saved to MongoDB and survives server restarts.

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
    - Click **Pencil** to choose between Sketch, Marker, Highlighter, or Spray.
    - Click **Shapes** to drag-and-drop geometric forms (these bake immediately into the canvas).
    - Click **Text** to drop an Instagram-style text box. Click and drag the text to move it, or drag the bottom-right corner dot to scale it up.
    - Use the **Eraser** to slice through raster ink (Note: The eraser does not affect floating Text).
    - Use **Undo/Redo** buttons or `Ctrl+Z` / `Ctrl+Y`.
5.  Share the Room ID with a friend to collaborate in real-time.

## 🏗️ Project Structure

```
├── docker-compose.yml          # Full stack orchestration
├── Backend/
│   ├── index.ts                # Express entry point
│   ├── routes/auth.ts          # Auth routes (register, login)
│   ├── socket/handlers.ts      # Socket.io real-time handlers
│   └── models/
│       ├── User.ts             # User model
│       └── Room.ts             # Room persistence model (stores commands + texts)
└── Frontend/
    └── src/
        ├── App.tsx             # Main app
        ├── store.ts            # Zustand global state
        ├── engine/             # Custom HTML5 Canvas Engine
        │   ├── RasterBrush.ts  # Brush physics & compositing logic
        │   └── RasterShapes.ts # Geometry rendering
        └── components/
            ├── RasterWhiteboard.tsx # 3-Layer Canvas system
            ├── DraggableText.tsx    # Hybrid DOM Object Layer
            └── Toolbar.tsx          # UI Controls
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