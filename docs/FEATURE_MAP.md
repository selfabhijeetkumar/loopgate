# FEATURE_MAP.md
<!-- Phase assignments for all UI features -->
<!-- Last updated: 2026-10-15 -->

## UI Feature Map with Phase Assignments

### P1 (Scaffold + Design System, Phase 1)
These features are built as part of core infrastructure and cannot be deferred.

| Feature | Component | Notes |
|---------|-----------|-------|
| Skip-to-content link | Layout | First focusable element, screen readers |
| Dark mode toggle | Header | CSS custom properties; no flash of wrong theme |
| Sticky header | Header | On scroll, height shrinks slightly |
| Mobile hamburger menu | Header | Transforms to X; traps focus when open |
| Hover states | All interactive | Consistent amber accent for hazard, slate for rest |
| Focus states | All interactive | Ring offset, same visual as hover |
| Loading animations | CV route | Skeleton cards, spinner ring during inference |
| Confirmation modal: Approve Routing | App/Sentinel | Keyboard accessible, Esc closes |
| Confirmation modal: Divert for Inspection | App/Sentinel | Same modal system |
| Confirmation modal: Reset Replay | App/Replay | Same modal system |
| Copy button | Audit log | Copies formatted incident report text |
| Print stylesheet | Incident report | @media print, hides nav/3D, formats table |
| Reduced-motion support | All animated | prefers-reduced-motion: reduce |

### P1 (Success / Error States, Phase 1)
Every flow must have success AND error state before phase closes.

| Flow | Success State | Error State |
|------|---------------|-------------|
| Image upload | Preview + "Analyzing..." | "File too large / unsupported type" |
| CV inference | Classification card appears | "Model not loaded / inference failed" |
| Gemini second-opinion | AI chip appears | "AI unavailable -- showing estimate" |
| Approve routing | Twin updates, audit entry added | Toast: "Approval failed -- try again" |
| Replay launch | Theatre opens | "No batch data -- upload items first" |

### P2 (Nice-to-Have, Phase 6 if time allows)
Add only if Phase 5 (3D twin) and Phase 6 (pages) are fully verified.

| Feature | Component | Notes |
|---------|-----------|-------|
| Site search | Header | Searches FAQ + page content |
| Back-to-top button | Global | Appears after 300px scroll |
| Scroll progress bar | Landing only | Thin amber bar at top |
| Floating contact button | Landing only | mailto, bottom-right, appears after fold |
| Analytics | NOT ADDED | No analytics in hackathon = no cookies, no banner |

### P1 Landing Page Features (Phase 6)
| Feature | Notes |
|---------|-------|
| Expandable FAQ | Smooth height animation, keyboard accessible |
| Last updated date | Auto-calculated from build, shown in footer |
| Internal links | All pages cross-link; no orphaned pages |
| Alt text | All images/icons, including 3D canvas fallback |
| Breadcrumbs | About, FAQ, Privacy, Terms only |

---

## Feature Implementation Notes

### Dark Mode Toggle
- Implementation: CSS custom properties on :root + [data-theme="dark"]
- Storage: localStorage preference key "loopgate-theme"
- No flash: inline script in <head> reads preference before paint
- Toggle icon: sun/moon SVG (no emoji)

### Confirmation Modals
- Shared component: <ConfirmModal title action onConfirm onCancel>
- Three instances: Approve Routing, Divert to Inspection, Reset Replay
- Keyboard: Enter confirms, Esc cancels, Tab cycles within modal
- Focus trapped inside modal while open
- Backdrop click = cancel

### Print Stylesheet
- Target: Incident Report view in Evidence Lab
- Print: hides nav, 3D canvas, modals; shows table of provenance data
- Page breaks before each material class section
- Black/white safe (no color-only information)

### Reduced-Motion
- CSS: @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms; transition-duration: 0.01ms; } }
- GSAP: gsap.matchMedia() respecting (prefers-reduced-motion: reduce) in all timeline configs
- 3D: freeze idle animations; camera auto-rotate disabled

### Uncertainty Ring
- Visual: SVG circle with stroke-dashoffset animation
- States: Low (<40% confidence) = amber dashed ring, pulsing slowly
- States: Medium (40-70%) = slate ring
- States: High (>70%) = green ring
- Reduced motion: ring is static, confidence number shown in text

### Provenance Label Chips
- Shape: Rectangular (NOT pill). 2px radius max.
- Colors: Observed (slate), Model-inferred (slate-blue tint), Human-verified (green tint), Configured (zinc), Simulated (purple-free slate), Calculated (zinc), AI-generated (amber-tint)
- Font: JetBrains Mono, label-sm (10px, uppercase, 0.08em tracking)
- No emoji in chips
