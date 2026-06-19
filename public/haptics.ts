/**
 * Haptic feedback helper that works on both Android (Vibration API) and
 * iOS Safari (native checkbox "switch" hack).
 *
 * iOS does not expose the Vibration API, but Safari 17.4+ renders native
 * switches for `<input type="checkbox" switch>`. Toggling a native switch
 * produces a small Taptic response, so we create a hidden switch, toggle it,
 * and remove it.
 *
 * Unlike the third-party `ios-haptics` package, we keep the switch element
 * rendered in the layout (opacity:0, 1px sizing) rather than hiding it
 * with `display:none`, which can prevent the native control from firing.
 */

export type HapticFn = {
  /** Single light haptic pulse. */
  (): void;
  /** Two rapid pulses, useful for confirmations / medium alerts. */
  confirm(): void;
  /** Three rapid pulses, useful for errors / strong alerts. */
  error(): void;
};

function isCoarsePointer(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

function triggerIosSwitchHaptic(): void {
  // Only attempt the switch hack on touch devices.
  if (!isCoarsePointer()) return;

  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  // Keep the element in the render tree but invisible.
  label.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "width:1px",
    "height:1px",
    "opacity:0",
    "pointer-events:none",
    "touch-action:none",
  ].join(";");

  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.appendChild(input);

  document.body.appendChild(label);

  // Click the label to toggle the native switch. This is what yields the
  // haptic "click" on iOS.
  label.click();

  // Remove the element once the haptic has had a chance to fire.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (label.parentNode) {
        label.parentNode.removeChild(label);
      }
    });
  });
}

function baseHaptic(): void {
  if (typeof navigator === "undefined") return;

  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(50);
    return;
  }

  triggerIosSwitchHaptic();
}

export const haptic: HapticFn = Object.assign(baseHaptic, {
  confirm: () => {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([50, 70, 50]);
      return;
    }
    baseHaptic();
    setTimeout(baseHaptic, 120);
  },
  error: () => {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([50, 70, 50, 70, 50]);
      return;
    }
    baseHaptic();
    setTimeout(baseHaptic, 120);
    setTimeout(baseHaptic, 240);
  },
});

export function supportsHaptics(): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.vibrate === "function") return true;
  return isCoarsePointer();
}
