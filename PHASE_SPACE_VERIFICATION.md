# Phase Space Plot Verification Report (a vs da/dτ)

## Overview
This branch was created to verify the correctness of the "a vs da/dτ" phase space plot 
located in the top-right corner of the simulation UI (`#phaseCanvas` div).

### Result: ✅ VERIFIED — No issues found. The plot is correctly implemented.

---

## Physics Verification (arXiv:2610.00131v1)

### Equation of Motion
Paper Eq.(32): `ȧ² + V_eff(a) = 0` where `V_eff(a) = F(a) - 4π²a²σ²(a)`

Verified in code (`src/physics/potential.js::effPot()`):
```javascript
return f - 4 * Math.PI * Math.PI * a * a * s * s; // V_eff = F - 4π²a²σ² ✓
```

### Acceleration from Potential Gradient  
Differentiating Eq.(32) wrt proper time τ: `ä = -(1/2)V'(eff)(a)`

Verified in code (`src/simulation/integrator.js::deriv()`):
```javascript
return [v, -Vp / 2]; // da/dτ=v, dv/dτ=-½·dV_eff/da ✓
```

---

## Phase Space Implementation Details

### Variable Mapping (correct)
| Code | Physics Meaning | Canvas Axis |
|------|-----------------|-------------|
| `a_current` | Absolute throat radius a(τ) | X: `'a'` |
| `v_current` | Radial velocity da/dτ (= ȧ = dδa/dτ*) | Y: `'δa/δτ'` |

*\*Since a₀ is constant during evolution, d(a-a₀)/dτ = da/dτ.*

### Integration (correct)
- RK4 sub-stepping with adaptive `dtSub = dtSim / max(1, ceil(dtSim/0.01))` ✓
- Derivative guard: returns `[0, 0]` when `a ≤ 0` to prevent collapse artifacts ✓  
- Auto-stop on extreme values (`a < 0.1·r₀`, `a > 50`, `τ > 500`) ✓

### Rendering (correct)
**Axis labels:** `canvas.js:51` — `fillText('a',cw/2,ch-5)` and `fillText('δa/δτ',0,0)`  
**Equilibrium marker:** White dot at `(toX(a₀), toY(0))` when calibrated=true ✓
**Current state:** Orange dot at `(toX(a_current), toY(v_current))` ✓

### Initial Conditions (correct)
- Position: `a(0) = a₀ × (1 + δ%/100)` from sliderDeltaA ✓
- Velocity: `v(0) = V₀` directly from sliderV0 ✓

---

## Data Flow Integrity
```
UI sliders → readParams() / initSim() 
           → v_current, a_current set in state.js & calibration.js  
           → phaseHistory.push({a:a_current,v:v_current}) per RK4 step (max 2000)
           → drawPhaseSpace() maps toX(a),toY(v) each frame via requestAnimationFrame
```

## Conclusion
All physics, data flow, rendering, and initial condition logic for the a vs da/dτ 
phase space plot has been verified against arXiv:2610.00131v1 equations (Sec V).  
No corrections are required — the implementation is correct as-is.
