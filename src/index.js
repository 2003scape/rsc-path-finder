const Bitfield = require('bitfield');
const PathPainter = require('./path-painter');
const ndarray = require('ndarray');
const EasyStar = require('@misterhat/easystarjs');

// size of each sector in landscape
const SECTOR_WIDTH = 48;
const SECTOR_HEIGHT = 48;

// width and height of each tile on the binary grid
const TILE_SIZE = 2;

// gaps between planes
const GAP_SIZE = 80;

// wall object IDs
const DOORFRAME = 1;
const DOOR = 2;

class PathFinder {
    constructor(config, landscape) {
        this.gameObjects = config.objects;
        this.wallObjects = config.wallObjects;
        this.tiles = config.tiles;

        this.minX = landscape.minRegionX;
        this.maxX = landscape.maxRegionX;
        this.minY = landscape.minRegionY;
        this.maxY = landscape.maxRegionY;
        this.deltaX = this.maxX - this.minX;
        this.deltaY = this.maxY - this.minY;

        this.width = (this.deltaX + 1) * SECTOR_WIDTH * TILE_SIZE;
        this.height = (this.deltaY + 1) * SECTOR_HEIGHT * TILE_SIZE;
        this.depth = landscape.depth;
        this.height *= this.depth;
        this.height += GAP_SIZE * (this.depth - 1);

        this.obstacleField = new Bitfield(this.width * this.height);
        this.obstacles = ndarray(this.obstacleField, [this.width, this.height]);
        this.parseLandscape(landscape);

        this.easystar = new EasyStar.js();
        this.easystar.setGrid(this.obstacles);
        this.easystar.setAcceptableTiles([0]);
        this.easystar.disableCornerCutting();
        this.easystar.enableDiagonals();
        this.easystar.setIterationsPerCalculation(1000);
        this.easystar.enableParallelCompute();

        this.running = false;
        this.pathsRemaining = 0;
        this.boundTick = this.tick.bind(this);
    }

    // convert the landscape into obstacle map.
    parseLandscape(landscape) {
        for (let z = 0; z < this.depth; z += 1) {
            for (let x = 0; x <= this.deltaX; x += 1) {
                for (let y = 0; y <= this.deltaY; y += 1) {
                    const sector =
                        landscape.sectors[x + this.minX][y + this.minY][z];
                    this.addSector(sector, this.deltaX - x, y, z);
                }
            }
        }
    }

    // parse the tile overlays and walls in each sector
    addSector(sector, sectorX, sectorY, sectorZ) {
        const yOffset =
            (sectorZ * SECTOR_HEIGHT * this.deltaY) +
            (sectorZ * GAP_SIZE);

        for (let x = 0; x < SECTOR_WIDTH; x += 1) {
            for (let y = 0; y < SECTOR_HEIGHT; y += 1) {
                if (sector) {
                    const tile = sector.tiles[x][y];

                    this.addTile(
                        tile,
                        ((sectorX * SECTOR_WIDTH) + x),
                        ((sectorY * SECTOR_HEIGHT) + y) + yOffset);
                } else {
                    // empty sector
                    this.fillTile(
                        ((sectorX * SECTOR_WIDTH) + x) * TILE_SIZE,
                        (((sectorY * SECTOR_HEIGHT) + y) + yOffset) *
                        TILE_SIZE);
                }
            }
        }
    }

    // place a tile with wall or overlays
    addTile(tile, x, y) {
        if (tile.overlay) {
            const tileDef = this.tiles[tile.overlay - 1];

            if (tileDef.blocked) {
                this.fillTile(x * TILE_SIZE, y * TILE_SIZE);
                return;
            }
        }

        x = (this.width / TILE_SIZE) - x - 1;

        const diagonal = tile.wall.diagonal;

        if (diagonal) {
            this.addWallObject({
                id: diagonal.overlay - 1,
                x, y,
                direction: diagonal.direction === '\\' ? 2 : 3
            });
        }

        const vertical = tile.wall.vertical;

        if (vertical) {
            this.addWallObject({
                id: vertical - 1,
                x, y,
                direction: 1
            });
        }

        const horizontal = tile.wall.horizontal;

        if (horizontal) {
            this.addWallObject({
                id: horizontal - 1,
                x, y,
                direction: 0
            });
        }
    }

    // (un)fill a TILE_SIZE^2 in the binary grid entirely. used for diagonals
    // and game objects
    fillTile(x, y, set = true) {
        for (let i = x; i < (x + TILE_SIZE); i += 1) {
            for (let j = y; j < (y + TILE_SIZE); j += 1) {
                this.obstacles.set(i, j, set);
            }
        }
    }

    // convert game position to obstacle map coordinates
    gameCoordsToObstacleCoords({ x, y }) {
        x = (this.width - ((x + 1) * TILE_SIZE));
        y = (y * TILE_SIZE);

        return { x, y };
    }

    // add door and blocked objects of varying sizes defined in definitions.
    // door-type objects are treated as DOOR and DOORFRAME wallobjects,
    // objects will take up entire tile(s) depending on their width and height.
    addObject({ id, x, y, direction }) {
        const objectDef = this.gameObjects[id];

        if (objectDef.type === 'unblocked') {
            return;
        }

        if (/door$/i.test(objectDef.type)) {
            let dx = 0;
            let dy = 0;

            if (direction === 0) {
                direction = 1;
                dy = 1;
            } else if (direction === 2) {
                direction = 0;
                y += 1;
                dx = 1;
            } else if (direction === 4) {
                direction = 1;
                x += 1;
                dy = 1;
            } else if (direction === 6) {
                direction = 0;
                dx = 1;
            } else if (direction === 5 || direction === 7) {
                // \
                direction = 2;
                y += 1;
                x -= 1;
                dx = -1;
                dy = 1;
            }

            for (let i = 0; i < objectDef.height; i += 1) {
                this.addWallObject({
                    id: objectDef.type === 'closed-door' ? DOOR : DOORFRAME,
                    x: x + (dx * i),
                    y: y + (dy * i),
                    direction
                });
            }

            return;
        }

        ({ x, y } = this.gameCoordsToObstacleCoords({x, y}));

        if (y >= this.height || x >= this.width) {
            return;
        }

        let { width, height } = objectDef;

        if (direction === 6 || direction === 2) {
            [width, height] = [height, width];
        }

        for (let i = 0; i < width; i += 1) {
            for (let j = 0; j < height; j += 1) {
                this.fillTile(x + (-i * TILE_SIZE), y + (j * TILE_SIZE));
            }
        }
    }

    // add wall overlays from the client landscape, as well as
    // wallobject/decorations/boundaries from server definitions.
    addWallObject({ id, x, y, direction }) {
        ({ x, y } = this.gameCoordsToObstacleCoords({x, y}));

        if (y >= this.height || x >= this.width) {
            return;
        }

        const wallObjectDef = this.wallObjects[id];

        if (direction === 1) {
            // vertical _
            if (wallObjectDef.blocked) {
                this.obstacles.set(x + 1, y, wallObjectDef.blocked);
            }

            this.obstacles.set(x + 1, y + 1, wallObjectDef.blocked);
        } else if (direction === 0) {
            // horizontal |
            this.obstacles.set(x, y, wallObjectDef.blocked);

            if (wallObjectDef.blocked) {
                this.obstacles.set(x + 1, y, wallObjectDef.blocked);
            }
        } else if (direction === 2 || direction === 3) {
            // \
            this.fillTile(x, y, wallObjectDef.blocked);
        }
    }

    // convert a step with absolute coordinates on the obstacle map to game
    // coordinates
    stepToGameCoords({ x, y }) {
        x = Math.floor((this.width - x - 1) / TILE_SIZE);
        y = Math.floor(y / TILE_SIZE);

        return { x, y };
    }

    // wrap easyastar in a promise
    _easystarFindPath(startPos, endPos) {
        return new Promise(resolve => {
            this.easystar.findPath(
                startPos.x, startPos.y, endPos.x, endPos.y, resolve);
        });
    }

    // convert the steps on the obstacle map to game coordinates
    obstacleStepsToGameSteps(path) {
        const steps = [];

        let lastX = -1;
        let lastY = -1;

        for (let i = 1; i < path.length; i += 1) {
            const { x, y } = this.stepToGameCoords(path[i]);

            if (x === lastX && y === lastY) {
                continue;
            }

            lastX = x;
            lastY = y;

            steps.push({ x, y });
        }

        return steps;
    }

    // check if a game coordinate is blocked by objects or horizontal walls
    isTileBlocked(gameX, gameY) {
        let { x, y } = this.gameCoordsToObstacleCoords({
            x: gameX, y: gameY
        });

        x += 1;
        y += 1;

        return this.obstacles.get(x, y);
    }

    // cut corners if no objects are in the way.
    antiAliasSteps(steps) {
        const antiAlisedSteps = [];

        antiAlisedSteps.push(steps[0]);

        for (let i = 1; i < steps.length - 1; i += 1) {
            const step = steps[i];
            let lastDx = step.x - steps[i - 1].x; // -1 right, 1 left
            let lastDy = step.y - steps[i - 1].y;
            let dx = step.x - steps[i + 1].x;
            let dy = step.y - steps[i + 1].y;

            if ((lastDx === -1 && lastDy === 0 && dx === 0 && dy === 1 &&
                !this.isTileBlocked(step.x + 1, step.y - 1)) ||
                (lastDx === 1 && lastDy === 0 && dx === 0 && dy === 1 &&
                !this.isTileBlocked(step.x - 1, step.y - 1)) ||
                (lastDx === -1 && lastDy === 0 && dx === 0 && dy === -1 &&
                !this.isTileBlocked(step.x + 1, step.y + 1)) ||
                (lastDx === 1 && lastDy === 0 && dx === 0 && dy === -1 &&
                !this.isTileBlocked(step.x - 1, step.y + 1))) {
                continue;
            }

            antiAlisedSteps.push(step);
        }

        return antiAlisedSteps;
    }

    // calculate a path between points, optionally specifying a boundary and
    // maximum cost (amount of tiles to check before quitting).
    async findPath(startPos, endPos) {
        this.pathsRemaining += 1;

        startPos = this.gameCoordsToObstacleCoords(startPos);
        startPos.x += 1;
        startPos.y += 1;

        endPos = this.gameCoordsToObstacleCoords(endPos);
        endPos.x += 1;
        endPos.y += 1;

        const path = await this._easystarFindPath(startPos, endPos);
        this.pathsRemaining -= 1;

        if (!path) {
            return [];
        }

        return this.antiAliasSteps(this.obstacleStepsToGameSteps(path));
    }

    // run a single easystar computation and call tick again.
    tick() {
        this.easystar.calculate();

        if (!this.running) {
            return;
        }

        if (this.pathsRemaining) {
            setImmediate(this.boundTick);
        } else {
            // if no paths are left, check back in 80ms rather than
            // immediately. this happens 8 times a tick
            setTimeout(this.boundTick, 80);
        }
    }

    // cease the run loop.
    stop() {
        this.running = false;
    }

    // start the run loop.
    start() {
        this.running = true;
        this.tick();
    }

    // draw our obstacle map to a black and white canvas, with our path
    // highlighted in red. useful for debugging.
    toCanvas(path) {
        const pathPainter = new PathPainter(this.obstacles);

        pathPainter.draw();

        if (path) {
            pathPainter.drawPath(path);
        }

        return pathPainter.canvas;
    }
}

module.exports.PathFinder = PathFinder;
