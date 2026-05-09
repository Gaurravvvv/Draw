# Web Service Deployment Plan: Drawwww

This document outlines a comprehensive, production-ready strategy to host the Drawwww application on the public web. Since Drawwww relies heavily on real-time WebSockets, specific attention is given to connection stability and scaling.

---

## 1. Architecture Strategy

The application is split into two independent tiers:
1. **Frontend (Static SPA)**: React / Vite application. Best hosted on an edge CDN for lightning-fast asset delivery.
2. **Backend (Node.js + Socket.io)**: Long-lived WebSocket server. Needs a compute environment that supports persistent connections and port mapping.

---

## 2. Infrastructure Options

### Option A: Fully Managed PaaS (Easiest / Recommended)
- **Frontend**: Vercel or Netlify
- **Backend**: Render (Web Service) or Railway

### Option B: Self-Hosted VPS (Most Control & Cost-Effective for WebSockets)
- **Host**: DigitalOcean Droplet, AWS EC2, or Hetzner
- **Stack**: Docker Compose + Nginx (Reverse Proxy) + Certbot (SSL)

---

## 3. Step-by-Step Deployment (Option A - PaaS)

### Phase 1: Prepare the Frontend for Vercel/Netlify
1. **Environment Variables**:
   Update your Vite build configuration. Ensure that your API URL is read from an environment variable.
   Create a `.env.production` file (or set these in the Vercel dashboard):
   ```env
   VITE_API_URL=https://api.drawwww.yourdomain.com
   ```
2. **Build Configuration**:
   Ensure `package.json` has `"build": "tsc -b && vite build"`.
3. **Deploy**:
   Connect your GitHub repository to Vercel. Select the `Frontend/` folder as the root directory. Vercel will automatically build and deploy it globally.

### Phase 2: Prepare the Backend for Render/Railway
1. **Environment Variables**:
   In your Render/Railway dashboard, set:
   ```env
   NODE_ENV=production
   PORT=3000
   CLIENT_URL=https://drawwww.yourdomain.com  # Required for strict CORS
   ```
2. **Start Command**:
   Ensure your backend `package.json` has a production start script:
   ```json
   "scripts": {
     "build": "tsc",
     "start": "node dist/index.js"
   }
   ```
3. **Deploy**:
   Connect your GitHub repository to Render/Railway. Select the `Backend/` folder as the root directory. Set the Build Command to `npm install && npm run build` and the Start Command to `npm start`.

---

## 4. Step-by-Step Deployment (Option B - Docker on VPS)

If you prefer to deploy everything to a single DigitalOcean Droplet using the existing `docker-compose.yml`.

### Phase 1: Server Setup
1. Spin up an Ubuntu 24.04 LTS server.
2. Install Docker and Docker Compose.
3. Map your DNS A-Records:
   - `drawwww.com` -> `[Server IP]`

### Phase 2: Nginx Reverse Proxy & SSL
1. Install Nginx and Certbot:
   ```bash
   sudo apt install nginx python3-certbot-nginx
   ```
2. Configure Nginx to route traffic to the Frontend container and proxy WebSocket connections to the Backend container:
   ```nginx
   server {
       server_name drawwww.com;

       # Route to Frontend Container
       location / {
           proxy_pass http://localhost:80;
       }

       # Route to Backend Container (Socket.io)
       location /socket.io/ {
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header Host $host;
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
       }
   }
   ```
3. Run `sudo certbot --nginx` to secure the domain with HTTPS. Secure WebSockets (`wss://`) require HTTPS to function.

---

## 5. Scaling Strategy (Phase 3)

As user traffic grows, a single Node.js instance will eventually cap out (usually around ~5,000 concurrent socket connections due to memory/CPU limits).

To scale horizontally across multiple backend servers:
1. **Redis Adapter**: Install `@socket.io/redis-adapter` and `redis`.
2. **Implement**: 
   ```typescript
   import { createAdapter } from '@socket.io/redis-adapter';
   import { createClient } from 'redis';
   
   const pubClient = createClient({ url: 'redis://your-redis-url:6379' });
   const subClient = pubClient.duplicate();
   io.adapter(createAdapter(pubClient, subClient));
   ```
3. **Sticky Sessions**: Configure your Load Balancer (AWS ALB, Nginx, or Render) to use "Sticky Sessions" (Session Affinity). Socket.io requires the HTTP long-polling handshake to hit the exact same server before upgrading to a WebSocket.

---

## 6. Pre-Flight Checklist

- [ ] Ensure all API calls in `Frontend` use `import.meta.env.VITE_API_URL`.
- [ ] Ensure `Backend` CORS policy explicitly allows the production frontend domain.
- [ ] Add rate-limiting to the backend to prevent API spam (using `express-rate-limit`).
- [ ] Secure Socket.io by validating room ID strings to prevent memory exhaustion from invalid large string allocations.
- [ ] Push all final code to the `main` branch.
