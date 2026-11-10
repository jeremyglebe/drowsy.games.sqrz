# sqrz
Game about connecting squares. Making for Software Tools class.

Play at https://sqrz.drowsy.games

## How to play
One player clicks Host Game and gets a 4-letter room code. Other players enter the code and click Join, or open the invite link (`?room=CODE`), which goes straight to the lobby. In the lobby the host picks a board size from 2x2 to 10x10 and clicks Start Game. Any number of players can join, but you need at least 2.

The How to Play button on the menu explains the rules with examples.

Players take turns drawing a line between two neighboring dots. Closing a square scores a point and gives you another turn. The game ends when the grid is full. The player with the most squares wins.

## How it works
The game used to run on a Node server with socket.io. It now uses PeerJS, so players connect to each other directly.

+ The host's browser runs the game logic in `ts/services/HostService.ts`. This is the old `server.js` code.
+ `ts/services/NetworkService.ts` registers the host with PeerJS under the room code and connects guests to it. It has the same `on`/`emit` API as socket.io.
+ Closing the host's tab ends the game for everyone.

## Running locally
```
npm install
npm run build
npm start
```
`npm run build` compiles `ts/` into `js/`. `npm run watch` recompiles on every change. `npm start` serves the game at http://localhost:8081. Open two windows to test multiplayer.

## Hosting
GitHub Pages serves the repo root from `master`. `js/` is committed, so there is no build step. `CNAME` sets the domain to sqrz.drowsy.games.

## Requirements
+ Presentation
    + Initially presents a grid of dots
    + Players can draw lines between dots
    + Player scores should be displayed somewhere
    + Display score table after grid is completely connected
+ Gameplay
    + Players can't connect dots during other players turns
    + Players score when they connect a square
    + Players' turns end when they connect dots without creating a square
    + Game ends when grid is fully connected, player with the highest score wins
+ Server
    + Utilizes Socket effectively (replaced by PeerJS)
    + Connections between server & clients is properly established
    + Semi-synchronized. Turn-based. All players get updates after every turn.
    + Action queue accounts for connect/disconnect (Prevent unlimited turns)
    + Track player scores
