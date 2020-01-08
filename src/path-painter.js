let createCanvas;

try {
    createCanvas = require('canvas').createCanvas;
} catch (e) {
}

const TILE_SIZE = 2;

class PathPainter {
    constructor(map) {
        this.map = map;
        [ this.width, this.height ] = map.shape;

        this.canvas = createCanvas(this.width, this.height);
        this.ctx = this.canvas.getContext('2d');
    }

    drawPath(path) {
        this.ctx.fillStyle = '#f00';

        for (const { x, y } of path) {
            this.ctx.fillRect(
                this.width - ((x + 1) * TILE_SIZE),
                y * TILE_SIZE,
                TILE_SIZE,
                TILE_SIZE);
        }
    }

    draw() {
        for (let x = 0; x < this.width; x += 1) {
            for (let y = 0; y < this.height; y += 1) {
                const filled = this.map.get(x, y);
                this.ctx.fillStyle = filled ? '#fff' : '#000';
                this.ctx.fillRect(x, y, 1, 1);
            }
        }
    }
}

module.exports = PathPainter;
