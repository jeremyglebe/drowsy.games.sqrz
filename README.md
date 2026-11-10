# sqrz
Game about connecting squares. Making for Software Tools class.

**Play it at [sqrz.drowsy.games](https://sqrz.drowsy.games)**

Host a game, send your friends the 4-letter room code (or click the code to copy an invite link), and take turns connecting dots. Close a square to score and go again. When the grid is full, the player with the most squares wins.

## How it works
sqrz originally ran on a Node server with socket.io. It now runs **peer-to-peer with [PeerJS](https://peerjs.com)**:

+ The player who clicks **Host Game** runs the game logic in their browser (`ts/services/HostService.ts`, which is the old `server.js` logic).
+ Their browser registers a PeerJS id built from the room code, and other players connect directly to it over WebRTC (`ts/services/NetworkService.ts`).
+ `NetworkService` has the same `on` / `emit` API the game used with socket.io, so the Phaser states barely had to change.
+ If the host leaves, the game ends for everyone.

No game server is needed, so the whole thing is static files and can be hosted on GitHub Pages.

## Running locally
```
npm install
npm run build    # compile ts/ into js/ (or `npm run watch`)
npm start        # serves the game at http://localhost:8081
```
Open it in two browser windows to play against yourself.

## Hosting
The compiled `js/` folder is committed, so GitHub Pages can serve the repo root directly (Settings → Pages → Deploy from branch → `master` / root). The `CNAME` file points it at `sqrz.drowsy.games`.

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
    + ~~Utilizes Socket effectively~~ Now peer-to-peer with PeerJS
    + Connections between server & clients is properly established
    + Semi-synchronized. Turn-based. All players get updates after every turn.
    + Action queue accounts for connect/disconnect (Prevent unlimited turns)
    + Track player scores
