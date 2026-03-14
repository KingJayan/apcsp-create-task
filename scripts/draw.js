// draw.js
import { FIELD_SIZE, CANVAS_SIZE, LINE_RESOLUTION, CURVE_STEPS, SPLINE_STEPS } from './config.js';
import { lerpAngle } from './utils.js';

const SCALE = CANVAS_SIZE / FIELD_SIZE;//~4.16 ppi

//helper function
export function toPix(inchX, inchY) {
    return {
        x: (inchX + 72) * SCALE,
        y: (72 - inchY) * SCALE
    };
}

export function toInch(pixX, pixY) {
    return {
        x: (pixX / SCALE) - 72,
        y: 72 - (pixY / SCALE)
    };
}

//draws the 6x6 tiled field
export function drawGrid(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#27272a";
    ctx.lineWidth = 1;

    const tileSize = 24 * SCALE; //2ft per tile

    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
        //vert lines
        ctx.moveTo(i * tileSize, 0);
        ctx.lineTo(i * tileSize, canvas.height);
        //horz lines
        ctx.moveTo(0, i * tileSize);
        ctx.lineTo(canvas.width, i * tileSize);
    }
    ctx.stroke();

    //draw axes
    ctx.strokeStyle = "rgba(250, 250, 250, 0.1)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
}

//math extractor: gen the array of coords
export function generatePath(allNodes) {
    let path = [];
    if (allNodes.length < 2) return path;

    path.push({ x: allNodes[0].x, y: allNodes[0].y, heading: allNodes[0].heading, mode: 'start' });

    //declare outside loop so tangency works across segments
    let prevX = allNodes[0].x;
    let prevY = allNodes[0].y;
    let lastHeading = allNodes[0].heading;

    let i = 1;
    while (i < allNodes.length) {
        let p0 = allNodes[i - 1]; //end of the last segment
        let currNode = allNodes[i]; //target node
        let mode = currNode.mode;
        let hType = currNode.headingInterp || "linear"; //default to linear

        if (mode === "line" || mode === "point" || !mode) {
            let steps = Math.max(1, Math.ceil(Math.hypot(currNode.x - p0.x, currNode.y - p0.y) / LINE_RESOLUTION));
            for (let s = 1; s <= steps; s++) {
                let t = s / steps;
                let x = p0.x + (currNode.x - p0.x) * t;
                let y = p0.y + (currNode.y - p0.y) * t;

                let heading = p0.heading; //constant
                if (hType === "linear") heading = lerpAngle(p0.heading, currNode.heading, t);
                else if (hType === "tangential") {
                    if (Math.hypot(y - prevY, x - prevX) > 0.001) heading = Math.atan2(y - prevY, x - prevX);
                    else heading = lastHeading;
                }

                path.push({ x, y, heading, mode: "line" });
                prevX = x; prevY = y; lastHeading = heading;
            }
            i++;
        }
        else if (mode === "curve") {
            let p1 = allNodes[i];
            let p2 = allNodes[i + 1];

            if (!p2) {
                let steps = CURVE_STEPS;
                for (let s = 1; s <= steps; s++) {
                    let t = s / steps;
                    let x = p0.x + (p1.x - p0.x) * t;
                    let y = p0.y + (p1.y - p0.y) * t;

                    let heading = p0.heading; //constant
                    if (hType === "linear") heading = lerpAngle(p0.heading, p1.heading, t);
                    else if (hType === "tangential") {
                        if (Math.hypot(y - prevY, x - prevX) > 0.001) heading = Math.atan2(y - prevY, x - prevX);
                        else heading = lastHeading;
                    }

                    path.push({ x, y, heading, mode: "curve" });
                    prevX = x; prevY = y; lastHeading = heading;
                }
                i++;
            } else {
                const steps = SPLINE_STEPS;
                for (let t = 1 / steps; t <= 1; t += 1 / steps) {
                    let x = ((1 - t) ** 2) * p0.x + 2 * (1 - t) * t * p1.x + (t ** 2) * p2.x;
                    let y = ((1 - t) ** 2) * p0.y + 2 * (1 - t) * t * p1.y + (t ** 2) * p2.y;

                    let heading = p0.heading; //constant
                    if (hType === "linear") heading = lerpAngle(p0.heading, p2.heading, t);
                    else if (hType === "tangential") {
                        if (Math.hypot(y - prevY, x - prevX) > 0.001) heading = Math.atan2(y - prevY, x - prevX);
                        else heading = lastHeading;
                    }

                    path.push({ x, y, heading, mode: "curve" });
                    prevX = x; prevY = y; lastHeading = heading;
                }
                i += 2;
            }
        }
        else if (mode === "spline") {
            let pt0 = allNodes[i - 2] || p0; //pt before
            let pt1 = p0;//start sgmt
            let pt2 = currNode; //end sgmt
            let pt3 = allNodes[i + 1] || pt2;//pt after

            const steps = SPLINE_STEPS;
            for (let s = 1; s <= steps; s++) {
                let t = s / steps;
                let t2 = t ** 2;
                let t3 = t2 * t;

                //catmull-rom formula adapted for piecewise sgmts
                let x = 0.5 * (2 * pt1.x + (-pt0.x + pt2.x) * t + (2 * pt0.x - 5 * pt1.x + 4 * pt2.x - pt3.x) * t2 + (-pt0.x + 3 * pt1.x - 3 * pt2.x + pt3.x) * t3);
                let y = 0.5 * (2 * pt1.y + (-pt0.y + pt2.y) * t + (2 * pt0.y - 5 * pt1.y + 4 * pt2.y - pt3.y) * t2 + (-pt0.y + 3 * pt1.y - 3 * pt2.y + pt3.y) * t3);

                let heading = pt1.heading; //constant
                if (hType === "linear") heading = lerpAngle(pt1.heading, pt2.heading, t);
                else if (hType === "tangential") {
                    if (Math.hypot(y - prevY, x - prevX) > 0.001) heading = Math.atan2(y - prevY, x - prevX);
                    else heading = lastHeading;
                }

                path.push({ x, y, heading, mode: "spline" });
                prevX = x; prevY = y; lastHeading = heading;
            }
            i++;
        }
    }
    return path;
}

function setCtxStyle(ctx, mode) {
    if (mode === "line" || mode === "point" || mode === "start") {
        ctx.strokeStyle = "#06b6d4";
        ctx.shadowColor = "#06b6d4";
    } else if (mode === "curve") {
        ctx.strokeStyle = "#a855f7";
        ctx.shadowColor = "#a855f7";
    } else if (mode === "spline") {
        ctx.strokeStyle = "#10b981";
        ctx.shadowColor = "#10b981";
    }
    ctx.lineWidth = 1;
    ctx.shadowBlur = 6;
}

    
export function draw(ctx, canvas, waypoints, pathArray, wpRad) {
    drawGrid(ctx, canvas);

    //draw path line
    if (pathArray.length > 0) {
        let currentMode = pathArray[0].mode || "line";
        ctx.beginPath();
        setCtxStyle(ctx, currentMode);

        //convert path math (in) to ctx render (px)
        let startPix = toPix(pathArray[0].x, pathArray[0].y);
        ctx.moveTo(startPix.x, startPix.y);

        for (let i = 1; i < pathArray.length; i++) {
            let pix = toPix(pathArray[i].x, pathArray[i].y);
            ctx.lineTo(pix.x, pix.y);

            //break the stroke if mode changes
            if (pathArray[i].mode !== currentMode || i === pathArray.length - 1) {
                ctx.stroke();

                if (i < pathArray.length - 1) {
                    currentMode = pathArray[i].mode;
                    ctx.beginPath();
                    setCtxStyle(ctx, currentMode);
                    ctx.moveTo(pix.x, pix.y);
                }
            }
        }
    }

    //draw wps + heading indicators on pts
    for (let i = 0; i < waypoints.length; i++) {
        let pix = toPix(waypoints[i].x, waypoints[i].y);
        let hRad = waypoints[i].heading * (Math.PI / 180);

        //dot
        ctx.fillStyle = "#fafafa";
        ctx.beginPath();
        ctx.arc(pix.x, pix.y, wpRad, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();

        //heading indicator
        ctx.save();
        ctx.translate(pix.x, pix.y);
        ctx.rotate(-hRad); //odom uses ccw

        ctx.strokeStyle = "#10b981"; //emerald
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(wpRad * 3, 0); //points forward
        ctx.stroke();

        ctx.restore();
    }
}

export function drawRobot(ctx, pose, inchSize) {
    let pix = toPix(pose.x, pose.y);
    let pixSize = inchSize * SCALE;

    ctx.save();
    ctx.translate(pix.x, pix.y);
    ctx.rotate(-pose.heading); //odom uses ccw

    ctx.fillStyle = "rgba(39, 39, 42, 0.9)";
    ctx.strokeStyle = "#fafafa";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 8;

    ctx.beginPath();
    ctx.roundRect(-pixSize / 2, -pixSize / 2, pixSize, pixSize, 6);
    ctx.fill();
    ctx.stroke();

    //dir indicator
    ctx.fillStyle = "#10b981";
    ctx.shadowColor = "#10b981";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(pixSize / 2 - 2, 0);
    ctx.lineTo(pixSize / 4, -pixSize / 4 + 2);
    ctx.lineTo(pixSize / 4, pixSize / 4 - 2);
    ctx.fill();

    ctx.restore();
}