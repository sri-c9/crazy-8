# Phase 6: Animations & Mobile UX — Technical Plan

**STATUS: TENTATIVE** — This plan will be refined when Phase 6 begins.

## Goal

Add polish with CSS animations, mobile-responsive touches, card play animations, smooth transitions, haptic feedback, and accessibility improvements. Make the game feel delightful to play on mobile devices.

## Depends On

- **Phase 5 Complete:** Interactivity, reconnection, error handling

## Files to Modify

### 1. `public/styles.css` — Animation System (MODIFY)

**New Animations:**

```css
/* Card Play Animation */
@keyframes cardSlideToDiscard {
  from {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  to {
    transform: translateY(-300px) scale(0.8);
    opacity: 0;
  }
}

.card.playing {
  animation: cardSlideToDiscard 0.4s ease-out forwards;
}

/* Card Draw Animation */
@keyframes cardDrawFromDeck {
  from {
    transform: translateY(-200px) scale(0.5);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

.card.drawing {
  animation: cardDrawFromDeck 0.4s ease-out;
}

/* Card Flip (Wild Color Selection) */
@keyframes cardFlip {
  0% { transform: rotateY(0); }
  50% { transform: rotateY(90deg); }
  100% { transform: rotateY(0); }
}

.card.flipping {
  animation: cardFlip 0.6s ease-in-out;
}

/* Player Join/Leave */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeOut {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-10px); }
}

.player-joining { animation: fadeIn 0.3s ease; }
.player-leaving { animation: fadeOut 0.3s ease; }

/* Turn Indicator Pulse */
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.current-player {
  animation: pulse 1s ease-in-out infinite;
  border: 3px solid gold;
}

/* Plus-Stack Effect */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

#pending-alert {
  animation: shake 0.5s ease;
}

/* Reverse Direction Indicator */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.direction-indicator {
  animation: spin 1s linear infinite;
}

/* Skip Animation */
@keyframes skipBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20px); }
}

.skip-effect {
  animation: skipBounce 0.6s ease;
}
```

**Touch Interaction Enhancements:**

```css
/* Larger touch targets */
.card {
  margin: 5px;  /* Spacing between cards for fat-finger tolerance */
}

/* Active state feedback */
.card:active {
  transform: scale(0.95);
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

/* Disabled state (not your turn) */
.card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* Smooth transitions */
* {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
```

**Mobile Landscape Mode:**

```css
@media (orientation: landscape) and (max-height: 500px) {
  /* Compress vertical space */
  #opponents-area { max-height: 80px; }
  .opponent-avatar { font-size: 30px; }

  #center-area { margin: 10px 0; }

  .card {
    width: 50px;
    height: 75px;
  }
}
```

### 2. `public/game-client.js` — Animation Triggers (MODIFY)

**Animation Trigger Functions:**

- `playCardWithAnimation(cardIndex, chosenColor)`
  - Add `.playing` class to card element
  - Wait 400ms (animation duration)
  - Remove card from hand
  - Send WebSocket message
  - Update discard pile

- `drawCardWithAnimation()`
  - Add spinner to draw pile
  - Send WebSocket message
  - On response: add `.drawing` class to new card
  - Append to hand

- `flipWildCard(cardIndex, newColor)`
  - Add `.flipping` class
  - Change card background mid-flip (at 50%)
  - Update color after flip completes

- `showSpecialEffect(effect, data)`
  - Plus-stack: shake pending alert
  - Skip: bounce opponent avatars
  - Reverse: spin direction indicator
  - Duration: 600ms

**Haptic Feedback (Mobile):**

```js
// Trigger vibration on card play (if supported)
function triggerHaptic() {
  if (navigator.vibrate) {
    navigator.vibrate(50);  // 50ms short vibration
  }
}

// On card play
playCardWithAnimation(index, color).then(() => {
  triggerHaptic();
});
```

### 3. Sound Effects (OPTIONAL)

**Audio Files to Add:**

- `sounds/play-card.mp3` — Soft "snap" when card played
- `sounds/draw-card.mp3` — Card slide sound
- `sounds/special-card.mp3` — Dramatic sound for +20, reverse stack, etc.
- `sounds/win.mp3` — Victory fanfare
- `sounds/join.mp3` — Player joined room

**Implementation:**

```js
const sounds = {
  playCard: new Audio('sounds/play-card.mp3'),
  drawCard: new Audio('sounds/draw-card.mp3'),
  specialCard: new Audio('sounds/special-card.mp3'),
  win: new Audio('sounds/win.mp3'),
  join: new Audio('sounds/join.mp3')
};

function playSound(soundName) {
  if (soundsEnabled) {  // User preference toggle
    sounds[soundName].currentTime = 0;  // Reset to start
    sounds[soundName].play();
  }
}
```

**Settings Toggle:**

Add settings button in game screen:
- 🔊 Sounds: On/Off
- 📳 Haptics: On/Off
- Store preferences in `localStorage`

### 4. Accessibility Improvements

**ARIA Labels:**

```html
<!-- Lobby -->
<button id="create-room-btn" aria-label="Create a new game room">Create Room</button>

<!-- Game Board -->
<div id="top-card" class="card red" role="img" aria-label="Top card: Red 5">
  <span class="card-value">5</span>
</div>

<button class="card blue playable" aria-label="Play Blue 3">
  <span class="card-value">3</span>
</button>

<!-- Turn Indicator -->
<span id="turn-indicator" role="status" aria-live="polite">Alice's turn</span>

<!-- Pending Draws Alert -->
<div id="pending-alert" role="alert" aria-live="assertive">
  ⚠️ <span id="pending-count">+8</span> cards pending!
</div>
```

**Keyboard Navigation:**

```js
// Allow card selection with arrow keys + Enter
document.addEventListener('keydown', (e) => {
  if (!yourTurn) return;

  if (e.key === 'ArrowLeft') selectPreviousCard();
  if (e.key === 'ArrowRight') selectNextCard();
  if (e.key === 'Enter') playSelectedCard();
  if (e.key === 'd') drawCard();
});
```

**High Contrast Mode:**

```css
@media (prefers-contrast: high) {
  .card {
    border: 2px solid black;
  }

  .card.playable {
    border: 4px solid yellow;
  }
}
```

**Reduced Motion:**

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
```

### 5. Loading States & Skeletons

**Skeleton Screen for Initial Load:**

```html
<div id="game-skeleton" class="skeleton">
  <div class="skeleton-bar"></div>  <!-- Top bar -->
  <div class="skeleton-opponents"></div>  <!-- Opponent cards -->
  <div class="skeleton-center"></div>  <!-- Discard/draw -->
  <div class="skeleton-hand"></div>  <!-- Your hand -->
</div>
```

```css
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

Replace skeleton with actual content when state loads.

### 6. Mobile-Specific Features

**Pull-to-Refresh (Disabled):**

```css
body {
  overscroll-behavior-y: contain;  /* Prevent pull-to-refresh */
}
```

**Safe Area Insets (iPhone Notch):**

```css
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
```

**Prevent Zoom on Input Focus:**

```css
input, button {
  font-size: 16px;  /* iOS won't zoom if font-size >= 16px */
}
```

**Install as PWA (Future Enhancement):**

Add `manifest.json` for "Add to Home Screen" capability:

```json
{
  "name": "Insane Crazy 8",
  "short_name": "Crazy 8",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#2c3e50",
  "theme_color": "#3498db",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

## Testing & Verification

### Manual Testing Steps

1. **Card play animation:**
   - Play a card
   - Verify smooth slide animation to discard pile (400ms)
   - Check no visual glitches

2. **Draw animation:**
   - Draw a card
   - Verify card appears with slide-in animation
   - Check card added to correct position in hand

3. **Special effects:**
   - Stack +cards → verify pending alert shakes
   - Play reverse → verify direction indicator spins
   - Play skip → verify opponent avatars bounce

4. **Haptic feedback:**
   - Test on physical iOS/Android device
   - Play card → feel short vibration (50ms)

5. **Sound effects (if implemented):**
   - Enable sounds in settings
   - Play card → hear snap sound
   - Draw card → hear slide sound
   - Disable sounds → verify silence

6. **Accessibility:**
   - Use screen reader (VoiceOver on iOS, TalkBack on Android)
   - Navigate with keyboard (Tab, Enter, arrows)
   - Enable high contrast mode → verify readability
   - Enable reduced motion → verify no animations

7. **Landscape mode:**
   - Rotate device to landscape
   - Verify layout adapts (compressed vertical space)
   - Check all UI elements remain accessible

8. **Skeleton loading:**
   - Clear cache
   - Load game page
   - Verify skeleton appears → fades to actual content

### Performance Testing

- **Animation frame rate:**
  - Open DevTools Performance tab
  - Record during card play
  - Verify 60fps (or 120fps on ProMotion displays)

- **Memory usage:**
  - Play 20+ cards
  - Check for memory leaks (should stay under 50MB)

## Success Criteria

- ✅ Card play animations smooth (60fps)
- ✅ Draw animations feel natural
- ✅ Special effects (shake, spin, bounce) work
- ✅ Haptic feedback on card play (mobile only)
- ✅ Sound effects play correctly (if implemented)
- ✅ Settings toggle for sounds/haptics works
- ✅ ARIA labels for screen readers
- ✅ Keyboard navigation functional
- ✅ High contrast mode supported
- ✅ Reduced motion respected
- ✅ Landscape mode layout correct
- ✅ Skeleton loading screen appears on first load
- ✅ No performance issues (60fps, <50MB memory)

## What's NOT in Phase 6

- Progressive Web App (PWA) full setup
- Offline mode
- Push notifications
- Advanced analytics
- Custom avatar uploads
- Chat system
- Achievements/leaderboards

These are potential future enhancements beyond the core game experience.
