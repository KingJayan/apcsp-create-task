<p style="font-size:3rem;"><code>ap csp create task</code></p>

a **robot pathing simulator** that semi-mirrors PedroPathing Visualizer's functionality

made using the npm package manager, lessjs, and 4 deps


## architecture

```
@/
 scripts/
    animate.js
    config.js
    draw.js
    main.js
    utils.js
 index.html (main file)
 styles.css
 styles.less
 package.json
```
### animate.js
- updates robot position on the screen
- calculates movement

### config.js
- houses a small set of configuration values, relating to the appearance of the ctx

### draw.js
- logic for mode switching
- draws the grid on the ctx
- calculates the actual path the robot will follow
- logic for drawing and editing waypoints

### main.js
- glue of the project
- handles state management, sidebar, ui class switching for active states
- uses sortablejs for drag-and-drop points list
- updates ui
- handles undo/redo history(klona), and keyboard shortcuts

### utils.js
- contains reusable helper functions for smooth movement


## run
```bash
npm i #install deps
npm run build:css #update styles.css when updating less
python -m http.server #static application, 
```