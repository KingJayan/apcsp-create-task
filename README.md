<div align="center">
  <h2><code>KingJayan/apcsp-create-task</code></h2>
</div>

>[!NOTE]
>no functionality of the code was modified after the due date of the ap csp create task

a **robot pathing simulator** that semi-mirrors PedroPathing Visualizer's functionality

made using the npm package manager, lessjs, and 4 deps

## stack

* **html, js**: static web app
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

## run it yourself
```bash
# clone the repo
git clone https://github.com/KingJayan/apcsp-create-task
cd apcsp-create-task

# install dependencies
npm i

# build styles (if modifying .less)
npm run build

# start a local server
python -m http.server
# or
npm run dev #equivalent to npx serve
```
deployable on just about anything. dev was on replit & vscode

## license

distributed under the isc license.

## contact

jayan - @kingjayan
project link: https://github.com/KingJayan/apcsp-create-task
