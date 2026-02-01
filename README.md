# Lets Draw

Real-time collaborative drawing application.

## Setup

1.  **Install Dependencies**:
    ```bash
    cd client && npm install
    cd ../server && npm install
    ```

2.  **Start Server**:
    ```bash
    cd server
    npm run dev
    # Runs on http://localhost:3001
    ```

3.  **Start Client**:
    ```bash
    cd client
    npm run dev
    # Runs on http://localhost:5173
    ```

## Features

- **Login**: `admin` / `admin`
- **Lobby**: Create or Join Rooms.
- **Studio**: 
    - Real-time drawing sync.
    - Configuration-driven toolbar.
    - Shapes (Rectangle, Circle) and Freehand (Pencil).
    - Eraser (Object remover).
    - Responsive Design.

## Configuration

Edit `client/src/config/constants.ts` to change tools, colors, and brush settings.
