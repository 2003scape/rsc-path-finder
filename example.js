const fs = require('fs');
const { gunzipSync } = require('zlib');
const { Config } = require('@2003scape/rsc-config');
const { Landscape } = require('@2003scape/rsc-landscape');
const { PathFinder } = require('./src');

const config = new Config();
config.loadArchive(fs.readFileSync('./config85.jag'));

const landscape = new Landscape();
landscape.loadJag(fs.readFileSync('./land63.jag'),
    fs.readFileSync('./maps63.jag'));
landscape.loadMem(fs.readFileSync('./land63.mem'),
    fs.readFileSync('./maps63.mem'));
landscape.parseArchives();

const pathFinder = new PathFinder(config, landscape);
const objectLocations =
    JSON.parse(gunzipSync(fs.readFileSync('./object-locs.json.gz')));
objectLocations.forEach(obj => pathFinder.addObject(obj));

const wallObjectLocations = require('./wallObject-locs');
wallObjectLocations.forEach(obj => pathFinder.addWallObject(obj));

// replace the taverly gate with an open gate
pathFinder.addObject({ id: 58, x: 341, y: 487, direction: 4 });

// close the door in gertrude's house
pathFinder.addWallObject({ id: 2, x: 163, y: 513, direction: 1 });
// open it again
// pathFinder.addWallObject({ id: 1, x: 163, y: 513, direction: 1 });

pathFinder.start();

(async () => {
    const path = await pathFinder.findPath(
        { x: 126, y: 655 },
        { x: 513, y: 552 });
        //{ x: 72, y: 694 },
        //{ x: 320, y: 290 });
        //{ x: 672, y: 718 },
        //{ x: 634, y: 706 });
        //{ x: 138, y: 1594 },
        //{ x: 131, y: 1602 });
    console.log('found path to legends guild', path.length);

    fs.writeFileSync('./legends-path.png',
        pathFinder.toCanvas(path).toBuffer());

    pathFinder.stop();
})();
