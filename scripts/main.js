//main.js

import { draw, generatePath, drawRobot, toInch, toPix } from './draw.js';
import { updRobot } from './animate.js';
import { ROBOT_SPEED, ROBOT_SIZE, WP_RADIUS } from './config.js';

const canvas = document.getElementById("ctx");
const ctx = canvas.getContext("2d");

//state vars
const startPose = { x: -48, y: -48, heading: 90 };
let waypoints = []; //user pts
let pathArray = []; //array to calc path
let wpRad = WP_RADIUS;

const robot = {
    pose: { ...startPose, heading: startPose.heading * (Math.PI / 180) },
    speed: ROBOT_SPEED,
    isMoving: false,
    t: 0, //curr index in path[]
    size: ROBOT_SIZE
};

const state = ["editing", "running", "stopped"];
let currState = "stopped";

const mode = ["point", "line", "curve", "spline"];
let currMode = "line";

let mouse = { x: 0, y: 0 };

//toolbar UI elements
const startBtn = document.getElementById('btn-start');
const stopBtn = document.getElementById('btn-stop');
const modeButtons = {
    line: document.getElementById('btn-line'),
    curve: document.getElementById('btn-curve'),
    spline: document.getElementById('btn-spline')
};

//draw vs edit toggle
const drawModeBtn = document.getElementById('btn-mode-draw');
const editModeBtn = document.getElementById('btn-mode-edit');

let isEditMode = false; //false = draw, true = edit

drawModeBtn.addEventListener("click", () => {
    isEditMode = false;
    drawModeBtn.classList.add("active");
    editModeBtn.classList.remove("active");
    canvas.style.cursor = "crosshair";
});

editModeBtn.addEventListener("click", () => {
    isEditMode = true;
    editModeBtn.classList.add("active");
    drawModeBtn.classList.remove("active");
    canvas.style.cursor = "default";
});

//sidebar UI elements
const startXInput = document.getElementById('start-x');
const startYInput = document.getElementById('start-y');
const startHInput = document.getElementById('start-h');
const pathBlocksContainer = document.getElementById('path-blocks');
const robotPosDisplay = document.getElementById('robot-pos-display');

//init start pose inputs
startXInput.value = startPose.x;
startYInput.value = startPose.y;
startHInput.value = startPose.heading;

//listen for startpose input changes
[startXInput, startYInput, startHInput].forEach(input => {
    input.addEventListener('input', () => {
        startPose.x = parseFloat(startXInput.value) || 0;
        startPose.y = parseFloat(startYInput.value) || 0;
        startPose.heading = parseFloat(startHInput.value) || 0;

        //keep robot preview synced with start pose when editing
        if (currState !== "running") {
            robot.pose.x = startPose.x;
            robot.pose.y = startPose.y;
            robot.pose.heading = startPose.heading * (Math.PI / 180);
        }

        updatePath();
    });
});

//upd the list of pts
function renderSidebarBlocks() {
    pathBlocksContainer.innerHTML = '';

    //pre-calculate semantic roles so we know which points are controls/ends
    let wpLabels = [];
    let i = 0;
    while (i < waypoints.length) {
        let wp = waypoints[i];
        if (wp.type === 'delay') {
            wpLabels[i] = 'Wait Action';
            i++;
        } else if (wp.mode === 'curve') {
            wpLabels[i] = 'Curve Control Pt'; // 1st click is off-path control
            if (i + 1 < waypoints.length && waypoints[i + 1].type !== 'delay') {
                wpLabels[i + 1] = 'Curve End Pt'; // 2nd click is path endpoint
                i += 2;
            } else {
                i++;
            }
        } else if (wp.mode === 'spline') {
            wpLabels[i] = 'Spline Node';
            i++;
        } else {
            wpLabels[i] = 'Line Endpoint';
            i++;
        }
    }

    //render the blocks using the calculated labels
    waypoints.forEach((wp, index) => {
        const block = document.createElement('div');
        block.className = `path-block ${wp.type === 'delay' ? 'delay-block' : ''}`;
        block.draggable = true;
        block.dataset.index = index;

        let label = wpLabels[index];
        let tagColor = "#a1a1aa";
        if (wp.mode === 'line') tagColor = "#06b6d4";
        if (wp.mode === 'curve') tagColor = "#a855f7";
        if (wp.mode === 'spline') tagColor = "#10b981";

        if (wp.type === 'delay') {
            block.innerHTML = `
<div class="path-block-header">
    <span>${index + 1}. <span style="color:#f59e0b; font-weight:normal;">${label}</span></span>
    <button class="btn-icon delete-btn" data-index="${index}">Remove</button>
</div>
<div class="input-row">
    <div class="input-group">
    <label>Time (ms):</label>
    <input type="number" class="input wp-delay" data-index="${index}" value="${wp.ms || 1000}">
    </div>
</div>
`;
        } else {
            const isHeadingUsed = wp.headingInterp === "linear" || !wp.headingInterp;
            const opacityStyle = isHeadingUsed ? "1" : "0.3";
            const pointerEvents = isHeadingUsed ? "auto" : "none";
            block.innerHTML = `
<div class="path-block-header">
    <span>${index + 1}. <span style="color:${tagColor}; font-weight:normal;">${label}</span></span>
    <button class="btn-icon delete-btn" data-index="${index}">Remove</button>
</div>
<div class="input-row">
    <div class="input-group">
    <label>X:</label>
    <input type="number" class="input wp-x" data-index="${index}" value="${Math.round(wp.x)}">
</div>
<div class="input-group">
    <label>Y:</label>
    <input type="number" class="input wp-y" data-index="${index}" value="${Math.round(wp.y)}">
</div>
<div class="input-group" style="opacity: ${opacityStyle}; pointer-events: ${pointerEvents}; transition: opacity 0.2s;">
    <label>H°:</label>
    <input type="number" class="input wp-h" data-index="${index}" value="${Math.round(wp.heading)}">
</div>
</div>
<div class="input-row" style="margin-top: 8px;">
    <div class="input-group">
        <label>Heading Interp:</label>
        <select class="custom-select wp-interp" data-index="${index}">
            <option value="linear" ${wp.headingInterp === 'linear' ? 'selected' : ''}>Linear</option>
            <option value="tangential" ${wp.headingInterp === 'tangential' ? 'selected' : ''}>Tangential</option>
            <option value="constant" ${wp.headingInterp === 'constant' ? 'selected' : ''}>Constant</option>
        </select>
    </div>
</div>
`;
        }

        // Setup HTML5 drag events
        block.addEventListener('dragstart', (e) => {
            block.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', index);
        });

        block.addEventListener('dragend', () => {
            block.classList.remove('dragging');

            const newWaypoints = [];
            document.querySelectorAll('.path-block').forEach(b => {
                const originalIdx = parseInt(b.dataset.index);
                newWaypoints.push(waypoints[originalIdx]);
            });

            waypoints = newWaypoints;
            updatePath();
            renderSidebarBlocks();
        });

        pathBlocksContainer.appendChild(block);
    });

    // attach listeners
    document.querySelectorAll('.wp-x').forEach(input => {
        input.addEventListener('input', (e) => {
            const idx = e.target.getAttribute('data-index');
            waypoints[idx].x = parseFloat(e.target.value) || 0;
            updatePath();
        });
    });
    document.querySelectorAll('.wp-y').forEach(input => {
        input.addEventListener('input', (e) => {
            const idx = e.target.getAttribute('data-index');
            waypoints[idx].y = parseFloat(e.target.value) || 0;
            updatePath();
        });
    });
    document.querySelectorAll('.wp-h').forEach(input => {
        input.addEventListener('input', (e) => {
            const idx = e.target.getAttribute('data-index');
            waypoints[idx].heading = parseFloat(e.target.value) || 0;
            updatePath();
        });
    });
    document.querySelectorAll('.wp-delay').forEach(input => {
        input.addEventListener('input', (e) => {
            const idx = e.target.getAttribute('data-index');
            waypoints[idx].ms = parseInt(e.target.value) || 0;
            updatePath();
        });
    });
    document.querySelectorAll('.wp-interp').forEach(select => {
        select.addEventListener('change', (e) => {
            const idx = e.target.getAttribute('data-index');
            waypoints[idx].headingInterp = e.target.value;
            updatePath();
            renderSidebarBlocks();
        });
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.target.getAttribute('data-index');
            waypoints.splice(idx, 1);
            updatePath();
            renderSidebarBlocks();
        });
    });
}

// allows dropping between blocks in the container
pathBlocksContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    const draggingBlock = document.querySelector('.dragging');
    if (!draggingBlock) return;

    const afterElement = getDragAfterElement(pathBlocksContainer, e.clientY);
    if (afterElement == null) {
        pathBlocksContainer.appendChild(draggingBlock);
    } else {
        pathBlocksContainer.insertBefore(draggingBlock, afterElement);
    }
});

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.path-block:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
        else return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

document.getElementById('btn-add-delay').addEventListener('click', () => {
    waypoints.push({ type: 'delay', ms: 1000 });
    updatePath();
    renderSidebarBlocks();
});

document.addEventListener('keydown', (event) => {
    if (event.key === "space") {
        event.preventDefault();
        if (currState === "running") {
            currState = "stopped";
            robot.isMoving = false;
        } else {
            currState = "running";
            robot.isMoving = true;
            robot.t = 0;
        }
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === "e") {
        event.preventDefault();
        isEditMode = true;
    } else if (event.key === "d") {
        event.preventDefault();
        isEditMode = false;
    }
});

document.addEventListener('keydown', (e) =>{
    if (e.key === "control" && e.key === "z") {
        e.preventDefault();
        waypoints.pop();
        updatePath();
    }
});

function updatePath() {
    const drawPose = {
        ...startPose,
        heading: startPose.heading * (Math.PI / 180),
        mode: 'start',
        type: 'waypoint'
    };

    let finalPath = [];
    let currentChunk = [drawPose];

    waypoints.forEach(wp => {
        if (wp.type === 'delay') {
            // generate physics nodes for everything before the delay
            if (currentChunk.length > 1) {
                let chunkPath = generatePath(currentChunk);
                if (finalPath.length > 0) chunkPath.shift(); // prevent overlapping endpoints
                finalPath.push(...chunkPath);
                currentChunk = [currentChunk[currentChunk.length - 1]];
            }

            // inject a 0-distance wait node holding the last known state
            let lastP = finalPath.length > 0 ? finalPath[finalPath.length - 1] : drawPose;
            finalPath.push({ ...lastP, type: 'delay', ms: wp.ms || 1000, mode: lastP.mode });
        } else {
            currentChunk.push({
                ...wp,
                heading: wp.heading * (Math.PI / 180),
                type: 'waypoint'
            });
        }
    });

    // flush remaining chunk
    if (currentChunk.length > 1) {
        let chunkPath = generatePath(currentChunk);
        if (finalPath.length > 0) chunkPath.shift();
        finalPath.push(...chunkPath);
    } else if (finalPath.length === 0) {
        finalPath = [drawPose];
    }

    pathArray = finalPath;

    if (robotPosDisplay && currState !== "running") {
        robotPosDisplay.innerText = `X: ${drawPose.x.toFixed(1)} Y: ${drawPose.y.toFixed(1)} Heading: ${startPose.heading}°`;
    }
}

//visual indicator helper
function updateIndicator() {
    const indicatorText = document.getElementById('txt-indicator');
    const statusContainer = document.querySelector('.status');

    if (indicatorText && statusContainer) {
        if (currState === "running") {
            indicatorText.textContent = "Running...";
            statusContainer.classList.add("online");
        } else {
            indicatorText.textContent = "Stopped";
            statusContainer.classList.remove("online");
        }
    }
}


//btn listeners
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

    //snap robot back to start when pressed
    robot.pose.x = startPose.x;
    robot.pose.y = startPose.y;
    robot.pose.heading = startPose.heading * (Math.PI / 180);
    robot.delayStart = null;

    updatePath();
    updateIndicator();
});

//func to handle mode switching, update btn visuals
function setMode(newMode) {
    currMode = newMode;

    //switch active class
    Object.values(modeButtons).forEach(btn => btn.classList.remove("active"));
    modeButtons[newMode].classList.add("active");
    console.log("Mode:", currMode);

    updatePath();//recalc path when mode changes
}

modeButtons.line.addEventListener("click", () => setMode("line"));
modeButtons.curve.addEventListener("click", () => setMode("curve"));
modeButtons.spline.addEventListener("click", () => setMode("spline"));


//drag state vars
let draggedIdx = null; // -1 for start, 0+ for wp
let isDragging = false;

canvas.addEventListener("mousedown", (e) => {
    if (currState === "running" || !isEditMode) return; //only grab in edit mode
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    draggedIdx = null;

    //check start pose first
    let spPix = toPix(startPose.x, startPose.y);
    if (Math.hypot(clickX - spPix.x, clickY - spPix.y) < wpRad + 15) {
        draggedIdx = -1;
        isDragging = true;
        return;
    }

    //check waypoints
    for (let i = 0; i < waypoints.length; i++) {
        let wpPix = toPix(waypoints[i].x, waypoints[i].y);
        if (Math.hypot(clickX - wpPix.x, clickY - wpPix.y) < wpRad + 15) {
            draggedIdx = i;
            isDragging = true;
            return;
        }
    }
});

canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;

    if (isDragging && draggedIdx !== null && isEditMode) {
        canvas.style.cursor = "grabbing";
        const inchPos = toInch(mouse.x, mouse.y);

        //shift + drag to rotate heading
        if (e.shiftKey) {
            let center = draggedIdx === -1 ? startPose : waypoints[draggedIdx];
            let dy = inchPos.y - center.y;
            let dx = inchPos.x - center.x;
            let angleDeg = Math.round(Math.atan2(dy, dx) * (180 / Math.PI));

            if (draggedIdx === -1) {
                startPose.heading = angleDeg;
                startHInput.value = angleDeg;
                if (currState !== "running") robot.pose.heading = angleDeg * (Math.PI / 180);
            } else {
                waypoints[draggedIdx].heading = angleDeg;
                let hInput = document.querySelector(`.wp-h[data-index="${draggedIdx}"]`);
                if (hInput) hInput.value = angleDeg;
            }
        } else {
            //normal drag to translate
            if (draggedIdx === -1) {
                startPose.x = inchPos.x;
                startPose.y = inchPos.y;
                startXInput.value = Math.round(startPose.x);
                startYInput.value = Math.round(startPose.y);
                if (currState !== "running") {
                    robot.pose.x = startPose.x;
                    robot.pose.y = startPose.y;
                }
            } else {
                waypoints[draggedIdx].x = inchPos.x;
                waypoints[draggedIdx].y = inchPos.y;

                let xInput = document.querySelector(`.wp-x[data-index="${draggedIdx}"]`);
                let yInput = document.querySelector(`.wp-y[data-index="${draggedIdx}"]`);
                if (xInput) xInput.value = Math.round(inchPos.x);
                if (yInput) yInput.value = Math.round(inchPos.y);
            }
        }
        updatePath();
    } else if (currState !== "running") {
        if (isEditMode) {
            //hover effect only in edit mode
            let hovering = false;
            let spPix = toPix(startPose.x, startPose.y);
            if (Math.hypot(mouse.x - spPix.x, mouse.y - spPix.y) < wpRad + 15) hovering = true;
            else {
                for (let i = 0; i < waypoints.length; i++) {
                    let wpPix = toPix(waypoints[i].x, waypoints[i].y);
                    if (Math.hypot(mouse.x - wpPix.x, mouse.y - wpPix.y) < wpRad + 15) hovering = true;
                }
            }
            canvas.style.cursor = hovering ? "grab" : "default";
        } else {
            canvas.style.cursor = "crosshair"; //draw mode indicator
        }
    }
});

canvas.addEventListener("mouseup", (e) => {
    if (currState === "running") return;

    //only add pts if we are in draw mode
    if (!isEditMode) {
        const inchPos = toInch(mouse.x, mouse.y);
        let lastHeading = waypoints.length > 0 ? waypoints[waypoints.length - 1].heading : startPose.heading;

        waypoints.push({ x: inchPos.x, y: inchPos.y, heading: lastHeading, mode: currMode, headingInterp: "linear", type: "waypoint" });
        updatePath();
        renderSidebarBlocks();
    }

    isDragging = false;
    draggedIdx = null;
    if (currState !== "running") canvas.style.cursor = isEditMode ? "default" : "crosshair";
});

canvas.addEventListener("mouseleave", () => {
    isDragging = false;
    draggedIdx = null;
    canvas.style.cursor = "default";
});

//init generation
updatePath();
renderSidebarBlocks();
updateIndicator();

function animate() {
    //calc new pose
    if (currState === "running") {
        updRobot(robot, pathArray)

        if (robotPosDisplay) {
            let degHeading = robot.pose.heading * (180 / Math.PI);
            robotPosDisplay.innerText = `X: ${robot.pose.x.toFixed(1)} Y: ${robot.pose.y.toFixed(1)} Heading: ${degHeading.toFixed(0)}°`;
        }

        if (!robot.isMoving) {
            currState = "stopped";
            updateIndicator();
        }
    }

    //render everything
    draw(ctx, canvas, [startPose, ...waypoints], pathArray, wpRad, currMode);
    drawRobot(ctx, robot.pose, robot.size);

    requestAnimationFrame(animate);
}

animate();