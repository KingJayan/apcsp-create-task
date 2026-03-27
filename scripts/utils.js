// utils.js

import { LERP_FREQ } from "./config.js";

//smooth angle lerp to prevent snapping/jumping
export function lerpAngle(current, target, t) {
    let diff = target - current;
    while (diff > Math.PI) diff -= LERP_FREQ * Math.PI;
    while (diff < -Math.PI) diff += LERP_FREQ * Math.PI;
    return current + (diff * t);
}

//check if a pt/robot overlaps with an obstacle
export function isColliding(x,y, robotSize, obstacles) {
    const rad = robotSize / 2;
    for (const obs of obstacles) {
        //circle to circle check
        const dist = Math.hypot(x-obs.x, y-obs.y);
        if (dist < rad + obs.radius) return true;
    }
    return false;
}
