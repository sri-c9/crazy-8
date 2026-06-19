// Doodle God / sketchbook SVG icon set for card faces and corners.
// All icons use currentColor for strokes so they inherit the card's ink color.

const svg = (content: string, viewBox = "0 0 48 48") =>
  `<svg class="card-icon" viewBox="${viewBox}" aria-hidden="true">${content}</svg>`;

const cornerSvg = (content: string, viewBox = "0 0 16 16") =>
  `<svg class="corner-icon" viewBox="${viewBox}" aria-hidden="true">${content}</svg>`;

const firePaths = `<path d="M24 6c2 6 8 10 8 18a8 8 0 0 1-16 0c0-6 5-11 8-18z"/><path d="M24 16c1 3 4 6 4 10a4 4 0 0 1-8 0c0-3 3-6 4-10z" fill="var(--paper-white)" opacity="0.35"/>`;

const waterPaths = `<path d="M24 6c8 10 10 16 10 22a10 10 0 0 1-20 0c0-6 2-12 10-22z"/><circle cx="28" cy="20" r="2" fill="var(--paper-white)" opacity="0.5"/>`;

const leafPaths = `<path d="M24 4c10 2 14 12 14 22 0 10-8 14-14 14-6 0-14-4-14-14 0-10 4-20 14-22z"/><path d="M24 10v24"/>`;

const swirlPaths = `<path d="M36 18c0-8-8-12-16-8-8 4-10 14-4 20s16 6 18-2c2-6-4-12-10-10-4 1-6 6-4 10"/>`;

const sparkPaths = `<path d="M24 2l4 14 14 4-14 4-4 14-4-14-14-4 14-4z"/><circle cx="24" cy="24" r="5" fill="var(--paper-white)" opacity="0.4"/>`;

const flashSmallPaths = `<path d="M20 4l-6 16h10l-4 16 14-20h-10l8-12z"/>`;

const flashBigPaths = `<path d="M22 2l-8 20h12l-6 24 18-28h-14l10-16z"/>`;

const cataclysmPaths = `<path d="M8 38l6-14 4 8 6-18 6 16 4-6 6 14z"/><path d="M4 40h40" stroke-width="3"/>`;

const skipArrowPaths = `<circle cx="24" cy="24" r="18"/><path d="M16 16l16 16M16 32l16-16"/>`;

const reverseArrowPaths = `<path d="M40 24a16 16 0 1 1-8-14"/><path d="M40 10v14h-14"/>`;

const swapArrowsPaths = `<path d="M10 16h20"/><path d="M26 10l6 6-6 6"/><path d="M38 32h-20"/><path d="M22 38l-6-6 6-6"/>`;

const shieldPaths = `<path d="M24 4l16 6v10c0 14-10 20-16 22-6-2-16-8-16-22V10z"/><path d="M16 24l6 6 12-12"/>`;

const rotateArrowPaths = `<path d="M8 24a16 16 0 1 1 8 14"/><path d="M40 34l-6 6 6 4"/><text x="18" y="28" font-size="10" font-family="var(--font-tile)" fill="currentColor" stroke="none" text-anchor="middle">1</text>`;

const stealMaskPaths = `<path d="M12 14c4-2 20-2 24 0 2 6 0 16-4 20-8-4-20-4-28 0-4-4-6-14-4-20z"/><circle cx="18" cy="22" r="2" fill="currentColor"/><circle cx="30" cy="22" r="2" fill="currentColor"/>`;

const cloverPaths = `<path d="M24 8c-4-8-14-4-10 4-8 0-8 12-2 12-6 6 2 14 8 8 2 8 12 8 14 0 6 6 14-2 8-8 6 0 6-12-2-12 4-8-6-12-10-4z"/><path d="M24 24v12"/>`;

const boltPaths = `<path d="M28 2L14 26h10l-4 20 18-28h-10l10-16z"/>`;

const questionPaths = `<path d="M16 18c0-6 4-10 10-10s10 4 10 10c0 5-6 8-6 14"/><circle cx="24" cy="40" r="3" fill="currentColor"/>`;

// Icon map exposed for the renderer.
export const icons: Record<string, { face: string; corner: string }> = {
  fire: { face: svg(firePaths), corner: cornerSvg(firePaths, "0 0 16 16") },
  water: { face: svg(waterPaths), corner: cornerSvg(waterPaths, "0 0 16 16") },
  leaf: { face: svg(leafPaths), corner: cornerSvg(leafPaths, "0 0 16 16") },
  swirl: { face: svg(swirlPaths), corner: cornerSvg(swirlPaths, "0 0 16 16") },
  spark: { face: svg(sparkPaths), corner: cornerSvg(sparkPaths, "0 0 16 16") },
  flashSmall: { face: svg(flashSmallPaths), corner: cornerSvg(flashSmallPaths, "0 0 16 16") },
  flashBig: { face: svg(flashBigPaths), corner: cornerSvg(flashBigPaths, "0 0 16 16") },
  cataclysm: { face: svg(cataclysmPaths), corner: cornerSvg(cataclysmPaths, "0 0 16 16") },
  skipArrow: { face: svg(skipArrowPaths), corner: cornerSvg(skipArrowPaths, "0 0 16 16") },
  reverseArrow: { face: svg(reverseArrowPaths), corner: cornerSvg(reverseArrowPaths, "0 0 16 16") },
  swapArrows: { face: svg(swapArrowsPaths), corner: cornerSvg(swapArrowsPaths, "0 0 16 16") },
  shield: { face: svg(shieldPaths), corner: cornerSvg(shieldPaths, "0 0 16 16") },
  rotateArrow: { face: svg(rotateArrowPaths), corner: cornerSvg(rotateArrowPaths, "0 0 16 16") },
  stealMask: { face: svg(stealMaskPaths), corner: cornerSvg(stealMaskPaths, "0 0 16 16") },
  clover: { face: svg(cloverPaths), corner: cornerSvg(cloverPaths, "0 0 16 16") },
  bolt: { face: svg(boltPaths), corner: cornerSvg(boltPaths, "0 0 16 16") },
  question: { face: svg(questionPaths), corner: cornerSvg(questionPaths, "0 0 16 16") },
};

// Element icon lookup by color name.
export const elementByColor: Record<string, string> = {
  red: "fire",
  blue: "water",
  green: "leaf",
  yellow: "swirl",
  wild: "spark",
};

// Uppercase label by color.
export const colorLabel: Record<string, string> = {
  red: "RED",
  blue: "BLUE",
  green: "GREEN",
  yellow: "YELLOW",
  wild: "WILD",
};
