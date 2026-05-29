# Probability Density Manifold Explorer

A vaporwave-styled interactive 3D probability density function visualizer built with React and Three.js.

![Manifold Explorer](https://img.shields.io/badge/aesthetic-vaporwave-ff00ff) ![React](https://img.shields.io/badge/React-18+-00ffff) ![Three.js](https://img.shields.io/badge/Three.js-r128-ff00ff)

## ✨ Features

### 📊 Distribution Library
- **Normal (Gaussian)** — Classic bell curve with adjustable σ
- **Bivariate Gaussian** — Independent σx, σy, and correlation ρ
- **Hydrogen 1s Orbital** — |ψ|² with adjustable Bohr radius
- **Hydrogen 2p Orbital** — Angular-dependent dumbbell shape
- **Maxwell-Boltzmann (Velocity)** — 3D velocity distribution in phase space
- **Maxwell-Boltzmann (Speed)** — 1D speed distribution with v² Jacobian factor
- **Higgs Potential** — Mexican hat potential with symmetry breaking
- **Higgs Potential (Direct V)** — Direct potential visualization
- **Prior Updater** — Fun distribution with "Rationality" and "Vibes" parameters
- **Uniform (Box)** — Rectangular distribution
- **Laplacian** — Exponential decay distribution

### 🎮 Interactive Controls
- **3D View** — Drag to rotate, auto-rotate toggle
- **3D Slice Mode** — Cut through the manifold at adjustable Y position
- **2D Graph Mode** — Full-featured 2D slice analysis with:
  - Adjustable axis ranges
  - Custom axis labels
  - Auto-scale toggle
  - Grid overlay
  - Live parameter controls
- **Probability Sampler** — Real-time P(x,y) readout at any point

### ⊛ Convolver Lab
Convolve any two distributions together:
- Side-by-side distribution selection with parameter controls
- Live 2D slice previews of each distribution at y=0
- Adjustable convolution grid resolution (32-128)
- Result preview before applying
- Save/load configuration presets as JSON

### 🔬 Higgs Potential Features
- Temperature-dependent phase transitions
- Cubic coupling (η) for explicit symmetry breaking
- Real-time VEV (vacuum expectation value) calculation
- Critical temperature display
- Phase indicator (symmetric/broken)

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/probability-density-explorer.git
cd probability-density-explorer

# Install dependencies
npm install

# Start development server
npm start
```

### Dependencies
```json
{
  "react": "^18.0.0",
  "react-dom": "^18.0.0",
  "three": "^0.128.0"
}
```

## 🎨 Aesthetic

This project uses a **synthwave/vaporwave** aesthetic inspired by 80s retro-futurism:

- Deep purple-black void backgrounds
- Neon magenta (#ff00ff) and cyan (#00ffff) accent colors
- Glowing wireframe grids
- CRT scanline overlay effect
- Monospace typography
- Gradient color mapping on 3D surfaces

See `STYLE_GUIDE.md` for detailed design specifications.

## 📁 Project Structure

```
├── pdf-visualizer.jsx    # Main React component
├── README.md             # This file
├── STYLE_GUIDE.md        # Design system documentation
└── configs/              # Saved convolver configurations
    └── example.json
```

## 🎛️ Usage Examples

### Basic Viewing
1. Select a distribution from the dropdown
2. Adjust parameters with sliders
3. Drag to rotate the 3D view
4. Use the probability sampler to query specific points

### 2D Analysis
1. Click "OPEN 2D GRAPH MODE"
2. Adjust the slice Y position
3. Modify axis ranges and labels as needed
4. Toggle auto-scale for automatic Y-axis fitting

### Convolution
1. Click "CONVOLVER LAB"
2. Select Distribution A and B
3. Adjust parameters while viewing live previews
4. Click "COMPUTE CONVOLUTION"
5. Review the result preview
6. Click "APPLY & VIEW IN 3D" to visualize

### Save/Load Configs
1. In Convolver Lab, set up your distributions
2. Enter a name and click "SAVE"
3. Export all configs as JSON with "EXPORT JSON"
4. Import previously saved configs with "IMPORT JSON"

## 🧮 Physics Notes

### Maxwell-Boltzmann Distribution
Two visualizations are provided:
- **Velocity Distribution**: f(vx, vy) ∝ exp(-(vx² + vy²)/2kT) — Gaussian in velocity space, peaked at origin
- **Speed Distribution**: f(v) ∝ v² exp(-v²/2kT) — Chi distribution, peaked at v = √(2kT)

The v² factor arises from the spherical Jacobian when converting from velocity to speed.

### Higgs Potential
The potential V(φ) = μ²|φ|² + η|φ|³ + λ|φ|⁴ exhibits:
- **Symmetric phase** (μ² > 0): Single minimum at φ = 0
- **Broken phase** (μ² < 0): Ring of minima at |φ| = √(-μ²/2λ)
- **Thermal corrections**: μ²_eff = μ² + cT², restoring symmetry at high T
- **Critical temperature**: T_c = √(-μ²/c)

## 🤝 Contributing

Contributions are welcome! Some ideas:
- Additional distributions (Poisson, Chi-squared, etc.)
- FFT-based convolution for better performance
- Export visualizations as images/videos
- WebGL shaders for enhanced effects
- Mobile touch controls

## 📄 License

MIT License — feel free to use, modify, and distribute.

## 🙏 Acknowledgments

- Built with [Three.js](https://threejs.org/)
- Inspired by synthwave aesthetics and statistical mechanics
- Created with Claude (Anthropic)

---

*"updating my priors..."* ✨
