// utils.js

//smooth angle lerp to prevent snapping/jumping
export function lerpAngle(current, target, t) {
    let diff = target - current;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return current + (diff * t);
}
