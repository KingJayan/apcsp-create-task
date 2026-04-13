<div align="center">
  <h2><code>KingJayan/apcsp-create-task</code></h2>
</div>

a **robot pathing simulator** that semi-mirrors PedroPathing Visualizer's functionality

made using the npm package manager, lessjs, and 4 deps


## architecture

```
@/
 ├── scripts/
 │    ├── animate.js  # updates robot position and calculates movement
 │    ├── config.js   # global configuration and canvas context settings
 │    ├── draw.js     # grid rendering, path calculation, and waypoint logic
 │    ├── main.js     # state management, ui glue, and event handling
 │    └── utils.js    # reusable helper functions for smooth math/physics
 ├── index.html       # entry point
 ├── styles.less      # source styles (glassmorphism logic)
 ├── styles.css       # compiled production styles
 └── package.json     # dependency manifest
```
### animate.js
- updates robot position on the screen
- calculates movement physics

### config.js
- houses a small set of configuration values relating to the appearance of the ctx

### draw.js
- logic for mode switching (draw vs. editing)
- draws the coordinate grid and field elements
- calculates the actual path the robot will follow
- logic for drawing and manipulating waypoints

### main.js
- glue of the project; coordinates interactions between scripts
- handles state management and sidebar syncing
- uses sortablejs for drag-and-drop point reordering
- handles undo/redo history (klona) and keyboard shortcuts

### utils.js
- contains reusable math helpers for smooth movement and vector logic


## technical stack

* **sortablejs**: enables drag-and-drop reordering for waypoint blocks
* **lucide**: provides clean, consistent iconography for the toolbar and sidebar
* **klona**: handles deep-cloning of state for robust undo/redo history
* **less.js**: handles dynamic styling with a focus on glassmorphism and micro-interactions
* **bezier-js and curve-interpolator**: used for math and calculations of the path

## key features

* **dynamic pathing**: plot complex routes with real-time spline/path previews
* **waypoint management**: drag-to-reorder, delete, and modify points via the sidebar
* **simulation control**: start, stop, and reset robot movement with high-precision tracking
* **keyboard shortcuts**: optimized for efficiency (undo, redo, mode switching)
* **responsive layout**: adaptive glass ui that works across different screen sizes


## keyboard shortcuts

| key | action |
| :--- | :--- |
| `ctrl + z` | undo last action |
| `ctrl + y` | redo last action |
| `e` | switch to edit mode |
| `space` | toggle simulation start/stop |

## clone, build run
```bash
# clone the repo
git clone https://github.com/KingJayan/apcsp-create-task
cd apcsp-create-task

# install dependencies
npm i 

# build styles (if modifying .less)
npm run build:css

# start a local server
python -m http.server
# OR
npx serve
```
deployable on just about anything. dev was on replit & vscode

## license

none; do whatever u want
<!-- distributed under the mit license. see `license` for more information. -->


## contact

jayan - @kingjayan
project link: https://github.com/KingJayan/apcsp-create-task