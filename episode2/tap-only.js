'use strict';

// Cancel single-finger drags before Safari scrolls or turns a drag into a tap.
const tapRadius = 12;
let touchOrigin = null;
let suppressTap = false;

document.addEventListener('touchstart', event => {
  if (event.touches.length !== 1) {
    touchOrigin = null;
    suppressTap = true;
    return;
  }
  const touch = event.touches[0];
  touchOrigin = {x:touch.clientX,y:touch.clientY,scrollY:!!event.target?.closest?.("[data-swipe-y]")};
  suppressTap = false;
}, {capture:true,passive:true});

document.addEventListener('touchmove', event => {
  if (!touchOrigin || event.touches.length !== 1) return;
  const touch = event.touches[0];
  if (Math.hypot(touch.clientX-touchOrigin.x,touch.clientY-touchOrigin.y) >= tapRadius) {
    suppressTap = true;
  }
  if (suppressTap && !touchOrigin.scrollY && event.cancelable) event.preventDefault();
}, {capture:true,passive:false});

document.addEventListener('touchcancel', () => {
  touchOrigin = null;
  suppressTap = true;
}, {capture:true,passive:true});

document.addEventListener('click', event => {
  const isTouch = event.pointerType === 'touch'
    || (!event.pointerType && event.sourceCapabilities?.firesTouchEvents !== false);
  if (!suppressTap || event.detail === 0 || !isTouch) return;
  suppressTap = false;
  event.preventDefault();
  event.stopImmediatePropagation();
}, {capture:true});
