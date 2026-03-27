//main.js

import { draw, generatePath, drawRobot, toInch, toPix } from "./draw.js";
import { updRobot } from "./animate.js";
import { ROBOT_SPEED, ROBOT_SIZE, WP_RADIUS } from "./config.js";
import { klona } from "klona";
import Sortable from "sortablejs";

const canvas = document.getElementById("ctx");
const ctx = canvas.getContext("2d");

//state vars
const startPose = { x: -48, y: -48, heading: 90 };
let waypoints = []; 
let pathArray = []; 

let obstructions = [];
let isObsMode = false;
let obsStart = null;
let obsCurrent = null;
let draggedObs = null;

let wpRad = WP_RADIUS;

const robot = {
    pose: { ...startPose, heading: startPose.heading * (Math.PI / 180) },
    speed: ROBOT_SPEED,
    isMoving: false,
    t: 0, 
    size: ROBOT_SIZE,
};

let currState = "stopped";
let currMode = "line";
let mouse = { x: 0, y: 0 };
let isDirty = true; 

const startBtn = document.getElementById("btn-start");
const stopBtn = document.getElementById("btn-stop");
const undoBtn = document.getElementById("btn-undo");
const redoBtn = document.getElementById("btn-redo");
const modeButtons = {
    line: document.getElementById("btn-line"),
    curve: document.getElementById("btn-curve"),
    spline: document.getElementById("btn-spline"),
};

const drawModeBtn = document.getElementById("btn-mode-draw");
const editModeBtn = document.getElementById("btn-mode-edit");
const obsModeBtn = document.getElementById("btn-mode-obs");
const segmentGroup = document.getElementById("segment-group");

let isEditMode = false; 

function setWhichMode(modeType) {
    isEditMode = (modeType === 'edit');
    isObsMode = (modeType === 'obs');

    [drawModeBtn, editModeBtn, obsModeBtn].forEach(btn => btn?.classList.remove("active"));

    if (isObsMode) {
        obsModeBtn.classList.add("active");
        canvas.style.cursor = "crosshair";
        segmentGroup.style.display = "none";
    } else if (isEditMode) {
        editModeBtn.classList.add("active");
        canvas.style.cursor = "default";
        segmentGroup.style.display = "none";
    } else {
        drawModeBtn.classList.add("active");
        canvas.style.cursor = "crosshair";
        segmentGroup.style.display = "";
    }
}

let undoStack = [];
let undoStack2 = []; 
let redoStack = [];
let redoStack2 = []; 

const HISTORY_LIMIT = 200;

function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
        window.lucide.createIcons();
    }
}

function snapshot() {
    undoStack.push(klona(waypoints));
    undoStack2.push(klona(obstructions));
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    if (undoStack2.length > HISTORY_LIMIT) undoStack2.shift();
    redoStack.length = 0;
    redoStack2.length = 0;
    updateHistoryButtons();
}

function undo() {
    if (undoStack.length === 0 || undoStack2.length === 0) return;

    redoStack.push(klona(waypoints));
    redoStack2.push(klona(obstructions));

    obstructions = undoStack2.pop();
    waypoints = undoStack.pop();

    updatePath();
    renderSidebarBlocks();
    updateHistoryButtons();
    renderNow();
}

function redo() {
    if (redoStack.length === 0 || redoStack2.length === 0) return;

    undoStack2.push(klona(obstructions));
    undoStack.push(klona(waypoints));

    obstructions = redoStack2.pop();
    waypoints = redoStack.pop();

    updatePath();
    renderSidebarBlocks();
    updateHistoryButtons();
    renderNow();
}

function updateHistoryButtons() {
    if (undoBtn) undoBtn.disabled = (undoStack.length === 0 && undoStack2.length === 0);
    if (redoBtn) redoBtn.disabled = (redoStack.length === 0 && redoStack2.length === 0);
}

function updatePathStats() {
    let distIn = 0;
    let delayMs = 0;

    for (let i = 1; i < pathArray.length; i++) {
        let p0 = pathArray[i - 1];
        let p1 = pathArray[i];
        if (p1.type === "delay") {
            delayMs += p1.ms || 0;
            continue;
        }
        if (p0.type === "delay") continue;
        distIn += Math.hypot(p1.x - p0.x, p1.y - p0.y);
    }

    const driveSecs = robot.speed > 0 ? distIn / robot.speed : 0;
    const delaySecs = delayMs / 1000;
    const totalSecs = driveSecs + delaySecs;

    if (pathLengthDisplay) pathLengthDisplay.innerText = `Path: ${distIn.toFixed(2)} in`;
    if (pathTimeDisplay) pathTimeDisplay.innerText = `Est. Time: ${totalSecs.toFixed(2)} s`;
    if (pathDelayDisplay) pathDelayDisplay.innerText = `Delay: ${delaySecs.toFixed(2)} s`;
}

drawModeBtn.addEventListener("click", () => setWhichMode('draw'));
editModeBtn.addEventListener("click", () => setWhichMode('edit'));
obsModeBtn?.addEventListener("click", () => setWhichMode('obs'));

if (undoBtn) undoBtn.addEventListener("click", undo);
if (redoBtn) redoBtn.addEventListener("click", redo);

const [startXInput, startYInput, startHInput, pathBlocksContainer, robotPosDisplay, pathLengthDisplay, pathTimeDisplay, pathDelayDisplay, curveFeedback] = 
document.querySelectorAll('#start-x, #start-y, #start-h, #path-blocks, #robot-pos-display, #path-length, #path-time, #path-delay, #curve-feedback');

document.addEventListener("pointermove", (e) => {
    const surface = e.target.closest(".group, .sidebar, .path-block, .input-group, .status, .mode-hint");
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    surface.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    surface.style.setProperty("--my", `${e.clientY - rect.top}px`);
});

startXInput.value = startPose.x;
startYInput.value = startPose.y;
startHInput.value = startPose.heading;

[startXInput, startYInput, startHInput].forEach((input) => {
    input.addEventListener("input", () => {
        startPose.x = parseFloat(startXInput.value) || 0;
        startPose.y = parseFloat(startYInput.value) || 0;
        startPose.heading = parseFloat(startHInput.value) || 0;

        if (currState !== "running") {
            robot.pose.x = startPose.x;
            robot.pose.y = startPose.y;
            robot.pose.heading = startPose.heading * (Math.PI / 180);
        }
        updatePath();
    });
});

function buildWpLabels() {
    let wpLabels = [];
    let i = 0;
    while (i < waypoints.length) {
        let wp = waypoints[i];
        if (wp.type === "delay") {
            wpLabels[i] = "Wait Action";
            i++;
        } else if (wp.mode === "curve") {
            let c2 = waypoints[i + 1];
            let endPt = waypoints[i + 2];
            wpLabels[i] = "Curve Control 1";
            if (c2 && c2.type !== "delay" && endPt && endPt.type !== "delay") {
                wpLabels[i + 1] = "Curve Control 2";
                wpLabels[i + 2] = "Curve End Pt";
                i += 3;
            } else if (c2 && c2.type !== "delay") {
                wpLabels[i + 1] = "Curve Control 2";
                i += 2;
            } else {
                i++;
            }
        } else if (wp.mode === "spline") {
            wpLabels[i] = "Spline Node";
            i++;
        } else {
            wpLabels[i] = "Line Endpoint";
            i++;
        }
    }
    return wpLabels;
}

function attachSidebarListeners() {
    const updateWp = (e, key, isFloat = true) => {
        const idx = parseInt(e.target.getAttribute("data-index"), 10);
        const val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
        if (e.type === "change") snapshot();
        waypoints[idx][key] = val || 0;
        updatePath();
    };

    document.querySelectorAll(".wp-x").forEach(el => el.addEventListener("input", e => updateWp(e, "x")));
    document.querySelectorAll(".wp-x").forEach(el => el.addEventListener("change", e => updateWp(e, "x")));
    document.querySelectorAll(".wp-y").forEach(el => el.addEventListener("input", e => updateWp(e, "y")));
    document.querySelectorAll(".wp-y").forEach(el => el.addEventListener("change", e => updateWp(e, "y")));
    document.querySelectorAll(".wp-h").forEach(el => el.addEventListener("input", e => updateWp(e, "heading")));
    document.querySelectorAll(".wp-h").forEach(el => el.addEventListener("change", e => updateWp(e, "heading")));
    document.querySelectorAll(".wp-delay").forEach(el => el.addEventListener("input", e => updateWp(e, "ms", false)));
    document.querySelectorAll(".wp-delay").forEach(el => el.addEventListener("change", e => updateWp(e, "ms", false)));

    document.querySelectorAll(".wp-interp").forEach((select) => {
        select.addEventListener("change", (e) => {
            snapshot();
            const idx = parseInt(e.target.getAttribute("data-index"), 10);
            waypoints[idx].headingInterp = e.target.value;
            updatePath();
            renderSidebarBlocks();
        });
    });
    document.querySelectorAll(".delete-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            snapshot();
            const idx = parseInt(e.currentTarget.getAttribute("data-index"), 10);
            waypoints.splice(idx, 1);
            updatePath();
            renderSidebarBlocks();
        });
    });
}

function renderSidebarBlocks() {
    const existingBlocks = [...pathBlocksContainer.querySelectorAll(".path-block")];
    const structureMatches = existingBlocks.length === waypoints.length &&
        existingBlocks.every((b, i) => {
            const wp = waypoints[i];
            return parseInt(b.dataset.index, 10) === i && b.classList.contains("delay-block") === (wp.type === "delay");
        });

    if (structureMatches) {
        waypoints.forEach((wp, index) => {
            const block = existingBlocks[index];
            if (wp.type === "delay") {
                const input = block.querySelector(".wp-delay");
                if (input && document.activeElement !== input) input.value = wp.ms || 1000;
            } else {
                const xIn = block.querySelector(".wp-x");
                const yIn = block.querySelector(".wp-y");
                const hIn = block.querySelector(".wp-h");
                const interp = block.querySelector(".wp-interp");
                if (xIn && document.activeElement !== xIn) xIn.value = Math.round(wp.x);
                if (yIn && document.activeElement !== yIn) yIn.value = Math.round(wp.y);
                if (hIn && document.activeElement !== hIn) hIn.value = Math.round(wp.heading);
                if (interp && document.activeElement !== interp) interp.value = wp.headingInterp || "linear";
                if (hIn) hIn.closest(".input-group").classList.toggle("muted", wp.headingInterp && wp.headingInterp !== "linear");
            }
        });
        return;
    }

    pathBlocksContainer.innerHTML = "";
    const wpLabels = buildWpLabels();

    waypoints.forEach((wp, index) => {
        const block = document.createElement("div");
        block.className = `path-block ${wp.type === "delay" ? "delay-block" : ""}`;
        block.dataset.index = index;
        let label = wpLabels[index];
        let color = wp.mode === "line" ? "#06b6d4" : wp.mode === "curve" ? "#a855f7" : wp.mode === "spline" ? "#10b981" : "#a1a1aa";

        if (wp.type === "delay") {
            block.innerHTML = `<div class="path-block-header"><span>${index + 1}. <span style="color:#f59e0b;">${label}</span></span><button class="btn-icon delete-btn" data-index="${index}"><i data-lucide="x"></i></button></div><div class="input-row"><div class="input-group"><label>Time (ms):</label><input type="number" class="input wp-delay" data-index="${index}" value="${wp.ms || 1000}"></div></div>`;
        } else {
            const muted = wp.headingInterp && wp.headingInterp !== "linear" ? " muted" : "";
            block.innerHTML = `<div class="path-block-header"><span>${index + 1}. <span style="color:${color};">${label}</span></span><button class="btn-icon delete-btn" data-index="${index}"><i data-lucide="x"></i></button></div><div class="input-row"><div class="input-group"><label>X:</label><input type="number" class="input wp-x" data-index="${index}" value="${Math.round(wp.x)}"></div><div class="input-group"><label>Y:</label><input type="number" class="input wp-y" data-index="${index}" value="${Math.round(wp.y)}"></div><div class="input-group${muted}"><label>H°:</label><input type="number" class="input wp-h" data-index="${index}" value="${Math.round(wp.heading)}"></div></div><div class="input-row" style="margin-top:8px;"><div class="input-group"><label>Heading Interp:</label><select class="custom-select wp-interp" data-index="${index}"><option value="linear" ${wp.headingInterp === "linear" || !wp.headingInterp ? "selected" : ""}>Linear</option><option value="tangential" ${wp.headingInterp === "tangential" ? "selected" : ""}>Tangential</option><option value="constant" ${wp.headingInterp === "constant" ? "selected" : ""}>Constant</option></select></div></div>`;
        }
        pathBlocksContainer.appendChild(block);
    });

    attachSidebarListeners();
    refreshIcons();
}

Sortable.create(pathBlocksContainer, {
    animation: 150,
    chosenClass: "dragging",
    onEnd: (e) => {
        if (e.oldIndex === e.newIndex) return;
        snapshot();
        const moved = waypoints.splice(e.oldIndex, 1)[0];
        waypoints.splice(e.newIndex, 0, moved);
        updatePath();
        renderSidebarBlocks();
    },
});

document.getElementById("btn-add-delay").addEventListener("click", () => {
    snapshot();
    waypoints.push({ type: "delay", ms: 1000 });
    updatePath();
    renderSidebarBlocks();
});

document.getElementById("btn-clear").addEventListener("click", () => {
    if (waypoints.length === 0) return;
    snapshot();
    waypoints = [];
    updatePath();
    renderSidebarBlocks();
    renderNow();
});

document.addEventListener("keydown", (e) => {
    if (["SELECT", "OPTION", "INPUT"].includes(e.target.tagName)) return;
    if (e.key === " ") {
        e.preventDefault();
        currState = currState === "running" ? "stopped" : "running";
        robot.isMoving = (currState === "running");
        if (robot.isMoving) robot.t = 0;
        updateIndicator();
    }
    if (e.key === "e") { e.preventDefault(); setWhichMode('edit'); }
    else if (e.key === "d") { e.preventDefault(); setWhichMode('draw'); }

    if (e.ctrlKey && e.key === "z") { e.preventDefault(); undo(); }
    else if ((e.ctrlKey && e.key === "y") || (e.ctrlKey && e.shiftKey && e.key === "Z")) { e.preventDefault(); redo(); }
});

function updatePath() {
    isDirty = true;
    const drawPose = { ...startPose, heading: startPose.heading * (Math.PI / 180), mode: "start", type: "waypoint" };
    let finalPath = [];
    let currentChunk = [drawPose];

    waypoints.forEach((wp) => {
        if (wp.type === "delay") {
            if (currentChunk.length > 1) {
                let chunkPath = generatePath(currentChunk);
                if (finalPath.length > 0) chunkPath.shift();
                finalPath.push(...chunkPath);
                currentChunk = [currentChunk[currentChunk.length - 1]];
            }
            let lastP = finalPath.length > 0 ? finalPath[finalPath.length - 1] : drawPose;
            finalPath.push({ ...lastP, type: "delay", ms: wp.ms || 1000, mode: lastP.mode });
        } else {
            currentChunk.push({ ...wp, heading: wp.heading * (Math.PI / 180), type: "waypoint" });
        }
    });

    if (currentChunk.length > 1) {
        let chunkPath = generatePath(currentChunk);
        if (finalPath.length > 0) chunkPath.shift();
        finalPath.push(...chunkPath);
    } else if (finalPath.length === 0) {
        finalPath = [drawPose];
    }

    pathArray = finalPath;
    updatePathStats();

    if (robotPosDisplay && currState !== "running") {
        robotPosDisplay.innerText = `X: ${drawPose.x.toFixed(1)} Y: ${drawPose.y.toFixed(1)} Heading: ${startPose.heading}°`;
    }
}

function getPendingCurve() {
    let anchor = startPose;
    let i = 0;
    while (i < waypoints.length) {
        let wp = waypoints[i];
        if (wp.type === "delay") { i++; continue; }
        if (wp.mode === "curve") {
            let c2 = waypoints[i + 1], endPt = waypoints[i + 2];
            if (c2?.type !== "delay" && endPt?.type !== "delay" && endPt) { anchor = endPt; i += 3; }
            else if (c2?.type !== "delay" && c2) return { anchor, control1: wp, control2: c2 };
            else return { anchor, control1: wp };
        } else { anchor = wp; i++; }
    }
    return null;
}

function updateIndicator() {
    const text = document.getElementById("txt-indicator");
    const container = document.querySelector(".status");
    if (!text || !container) return;
    text.textContent = currState === "running" ? "Running..." : "Stopped";
    container.classList.toggle("online", currState === "running");
}

startBtn.addEventListener("click", () => {
    if (pathArray.length > 0) {
        currState = "running";
        robot.isMoving = true;
        robot.t = 0;
        updateIndicator();
    }
});

stopBtn.addEventListener("click", () => {
    currState = "stopped";
    robot.isMoving = false;
    robot.t = 0;
    robot.pose = { ...startPose, heading: startPose.heading * (Math.PI / 180) };
    robot.delayStart = null;
    updatePath();
    updateIndicator();
});

function setSgmtMode(newMode) {
    currMode = newMode;
    Object.values(modeButtons).forEach((btn) => btn.classList.remove("active"));
    modeButtons[newMode].classList.add("active");
}

modeButtons.line.addEventListener("click", () => setSgmtMode("line"));
modeButtons.curve.addEventListener("click", () => setSgmtMode("curve"));
modeButtons.spline.addEventListener("click", () => setSgmtMode("spline"));

let draggedIdx = null; 
let isDragging = false;
let pendingSnapshot = null; 

canvas.addEventListener("mousedown", (e) => {
    if (currState === "running") return;
    const rect = canvas.getBoundingClientRect();
    const pixX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const pixY = (e.clientY - rect.top) * (canvas.height / rect.height);
    const inchPos = toInch(pixX, pixY);

    if (isObsMode) {
        obsStart = { ...inchPos };
        obsCurrent = { ...inchPos };
        return;
    }
    if (isEditMode) {
        draggedIdx = null;
        draggedObs = null;

        let spPix = toPix(startPose.x, startPose.y);
        if (Math.hypot(pixX - spPix.x, pixY - spPix.y) < wpRad + 15) {
            pendingSnapshot = klona(waypoints);
            draggedIdx = -1;
            isDragging = true;
            return;
        }

        for (let i = 0; i < waypoints.length; i++) {
            let wpPix = toPix(waypoints[i].x, waypoints[i].y);
            if (Math.hypot(pixX - wpPix.x, pixY - wpPix.y) < wpRad + 15) {
                pendingSnapshot = klona(waypoints);
                draggedIdx = i;
                isDragging = true;
                return;
            }
        }

        for (let i = 0; i < obstructions.length; i++) {
            const obs = obstructions[i];
            const tl = toPix(obs.x, obs.y + obs.h);
            const br = toPix(obs.x + obs.w, obs.y);
            if (pixX >= tl.x && pixX <= br.x && pixY >= tl.y && pixY <= br.y) {
                pendingSnapshot = klona(obstructions);
                draggedObs = i;
                isDragging = true;
                return;
            }
        }
    }
});

canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
    isDirty = true;

    if (isObsMode && obsStart) {
        obsCurrent = toInch(mouse.x, mouse.y);
    }

    if (isDragging && isEditMode) {
        if (pendingSnapshot) {
            if (draggedObs !== null) {
                undoStack2.push(pendingSnapshot);
                undoStack.push(klona(waypoints));
            } else {
                undoStack.push(pendingSnapshot);
                undoStack2.push(klona(obstructions));
            }
            redoStack.length = 0;
            redoStack2.length = 0;
            updateHistoryButtons();
            pendingSnapshot = null;
        }

        const inchPos = toInch(mouse.x, mouse.y);

        if (draggedObs !== null) {
            obstructions[draggedObs].x = inchPos.x;
            obstructions[draggedObs].y = inchPos.y;
        } else if (e.shiftKey) {
            let target = draggedIdx === -1 ? startPose : waypoints[draggedIdx];
            let angle = Math.round(Math.atan2(inchPos.y - target.y, inchPos.x - target.x) * (180 / Math.PI));
            target.heading = angle;
            if (draggedIdx === -1) {
                startHInput.value = angle;
                if (currState !== "running") robot.pose.heading = angle * (Math.PI / 180);
            } else {
                const hIn = document.querySelector(`.wp-h[data-index="${draggedIdx}"]`);
                if (hIn) hIn.value = angle;
            }
        } else {
            let target = draggedIdx === -1 ? startPose : waypoints[draggedIdx];
            target.x = inchPos.x;
            target.y = inchPos.y;
            if (draggedIdx === -1) {
                startXInput.value = Math.round(target.x);
                startYInput.value = Math.round(target.y);
                if (currState !== "running") { robot.pose.x = target.x; robot.pose.y = target.y; }
            } else {
                const xIn = document.querySelector(`.wp-x[data-index="${draggedIdx}"]`);
                const yIn = document.querySelector(`.wp-y[data-index="${draggedIdx}"]`);
                if (xIn) xIn.value = Math.round(target.x);
                if (yIn) yIn.value = Math.round(target.y);
            }
        }
        updatePath();
    } else if (currState !== "running") {
        canvas.style.cursor = isObsMode ? "crosshair" : (isEditMode ? "default" : "crosshair");
    }
});

canvas.addEventListener("mouseup", () => {
    if (currState === "running") return;

    if (isObsMode && obsStart && obsCurrent) {
        const dx = Math.abs(obsCurrent.x - obsStart.x);
        const dy = Math.abs(obsCurrent.y - obsStart.y);
        if (dx > 1 && dy > 1) {
            snapshot();
            obstructions.push({ x: Math.min(obsStart.x, obsCurrent.x), y: Math.min(obsStart.y, obsCurrent.y), w: dx, h: dy });
        }
        obsStart = null;
        obsCurrent = null;
    } else if (!isEditMode && !isObsMode) {
        snapshot();
        const pos = toInch(mouse.x, mouse.y);
        waypoints.push({ x: pos.x, y: pos.y, heading: waypoints.length ? waypoints[waypoints.length - 1].heading : startPose.heading, mode: currMode, headingInterp: "linear", type: "waypoint" });
        updatePath();
        renderSidebarBlocks();
    }

    pendingSnapshot = null;
    isDragging = false;
    draggedIdx = null;
    draggedObs = null;
});

canvas.addEventListener("mouseleave", () => {
    pendingSnapshot = null;
    isDragging = false;
    obsStart = null;
});

updatePath();
renderSidebarBlocks();
updateHistoryButtons();
updateIndicator();
refreshIcons();

function renderNow() {
    let curvePreview = null;
    if (currState !== "running" && !isEditMode && currMode === "curve") {
        const pending = getPendingCurve();
        if (pending) {
            const mInch = toInch(mouse.x, mouse.y);
            curvePreview = pending.control2 ? { ...pending, end: mInch } : { ...pending, control2: mInch, end: mInch };
        }
    }

    if (curveFeedback) {
        if (curvePreview) {
            curveFeedback.textContent = curvePreview.control2 === curvePreview.end ? "Curve mode: place control point 2" : "Curve mode: place end point";
            curveFeedback.classList.add("show");
        } else {
            curveFeedback.classList.remove("show");
        }
    }

    //pass obs data to draw module
    draw(ctx, canvas, [startPose, ...waypoints], pathArray, wpRad, curvePreview, { 
        obstructions, 
        previewRect: (isObsMode && obsStart && obsCurrent) ? {
            x: Math.min(obsStart.x, obsCurrent.x),
            y: Math.min(obsStart.y, obsCurrent.y),
            w: Math.abs(obsCurrent.x - obsStart.x),
            h: Math.abs(obsCurrent.y - obsStart.y)
        } : null 
    });
    drawRobot(ctx, robot.pose, robot.size);
}

function animate() {
    if (currState === "running") {
        updRobot(robot, pathArray);
        isDirty = true;
        if (robotPosDisplay) {
            robotPosDisplay.innerText = `X: ${robot.pose.x.toFixed(1)} Y: ${robot.pose.y.toFixed(1)} Heading: ${(robot.pose.heading * 180 / Math.PI).toFixed(0)}°`;
        }
        if (!robot.isMoving) { currState = "stopped"; updateIndicator(); }
    }
    if (isDirty) { renderNow(); isDirty = false; }
    requestAnimationFrame(animate);
}

animate();