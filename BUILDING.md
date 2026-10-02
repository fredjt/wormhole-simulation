# Building the Wormhole Simulation

This project uses [Vite](https://vitejs.dev/) for fast development and production builds.

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+ (comes with Node.js)

## Setup

```bash
# Clone the repository
git clone https://github.com/fredjt/wormhole-simulation.git
cd wormhole-simulation

# Install dependencies
npm install
```

This installs:
- **vite** — Next-generation frontend build tool
- **three** — 3D graphics library (loaded via CDN in production)

## Development

### Start Dev Server

```bash
npm run dev
```

- Serves at `http://localhost:3000`
- Hot Module Replacement (HMR) updates the page instantly as you edit files
- Source maps enabled for debugging
- CSS is processed and bundled automatically

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |

## Production Build

```bash
npm run build
```

Output goes to `dist/`:
```
dist/
├── index.html
├── assets/
│   ├── index-<hash>.js      # Bundled JavaScript
│   └── index-<hash>.css     # Bundled CSS
└── ...
```

### Build Configuration (`vite.config.js`)

```javascript
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',           // Output directory
    sourcemap: true,          // Generate source maps
    rollupOptions: {
      input: './index.html'   // HTML entry point
    }
  },
  server: {
    port: 3000,               // Dev server port
    open: false               // Don't auto-open browser
  }
})
```

## Deployment Options

### Option 1: Static Hosting (Recommended)

The `dist/` directory is a self-contained static site. Deploy to any hosting provider:

- **GitHub Pages**: Push `dist/` to a `gh-pages` branch or use GitHub Actions
- **Netlify**: Connect repo, build command `npm run build`, publish dir `dist`
- **Vercel**: Auto-detects Vite, builds and deploys automatically
- **Cloudflare Pages**: Similar to Netlify

### Option 2: Node.js Server

```bash
# Install express for serving
npm install express

# Create server.js
const express = require('express');
const app = express();
app.use(express.static('dist'));
app.listen(3000);
```

### Option 3: Docker

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Development Workflow

1. **Edit source files** in `src/` — changes appear instantly via HMR
2. **Test locally** with `npm run dev`
3. **Build for production** with `npm run build`
4. **Preview** the production build with `npm run preview`
5. **Deploy** the `dist/` folder

## Troubleshooting

### Port 3000 already in use
```bash
# Kill existing process
lsof -ti:3000 | xargs kill

# Or change port in vite.config.js
server: { port: 3001 }
```

### Three.js not loading
- Ensure internet connection (Three.js loads from CDN)
- Check browser console for CORS errors
- Verify `three.min.js` URL in `index.html`

### Build fails
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Module Architecture

The codebase is organized into logical modules that can be independently imported:

| Module | Responsibility |
|--------|---------------|
| `physics/lapse.js` | Kerr metric lapse function calculations |
| `physics/horizons.js` | Horizon radius root-finding |
| `physics/sigma.js` | Surface gravity & pressure computations |
| `physics/eos.js` | Equation of state density calculations |
| `physics/potential.js` | Effective potential well + calibration |
| `simulation/integrator.js` | RK4 numerical integration |
| `simulation/state.js` | Simulation state management |
| `visualization/threejs.js` | 3D scene rendering |
| `visualization/canvas.js` | 2D graph rendering |
| `visualization/rendering.js` | Status & energy condition display |
| `ui/calibration.js` | UI parameter handling |

Each module exports its functions via ES module syntax:
```javascript
// Export at end of each file
export { function1, function2 };
```

The entry point (`src/main.js`) imports all modules and exposes them as globals for cross-module communication.
