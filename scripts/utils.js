// utils.js

import { LERP_FREQ } from "./config.js";

//smooth angle lerp to prevent snapping/jumping
export function lerpAngle(current, target, t) {
    let diff = target - current;
    while (diff > Math.PI) diff -= LERP_FREQ * Math.PI;
    while (diff < -Math.PI) diff += LERP_FREQ * Math.PI;
    return current + (diff * t);
}
