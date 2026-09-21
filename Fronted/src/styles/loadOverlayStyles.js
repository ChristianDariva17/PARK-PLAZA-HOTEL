let overlayStylesPromise

export function loadOverlayStyles() {
  overlayStylesPromise ||= import('./overlays.css')
  return overlayStylesPromise
}
