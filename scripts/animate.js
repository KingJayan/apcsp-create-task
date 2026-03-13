// animate.js

import { LINE_RESOLUTION } from './config.js';
import { LERP_FREQ } from './config.js';

//helper to prevent snapping
function lerpAngle(current, target, t) {
    let diff = target - current;
    while (diff > Math.PI) diff -= LERP_FREQ * Math.PI;
    while (diff < -Math.PI) diff += LERP_FREQ * Math.PI;
    return current + (diff * t);
}

//calc the angle change between three points
//used to detect sharp corners in the path
function getAngleDiff(p0, p1, p2) {
    let d1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    let d2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (d1 < 0.001 || d2 < 0.001) return 0; //ignore overlapping pts

    let a1 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    let a2 = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    let diff = a2 - a1;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return Math.abs(diff);
}

export function updRobot(robot, pathArray) {
    if (!robot.isMoving || pathArray.length === 0) return;

    let index = Math.floor(robot.t);
    let target = pathArray[index];

    // delay logic
    if (target && target.type === 'delay') {
        if (!robot.delayStart) robot.delayStart = performance.now();

        if (performance.now() - robot.delayStart < target.ms) {
            return; // still waiting, halt physics
        } else {
            robot.delayStart = null;
            robot.t += 1.0; //skip past delay node
            if (robot.t >= pathArray.length - 1) {
                robot.t = pathArray.length - 1;
                robot.isMoving = false;
            }
            return;
        }
    }

    let localT = robot.t - index;

    let toNext = 0;
    for (let i = index; i < pathArray.length - 1; i++) {
        if (i > index) {
            let p0 = pathArray[i - 1];
            let p1 = pathArray[i];
            let p2 = pathArray[i + 1];
            // force deceleration into delays
            if (p0.type === 'delay' || p1.type === 'delay' || p2.type === 'delay') break;

            // only check for sharp corners if we are on a rigid line segment
            if (p1.mode !== 'curve' && p1.mode !== 'spline') {
                if (getAngleDiff(p0, p1, p2) > 0.1) break;
            }
        }
        toNext++;
    }
    let distFromEnd = toNext - localT;

    let sinceLast = 0;
    for (let i = index; i > 0; i--) {
        let p0 = pathArray[Math.max(0, i - 1)];
        let p1 = pathArray[i];
        let p2 = pathArray[i + 1];
        if (p0.type === 'delay' || p1.type === 'delay' || (p2 && p2.type === 'delay')) break;

        // only check for sharp corners if we are on a rigid line segment
        if (p1.mode !== 'curve' && p1.mode !== 'spline') {
            if (getAngleDiff(p0, p1, p2) > 0.1) break;
        }
        sinceLast++;
    }
    let distFromStart = sinceLast + localT;

    const RAMP_TICKS = 6; //less means ramp is longer, more means sharper ramp but aggro on corners

    //calc speed to choose if we are near to start, middle(1.0), or end of motion
    let profileMult = Math.min(1, distFromStart / RAMP_TICKS, distFromEnd / RAMP_TICKS);
    let speedMult = Math.max(0.2, profileMult); //min speed
    let indexSpeed = (robot.speed / LINE_RESOLUTION) * speedMult;

    robot.t += indexSpeed;

    //check if weve gone past the end(stop sim if so)
    if (robot.t >= pathArray.length - 1) {
        robot.t = pathArray.length - 1;
        robot.isMoving = false;
    }

    index = Math.floor(robot.t);
    let nextIndex = Math.min(index + 1, pathArray.length - 1);
    localT = robot.t - index;

    //lerp between the two closest pts
    let p1 = pathArray[index];
    let p2 = pathArray[nextIndex];

    robot.pose.x = p1.x + (p2.x - p1.x) * localT;
    robot.pose.y = p1.y + (p2.y - p1.y) * localT;
    robot.pose.heading = lerpAngle(p1.heading, p2.heading, localT);
}