# DESIGN_DIRECTION.md
<!-- Visual design decisions for Loopgate -->
<!-- Last updated: 2026-10-15 -->

## 1. Three Visual Directions Explored

### Direction A: "Industrial HUD" -- CHOSEN
Aesthetic: A real facility control room. Deep graphite surfaces, zinc structural lines, amber for hazard only.
Everything functional, nothing decorative. Industrial typography. Reminiscent of actual sorting-facility SCADA screens.
- Background: #0d0f11 (near-black warm graphite)
- Signal color: #f59e0b (amber) -- hazard ONLY
- Typography: Space Grotesk (display) + JetBrains Mono (data)
- Motion: purposeful, physics-based, no decorative flourishes

### Direction B: "Clinical Lab" -- REJECTED
Aesthetic: Medical/lab cleanroom. White surfaces, red for danger, green for safe.
Verdict: Rejected. Fails the uniqueness requirement. Generic SaaS look. Red/green inaccessible without shape coding.

### Direction C: "Neon Operator" -- REJECTED
Aesthetic: Cyberpunk facility, electric cyan primary, amber hazard secondary, full glassmorphism.
Verdict: Rejected. Two signal colors compete with each other. Conflicts with brief "one signal color" rule. Visually identical to the existing PRISM Command Center project in Stitch (id: 9417568307750762899) which already uses cyan #00f0ff.

---

## 2. CHOSEN: Direction A -- Industrial HUD

**Reason:**
- Fulfills the brief exactly: dark graphite, ONE signal color (amber = hazard), everything else quiet
- Most appropriate thematically: amber is the universal industrial hazard color
- Most unique in a hackathon context where neon/cyan palettes dominate (see rejected Direction C)
- Typography pair (Space Grotesk + JetBrains Mono) signals technical precision without looking like a consumer app
- Works naturally with the 3D scene: graphite conveyor, amber light on hazardous bin
- Does NOT look like the PRISM Command Center (different colour story entirely)

---

## 3. Design Tokens

### Colors

```
Foundation:
  --color-base:       #0d0f11    Page background -- warm near-black graphite
  --color-surface-1:  #161819    Card background level 1
  --color-surface-2:  #1e2022    Card background level 2 (elevated)
  --color-surface-3:  #262829    Input/control background
  --color-border:     #2a2d2f    Structural dividers
  --color-border-dim: #1f2123    Subtle borders

Text:
  --color-text-primary:   #f4f4f5    Main content (zinc-100)
  --color-text-secondary: #a1a1aa    Secondary labels (zinc-400)
  --color-text-muted:     #52525b    Inactive/placeholder (zinc-600)
  --color-text-inverse:   #0d0f11    Text on amber/light backgrounds

Signal (amber = HAZARD ONLY):
  --color-hazard:        #f59e0b    Amber-400: hazard classification, warnings
  --color-hazard-dim:    #78350f    Amber-900: hazard chip background
  --color-hazard-ring:   rgba(245,158,11,0.25)  Uncertainty ring glow

Status (quiet, not signal):
  --color-safe:     #4ade80    Green-400: verified safe
  --color-safe-dim: #14532d    Green-900: safe chip background
  --color-info:     #94a3b8    Slate-400: neutral/informational
  --color-error:    #f87171    Red-400: error states only (functional only)

3D scene:
  --color-scan:     rgba(245,158,11,0.6)  Scanner gate beam
```

### Typography

```
Fonts:
  --font-display: 'Space Grotesk', system-ui, sans-serif
  --font-mono:    'JetBrains Mono', 'Fira Code', monospace

Scale (rem):
  --text-xs:   0.75    12px  provenance chips, micro labels
  --text-sm:   0.875   14px  body labels, secondary
  --text-base: 1.0     16px  body
  --text-lg:   1.125   18px  section labels
  --text-xl:   1.25    20px  card titles
  --text-2xl:  1.5     24px  page headings
  --text-3xl:  1.875   30px  hero
  --text-4xl:  2.25    36px  display

Weights:
  --weight-regular:  400
  --weight-medium:   500
  --weight-semibold: 600
  --weight-bold:     700

Letter spacing for mono labels (uppercase only):
  --tracking-widest: 0.1em   Provenance chips, status labels
  --tracking-wide:   0.05em  Section headers
```

### Spacing (4px base grid)

```
--space-1:  0.25rem   4px
--space-2:  0.5rem    8px
--space-3:  0.75rem   12px
--space-4:  1rem      16px
--space-5:  1.25rem   20px
--space-6:  1.5rem    24px
--space-8:  2rem      32px
--space-10: 2.5rem    40px
--space-12: 3rem      48px
--space-16: 4rem      64px
--space-20: 5rem      80px
--space-24: 6rem      96px
```

### Borders and Radius

```
--radius-none: 0
--radius-sm:   0.125rem   2px  chips, badges, sharp industrial
--radius-md:   0.25rem    4px  cards, inputs, buttons
--radius-lg:   0.375rem   6px  modals
--radius-full: 9999px     ONLY for uncertainty ring SVG circles

RULE: NO pill-shaped buttons. All buttons use radius-sm or radius-md maximum.
```

### Shadows

```
--shadow-sm:  0 1px 2px rgba(0,0,0,0.4)
--shadow-md:  0 4px 12px rgba(0,0,0,0.5)
--shadow-lg:  0 8px 24px rgba(0,0,0,0.6)

Amber glow ONLY on hazardous items (not decorative):
--shadow-hazard: 0 0 16px rgba(245,158,11,0.3)
```

### Motion Principles

```
Principle 1: Motion explains, not entertains.
  Every animation communicates state change or spatial relationship.
  3D camera moves show the workflow direction (left to right: intake -> bins).
  Uncertainty ring pulsing communicates "this needs attention".

Principle 2: Speed reflects urgency.
  Hazard diversions: fast 200ms, amber flash.
  Normal routing: medium 350ms, no flash.
  Replay cinematic: slow 800ms, deliberate.

Principle 3: Physics-based, not CSS easing.
  All 3D motions: spring physics (drei/GSAP spring).
  UI transitions: ease-out-quart 150-300ms.
  NO bouncy easing on industrial UI elements.
  NO infinite idle animations (except uncertainty ring pulse, which is meaningful).

Principle 4: Reduced-motion first.
  All animations have a no-motion fallback.
  Information conveyed by color AND text, not motion alone.
```

---

## 4. 3D Scene Art Direction (Sentinel Facility)

### Camera
- Position: (0, 8, 15) looking at (0, 1, 0)
- Perspective, fov=50 (slight telephoto for industrial look)
- OrbitControls: enabled, polar angle locked (min 15deg, max 70deg -- no upside-down view)

### Conveyor Belt
- Dark metal: MeshStandardMaterial, roughness 0.8, metalness 0.3, color #1a1c1e
- Moving texture: UV offset animation (subtle directional motion)
- Layout: left (intake) to right (bins), ~20 units long

### Scanner Gate
- Arch spanning the belt, #2a2d2f brushed steel
- Scan beam: amber plane (PlaneGeometry, MeshBasicMaterial, #f59e0b, 60% opacity)
- Beam animation: sweeps Y axis through arch in 0.8s on trigger
- Ambient glow when scanning: PointLight amber, low intensity, positioned at gate

### Waste Items
- Geometry: BoxGeometry or CylinderGeometry (simple primitives, NOT detailed meshes)
- Color by class:
  - Recyclable: blue-tinted grey #4a6080
  - Biodegradable: organic brown #7a5c3a
  - Reusable: neutral grey #5a6070
  - Hazardous: dark grey #3a3030 with amber edge highlight
- Hazardous items: PointLight (amber) above them, intensity pulsing 0.5-1.0 at 1Hz (meaningful, not decorative)

### Bins (end of belt)
- Four rectangular bins (BoxGeometry + walls)
- Labels: RECYCLABLE, REUSABLE, BIODEGRADABLE, HAZARDOUS
- Hazardous bin: amber edge (#f59e0b edge emissive), amber label
- Others: zinc-600 edge, white label

### Inspection Bay
- Side track branching off main belt when gate fires
- Platform lifts item (Y-axis GSAP tween)
- SpotLight from above: amber, 30deg cone angle

### Lighting
- HemisphereLight: sky #1e2022, ground #0d0f11, intensity 0.5
- DirectionalLight: color #c0c0c0, intensity 0.8, from upper-left (casts industrial shadows)
- PointLight: amber, above hazardous items only
- SpotLight: animated across scanner gate during scan

### Low-Power Mode
- Trigger: navigator.hardwareConcurrency <= 4 OR deviceMemory <= 2
- Fallback: SVG diagram of the same sorting line with CSS animation
- Manual toggle: "3D off" in corner of Sentinel Facility view

### Replay Theatre
- Two-panel view: CSS side-by-side, single canvas OR two canvases
- Divergence point: amber vertical line in scene
- Camera sweep: GSAP tween from intake to divergence in 2s on open

### Evidence Lab Overlay
- 2D canvas overlaid on uploaded image (native Canvas API)
- Bounding boxes: dashed amber (hazardous), dashed slate-400 (others), 2px stroke
- Confidence score: number + arc-ring next to each box
- Provenance chips: HTML overlay, percentage-based positioning

---

## 5. Component Specifications

| Component | Shape | Font | Notes |
|-----------|-------|------|-------|
| Buttons (primary) | radius-md (4px) | Space Grotesk 14px medium | Amber border + dim amber bg; uppercase label; NO pill |
| Buttons (secondary) | radius-md (4px) | Space Grotesk 14px medium | Zinc border, white text |
| Status chips | radius-sm (2px) | JetBrains Mono 10px 600 uppercase | Rectangular, NOT pill |
| Provenance chips | radius-sm (2px) | JetBrains Mono 10px 600 uppercase | Colors per label type |
| Cards | radius-md (4px) | -- | surface-1 bg, border-dim border |
| Modals | radius-lg (6px) | -- | surface-2 bg, shadow-lg, zinc-800 border |
| Inputs | radius-md (4px) | JetBrains Mono (data inputs) | Dark fill, amber focus ring |
| Icons | Lucide React | -- | No emoji icons anywhere |

### Provenance Chip Colors
| Label | Background | Text | Border |
|-------|-----------|------|--------|
| Observed | #1e2022 | #a1a1aa | #2a2d2f |
| Model-inferred | #1a1e2a | #94a3b8 | #2a3040 |
| Human-verified | #14532d | #4ade80 | #166534 |
| Configured | #1e2022 | #71717a | #3f3f46 |
| Simulated | #1e2022 | #94a3b8 | #2a2d2f |
| Calculated | #262626 | #a1a1aa | #3f3f46 |
| AI-generated | #78350f | #fbbf24 | #92400e |
