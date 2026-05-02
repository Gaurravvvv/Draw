# Drawwww: Optimization & Feature Roadmap

This document outlines suggestions for optimizing the current components, improving existing features, and adding exciting new functionality to elevate the Drawwww project.

## 1. Component & Performance Optimizations

### Canvas Rendering Efficiency
*   **Layer Grouping:** Currently, every stroke and shape is an independent `fabric.Object`. As the canvas gets crowded, rendering slows down. Implement an optimization where strokes are periodically flattened (rasterized) into a single background image layer if they haven't been modified recently.
*   **Virtualization / Culling:** Only render elements that are within the current viewport (if infinite canvas/panning is implemented).

### Network & Socket Optimization
*   **Debounce/Throttle Socket Emissions:** Freehand drawing emits a `move` event on every single mouse movement, which can overwhelm the network. Throttle coordinate emissions (e.g., to 20-30 times per second) and use Catmull-Rom splines or linear interpolation on the receiving end to keep the drawing smooth.
*   **Binary Serialization:** Instead of sending bulky JSON objects for strokes, use a binary format (like Protocol Buffers or custom binary packing) over WebSockets to reduce payload size.

### Component Architecture
*   **State Management (Zustand):** Ensure that components only subscribe to the specific slices of Zustand state they need. If the whole `<Whiteboard />` subscribes to the entire store, it might re-render unnecessarily. Use selectors: `const activeTool = useStore((state) => state.activeTool)`.

---

## 2. Enhancing Existing Features

### Advanced Brush Mechanics
*   **Eraser Improvements:** Right now, the eraser likely deletes the entire SVG object on click. Implement a true "pixel-level" or "path-splitting" eraser using global composite operations (`destination-out`), allowing users to erase *parts* of a stroke just like a real whiteboard.
*   **Layer Support:** Add a UI to manage layers (Add, Hide, Lock, Reorder). This is a staple for any serious drawing app.

### Better Shapes & Text
*   **Live Text Editing:** Improve text input by supporting rich text, font size scaling, font families, and bold/italic toggles directly on the canvas.
*   **Shape Snapping & Alignment:** Hold `Shift` to draw perfect circles or straight lines. Add smart guides that appear when a shape aligns with another shape.

---

## 3. Exciting New Add-ons (The Fun Stuff!)

### Saving & Exporting
*   **Save to PNG/SVG/PDF:** Allow users to export the canvas. Fabric.js makes this easy with `canvas.toDataURL()` and `canvas.toSVG()`. 
*   **Gallery / Project Dashboard:** Since you have MongoDB, allow authenticated users to save their whiteboards to their account. They can access a "My Boards" dashboard to resume drawing later.
*   **Infinite Canvas:** Instead of a fixed bounding box, implement panning (Spacebar + Drag) and zooming (Ctrl + Scroll) so users never run out of drawing space.

### Skribbl.io Mode (Gamification)
Since your WebSocket infrastructure is already solid, turning this into a game is highly feasible!
*   **Lobby System:** Users join a room with a lobby interface. The host clicks "Start Game."
*   **Round Manager:** A backend timer selects a random word, assigns one user as the "Drawer," and locks the drawing tools for everyone else.
*   **Live Chat & Guessing:** Add a sidebar chat component. The backend intercepts messages. If a user types the exact word, they get points, and their message is hidden from others who haven't guessed it yet.
*   **Scoreboard:** Keep track of points across rounds and declare a winner at the end.

### Collaborative Tools
*   **Live Cursors:** Broadcast the mouse coordinates of all users in the room and display them as little custom cursors with their names attached (like Figma).
*   **Laser Pointer Tool:** A temporary neon brush that fades away automatically after 2 seconds—perfect for pointing things out during a remote meeting.
*   **Sticky Notes:** Allow users to drop post-it notes onto the board, edit the text, and drag them around.

## Recommended Next Steps

If you want to start building some of these, here is a suggested order of implementation:
1.  **Quick Wins:** Implement Image Export (`toDataURL`) and `Shift`-key snapping for shapes.
2.  **Visual Polish:** Implement Live Cursors to make collaboration feel truly "alive."
3.  **Big Feature:** Implement the "Save to Dashboard" feature using your existing MongoDB/Passport setup.
4.  **Major Pivot:** If you want to go the Skribbl.io route, create a new `GameRoom` component and start building the chat/guessing logic.
