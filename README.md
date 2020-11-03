# rsc-path-finder
generate paths between points on a runescape classic map. each tile is
expanded into a 2x2 grid of booleans describing how the tile is blocked. this
allows for horizontal, vertical and fully-blocked tile representation
(diagonal walls are completely impassbale). once a path is found, the steps are
smoothed and converted to game coordinates.

this module is safe to use in a game loop as the computation is asynchronous.

![](./doc/legends-path.png?raw=true)

*path from Lumbridge to the Legend's Guild*

![](./doc/bandit-path.png?raw=true)

*path from Al Kharid to Bandit Camp*

![](./doc/gnome-path.png?raw=true)

*path to Tree Gnome Village entrance*


## install

    $ npm install @2003scape/rsc-path-finder

## example
```javascript
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
```

## api
### pathFinder = new PathFinder(config, landscape, tickRate = 80)
create a new pathfinding instance.

`config` in the first argument must contain definitions of game and wall objects
with at least the following:

```javascript
{
    // definitions for game objects (tree, altar, furnace, etc.)
    objects: [
        {
            type: 'unblocked' || 'blocked || 'closed-door' || 'open-door',
            width: Number,
            height: Number
        },
        // ...
    ],
    // definitions for wall objects (doors, walls, boundaries, etc.)
    wallObjects: [
        {
            blocked: true || false,
        }
        // ...
    ]
    // definitions for tiles (floors, water, roads, etc.)
    tiles: [
        {
            blocked: true || false,
        }
        // ...
    ]
}
```

[objects](https://github.com/2003scape/rsc-config#configobjects),
[wallObjects](https://github.com/2003scape/rsc-config#configwallobjects) and
[tiles](https://github.com/2003scape/rsc-config#configtiles)
are all members of an
[rsc-config](https://github.com/2003scape/rsc-config#config--new-config)
instance.

`landscape` is an instance of
[rsc-landscape](https://github.com/2003scape/rsc-landscape#landscape--new-landscape).

`tickRate` is how often (in ms) to poll for new paths to find when `findPath`
isn't active.

### pathFinder.addObject({ id, x, y, direction })
add game object to position. `id` corresponds to index in `config.objects`. if
`open-door` or `closed-door` type objects are added, replace them with door
wall objects.

### pathFinder.addWallObject({ id, x, y, direction })
add wall object to position. `id` corresponds to index in `config.wallObjects`
array. if an unblocked wall object is added, remove any existing obstacles
(door with doorframes, spider web with blank, etc.).

### pathFinder.start()
### pathFinder.stop()
enable and disable the pathfinding run loop.

### async pathFinder.findPath({ startX, startY }, { endX, endY })
find a path between startPos and endPos. returns an array of game coordinates.

### pathFinder.toCanvas(path = undefined)
create a canvas with all of the obstacles filled in with white. if path is
specified, fill the path tiles with red.

## license
Copyright 2020  2003Scape Team

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License as published by the
Free Software Foundation, either version 3 of the License, or (at your option)
any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License along
with this program. If not, see http://www.gnu.org/licenses/.
