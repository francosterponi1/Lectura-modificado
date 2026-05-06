# Project Conventions

## La MEJOR Versión (Version Definitiva) - May 2, 2026
This version is considered the definitive "Best Version" of the app. If the user asks for "la MEJOR versión" or just "version2", revert all layout and font scaling to these parameters:

### Typography & Scaling
- **Aggressive Auto-scaling**: The word must occupy almost the entire width of the screen.
- **ResponsiveWord Component**: Uses `ResizeObserver` for immediate, accurate measurement.
- **Scaling Factors**: `targetWidth = width * 0.95`, `targetHeight = height * 0.85`, `charFactor = 0.6`.
- **Styling**: `font-black`, `uppercase`, `tracking-tighter`, `leading-[0.8]`, `whitespace-nowrap`.

### UI Elements
- **Score Panel**: Large, prominent panel with `text-3xl font-black`, `px-8 py-5`, and `shadow-2xl`.
- **Layout**: Full-width `main` container (`px-0`), centered content.
- **Animations**: Fast, linear transitions (`duration: 0.1`) to avoid progressive resizing effects.
- **Microphone**: Large toggle button with red/green state signaling and error tooltips.

### UX Behavior
- **Score Reset**: The score must reset to 0 every time the "Comenzar" (Start) button is pressed.
- **No Manual Next**: The "Siguiente" (Next) button is removed; progression is handled solely via Voice Recognition or Automatic Timer.
