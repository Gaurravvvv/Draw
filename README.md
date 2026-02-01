# Drawwww

A modern, real-time collaborative drawing application built with React, Fabric.js, and Socket.io.

## 🚀 Features

- **Real-time Collaboration**: Instantly see what others are drawing.
- **Advanced Tools**:
    - **Pencil Variants**: Sketch, Marker (Highlighter), Spray, and Neon (Glow).
    - **True Pixel Eraser**: "Correction Tape" style masking.
    - **Extended Shapes**: Rectangle, Circle, Triangle, Diamond, Star, Hexagon, Arrow.
    - **Text Tool**: Add text annotations.
- **Smart UI**:
    - Nested sub-menus for tool variants.
    - Configuration-driven architecture.
    - Responsive and clean interface.
- **Room System**: Create or join private rooms for collaboration.

## 🛠️ Setup & Installation

### Prerequisites
- Node.js (v18+ recommended)
- npm

### 1. Backend Setup
The backend handles real-time socket connections and state management.

```bash
cd Backend
npm install
npm run dev
# Server starts on http://localhost:3001
```

### 2. Frontend Setup
The frontend is a Vite + React application.

```bash
cd Frontend
npm install
npm run dev
# App starts on http://localhost:5173
```

## 🎮 How to Use

1.  Open the application in your browser.
2.  **Login** with `admin` / `admin`.
3.  **Create or Join a Room** from the lobby.
4.  **Start Drawing!**
    - Click **Pencil** to choose between Sketch, Marker, Spray, or Neon.
    - Click **Shapes** to drag-and-drop geometric forms.
    - Use the **Eraser** to mask mistakes.
5.  Share the Room ID with a friend to collaborate in real-time.

## 🏗️ Project Structure

- **Backend/**: Node.js/Express server with Socket.io for event broadcasting and state management.
- **Frontend/**: React application using Fabric.js for the canvas and drawing logic.
    - `src/constants.ts`: Central configuration for tools and UI.
    - `src/components/Whiteboard.tsx`: Core canvas logic and socket handlers.
    - `src/components/Toolbar.tsx`: Dynamic toolbar component.

## 🔧 Configuration

You can customize tools, colors, and default settings by editing:
`Frontend/src/constants.ts`