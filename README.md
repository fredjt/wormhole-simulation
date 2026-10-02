# Thin-Shell Wormhole Dynamics Simulation

A real-time interactive simulation of thin-shell wormhole dynamics using the Israel junction formalism, featuring Kerr metric physics, equation-of-state calibration, and 3D visualization.

## Features

- **Kerr Metric Physics**: Generalized lapse function supporting arbitrary mass (M), spin (β), and charge (μ) parameters
- **Effective Potential Model**: Well model with proper boundary conditions for throat stability analysis
- **EOS Calibration**: Automatic calibration at initial radius a₀ across multiple equation-of-state models:
  - Barotropic
  - Phantom
  - Chaplygin gas
  - Cosmic Chaplygin
  - Modified Cosmic Chaplygin
- **RK4 Integration**: Adaptive sub-stepping for accurate numerical evolution
- **3D Visualization**: Three.js render of the wormhole shell with color-coded stability states
- **Real-time Analysis**: Potential curves, time-series plots, phase space trajectories, and energy condition monitoring

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Open http://localhost:3000 in your browser.

## Project Structure

```
wormhole-simulation/
├── index.html              # Entry point
├── package.json            # Dependencies & scripts
├── vite.config.js          # Build configuration
├── .gitignore
│
├── css/
│   └── style.css           # All styles
│
└── src/
    ├── main.js             # App initialization, event listeners, animation loop
    │
    ├── physics/            # Core physics calculations
    │   ├── lapse.js        # Kerr lapse function & derivative
    │   ├── horizons.js     # Horizon crossing detection (root-finding)
    │   ├── sigma.js        # Surface gravity & tangential pressure
    │   ├── eos.js          # Equation of state: computeSigmaFromEOS
    │   └── potential.js    # Effective potential + EOS calibration routines
    │
    ├── simulation/         # Simulation engine
    │   ├── integrator.js   # RK4 integration + derivative helper
    │   └── state.js        # State initialization & reset
    │
    ├── visualization/      # Rendering
    │   ├── threejs.js      # Three.js scene setup, camera, animation loop
    │   ├── canvas.js       # Canvas graph drawing (potential, time series, phase space)
    │   └── rendering.js    # Energy conditions display + status updates
    │
    └── ui/                 # User interaction
        └── calibration.js  # Parameter reading, UI updates, calibration logic
```

## Controls

| Control | Description |
|---------|-------------|
| **M** (Mass) | Black hole mass parameter |
| **β** (Spin) | Spin parameter (dimensionless) |
| **μ** (Charge) | Charge parameter |
| **a₀** (Radius) | Initial throat radius |
| **δa** (Perturbation) | Small perturbation amplitude |
| **v₀** (Velocity) | Initial radial velocity |
| **Speed** | Simulation speed multiplier |
| **EOS Model** | Equation of state selection |

## Physics Background

This simulation models a thin-shell wormhole connecting two spacetime regions via the Israel junction conditions. The dynamics are governed by an effective potential equation derived from the junction formalism, with the throat radius `a(τ)` evolving according to:

```
V(a) = lapse_function(a) - 4π²a²σ(a)²
```

where σ is the surface energy density computed from the chosen equation of state.

### Stability Analysis

- **Stable**: Shell oscillates around equilibrium (green indicator)
- **Unstable**: Shell collapses or expands without bound (red indicator)
- **Energy Conditions**: Monitors null, weak, strong, and dominant energy conditions in real-time

## Building for Production

See [BUILDING.md](./BUILDING.md) for detailed build instructions.

## License

MIT
