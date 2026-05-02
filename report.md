# Project Report: Drawwww

## 1. Introduction

**Drawwww** is a modern, ultra-low latency collaborative drawing application. It enables users to draw, sketch, and annotate together in real time on a shared digital canvas. The project emphasizes high-performance graphics, a smart user interface, and robust functionality, including pressure-simulated pencil styles, fluid geometric shapes, Instagram-style floating text annotations, and a persistent room system that saves canvases automatically.

## 2. Architecture Overview

The application follows a **Client-Server Architecture** augmented with **WebSockets** for real-time data synchronization.

- **Frontend (Client)**: A Single Page Application (SPA) built with React. It handles the UI, manages an advanced **3-Layer Custom HTML5 Raster Engine**, and communicates real-time drawing events.
- **Backend (Server)**: A Node.js/Express service that provides RESTful endpoints for authentication (OAuth/Local) and manages real-time Socket.io connections. It synchronizes a compact "command log" of drawing strokes rather than sending heavy image data.
- **Database**: A MongoDB instance used to persist user data, session information, and the state of each drawing room (both raster commands and floating DOM objects) so that canvases survive server restarts and browser reloads.
- **Infrastructure**: Containerized using Docker, orchestrated via Docker Compose. The frontend is served using an Nginx reverse proxy.

## 3. Tech Stack

### Frontend
- **Framework**: React 19 (with TypeScript)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand
- **Graphics Engine**: Custom HTML5 Canvas 2D Engine (3-Layer Architecture)
- **Stroke Physics**: perfect-freehand (for pressure simulation and smoothing)
- **Real-time Communication**: Socket.io-client
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js (v5.x)
- **Language**: TypeScript
- **Real-time Engine**: Socket.io
- **Database & ORM**: MongoDB with Mongoose
- **Authentication**: Passport.js (Google OAuth 2.0 & Local Auth with bcryptjs)
- **Session Management**: express-session with connect-mongo

### Deployment & Infrastructure
- **Containerization**: Docker, Docker Compose
- **Web Server**: Nginx (Frontend static file serving and routing)

## 4. Key Components

### 4.1 Frontend Components

- **`RasterWhiteboard.tsx`**: The core component of the application. It implements a sophisticated 3-layer system: a CSS-driven Grid Layer (Layer 0), a Persistent Baked Canvas (Layer 1), a Transient Live-Preview Canvas (Layer 2), and a Hybrid DOM Object Overlay (Layer 4) for text. It translates user pointer events into optimized drawing commands and acts as the primary interface for Socket.io.
- **`DraggableText.tsx`**: Manages the "Instagram-style" floating text. Texts exist outside the raster pixel buffer as absolute-positioned React DOM elements, allowing users to effortlessly drag, edit, and dynamically scale text annotations without erasing background ink.
- **`engine/RasterBrush.ts`**: The physics and rendering core. It utilizes `perfect-freehand` to translate pointer points into beautiful SVG-like raster paths. It handles advanced composite operations, including `multiply` for Highlighters and `destination-out` for the true pixel-deleting eraser.
- **`Toolbar.tsx`**: The user interface for selecting drawing tools. It supports nested sub-menus for tool variants (e.g., Pencil, Marker, Highlighter, Spray, Neon) and shape selections.
- **`store.ts`**: The Zustand global state store. It manages application-wide states such as the current selected tool, active texts, room context, and user authentication status.

### 4.2 Backend Components

- **`index.ts`**: The main entry point for the Express server. It configures middleware, sets up the Socket.io server, connects to MongoDB, and registers routes.
- **`socket/handlers.ts`**: The core real-time logic. It listens to events like `join-room`, `draw-event`, `text-event`, and `stroke-live`. It broadcasts these events to other users in the same room with near-zero latency, and continuously backs up the room's command history to MongoDB via debounced save operations.
- **`routes/auth.ts`**: Handles authentication workflows, including user registration, login, logout, and fetching the current authenticated user's profile.

### 4.3 Database Models (`models/`)

- **`User.ts`**: Defines the user schema, storing authentication details (Google ID, email, hashed passwords) and user metadata.
- **`Room.ts`**: Defines the room schema. It stores the unique Room ID and the serialized JSON state of the canvas—split into an `objects` array (the raster command log) and a `texts` array (floating text objects). This ensures that users joining a room later receive the exact current drawing state.

## 5. Features and Capabilities

1. **Real-Time Collaboration**: Using Socket.io, active strokes (`stroke-live`) and finished objects (`draw-event`) are broadcasted instantly to all connected clients in a room.
2. **High-Performance Custom Raster Engine**:
   - Built directly on the native HTML5 Canvas API, stripping away heavy vector libraries like Fabric.js to achieve pure 60fps drawing performance.
   - A clever Smart Viewport system wraps a fixed 1920x1080 canvas in CSS transforms, ensuring the drawing area flawlessly scales to fit any laptop or monitor without distortion.
3. **Advanced Drawing Tools**:
   - **Pressure-Sensitive Brushes**: Smooth, dynamic strokes using `perfect-freehand` with variants like Sketch, Marker, Spray, and Neon.
   - **Highlighter Engine**: Employs `multiply` global composite operations, allowing translucent marker strokes to stack and organically darken underlying artwork without obscuring it.
   - **Fluid Geometric Shapes**: Intuitive MS Paint-style shape drawing (Rectangle, Ellipse, Triangle, Diamond, Star, Hexagon, Arrow) that instantly bakes into the raster canvas.
4. **True Eraser Engine**: The eraser acts as a true destructive mask. It uses `destination-out` compositing to permanently slice through and remove painted pixels, exactly like an eraser in Photoshop or an iPad drawing app.
5. **Hybrid Object Overlay (Text)**: Solves the inherent limitation of pure raster canvases by introducing a separate React DOM layer for text. Text boxes behave like Instagram Stories: transparent, borderless, click-to-edit, drag-to-move, and diagonally scalable via a custom UI handle.
6. **Undo/Redo System**: A highly efficient memory stack that utilizes WebP Blob snapshots of the canvas, ensuring that users can undo or redo massive amounts of strokes with minimal RAM overhead.
7. **Persistent Rooms**: Collaborative sessions are automatically and continually backed up to MongoDB, allowing rooms to persist indefinitely.

## 6. Conclusion

Drawwww is a feature-rich, scalable real-time drawing tool. By developing a deeply optimized custom Raster Engine paired with a modern React interface, it achieves iPad-level drawing fluidity and true pixel manipulation in the browser. The Node.js/Socket.io backend ensures a seamless, persistent collaborative experience, while the containerized architecture guarantees it is easily deployable across any modern infrastructure.
