// The game "server". This used to be server.js running on Node with socket.io;
// now it runs inside the host player's browser and talks to everyone over
// PeerJS (see NetworkService). The rules and turn queue are the same.
//
// A room starts in the lobby. The host picks a board size and starts the
// game; when the board is full it shows the scores and the host can play
// again or go back to the lobby.

interface HostClient {
    id: string;
    send(event: string, ...args: any[]): void;
}

interface HostPlayer {
    username: string;
    color: number;
    score: number;
}

class HostService {

    // Bright colours that read well on the black board, handed out in join order
    static COLORS = [0xff5d73, 0x3fa7ff, 0xffc145, 0x3ddc97, 0xb281ff, 0xff8f3f, 0x2fd4d4, 0xff6fd8];
    static MIN_SIZE = 2;
    static MAX_SIZE = 10;
    static DEFAULT_SIZE = 6;

    // Connected clients (including the host's own local client)
    clients: { [id: string]: HostClient } = {};
    // List of players
    players: { [id: string]: HostPlayer } = {};
    // Player turn queue
    queue: string[] = [];
    // Current player turn id
    plyid: string = null;
    // Current player turn username
    plyname: string = null;
    // 'lobby', 'playing' or 'over'
    phase = 'lobby';
    // Squares per side
    size = HostService.DEFAULT_SIZE;
    // Tracking the squares that have been filled (stores the owner's colour)
    squares: number[][];
    // Tracking the lines that have been connected (stores the drawer's colour)
    grid: { [key: string]: number } = {};
    private next_color = 0;

    constructor() {
        this.clear_board();
    }

    // A player has connected
    connect(client: HostClient) {
        console.log("User has connected...");
        this.clients[client.id] = client;
        // Get the username of the player
        client.send("request_username");
    }

    // A message arrived from a player
    handle(id: string, event: string, args: any[]) {
        if (!this.clients[id]) return;
        let host = id == NetworkService.LOCAL_ID;
        if (event == "username") this.user_username(id, args[0]);
        else if (event == "draw_line") this.user_draw_line(id, args[0], args[1]);
        else if (event == "start" && host) this.start();
        else if (event == "set_size" && host) this.set_size(args[0]);
        else if (event == "lobby" && host) this.to_lobby();
    }

    // A player has disconnected
    disconnect(id: string) {
        if (!this.clients[id]) return;
        console.log("User has disconnected...");
        let player = this.players[id];
        delete this.clients[id];
        delete this.players[id];
        this.queue = this.queue.filter((val) => val != id);
        if (player) this.broadcast("player_left", player.username);
        if (this.plyid == id) {
            this.plyid = null;
            this.plyname = null;
            if (this.queue.length > 0) {
                // The next player is already at the front of the queue
                this.queue.unshift(this.queue.pop());
                this.next_turn();
            }
        }
        this.update_leaderboard();
        if (this.phase == 'lobby') this.update_lobby();
    }

    private user_username(id: string, name: any) {
        if (this.players[id]) return;
        let username = (typeof name == 'string' ? name : '').replace(/[^\x20-\x7e]/g, '').trim().substr(0, 14) || 'Player';
        this.players[id] = {
            username: username,
            color: this.pick_color(),
            score: 0
        };
        console.log(username + " joined successfully!");
        this.clients[id].send("welcome", this.players[id].color);
        this.broadcast("player_joined", username, this.players[id].color);
        // Push the player to the turn order queue
        this.queue.push(id);
        // Update the leaderboard for all players
        this.update_leaderboard();
        if (this.phase == 'lobby') {
            this.update_lobby();
        } else {
            // Joined mid-game: send them the board so far
            this.send_board(id);
        }
    }

    // Catch a late joiner up on the current game
    private send_board(id: string) {
        let client = this.clients[id];
        client.send("board", this.size);
        for (let key of Object.keys(this.grid)) {
            let coords = key.split('_').map((n) => parseInt(n));
            client.send("draw_line", { x: coords[0], y: coords[1] }, { x: coords[2], y: coords[3] }, this.grid[key]);
        }
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.squares[r][c] !== undefined) {
                    client.send("fill_square", c, r, this.squares[r][c]);
                }
            }
        }
        client.send("next_turn", this.plyname, this.plyid ? this.players[this.plyid].color : 0xffffff);
        if (this.phase == 'over') client.send("game_over", this.leaderboard());
    }

    private pick_color(): number {
        let used = Object.keys(this.players).map((k) => this.players[k].color);
        for (let i = 0; i < HostService.COLORS.length; i++) {
            let color = HostService.COLORS[(this.next_color + i) % HostService.COLORS.length];
            if (used.indexOf(color) < 0) {
                this.next_color = (this.next_color + i + 1) % HostService.COLORS.length;
                return color;
            }
        }
        // More than 8 players: fall back to a random bright colour
        return Phaser.Color.HSVtoRGB(Math.random(), 0.7, 1).color;
    }

    // Host pressed Start (or Play Again)
    private start() {
        if (this.phase == 'playing') return;
        if (this.queue.length < 2) {
            this.reject(NetworkService.LOCAL_ID, "You need at least 2 players to start.");
            return;
        }
        this.clear_board();
        for (let id of Object.keys(this.players)) {
            this.players[id].score = 0;
            this.clients[id].send("update_score", 0);
        }
        this.phase = 'playing';
        this.broadcast("board", this.size);
        this.update_leaderboard();
        // First player in the queue goes first
        this.plyid = this.queue[0];
        this.plyname = this.players[this.plyid].username;
        this.broadcast("next_turn", this.plyname, this.players[this.plyid].color);
    }

    private set_size(value: any) {
        if (this.phase == 'playing') return;
        let size = Math.round(Number(value));
        if (!(size >= HostService.MIN_SIZE && size <= HostService.MAX_SIZE)) return;
        this.size = size;
        this.update_lobby();
    }

    private to_lobby() {
        this.phase = 'lobby';
        this.plyid = null;
        this.plyname = null;
        this.clear_board();
        this.update_lobby();
    }

    private next_turn() {
        if (this.queue.length == 0) return;
        this.queue.push(this.queue.shift());
        this.plyid = this.queue[0];
        this.plyname = this.players[this.plyid].username;
        // Inform clients who is playing next
        this.broadcast("next_turn", this.plyname, this.players[this.plyid].color);
    }

    private user_draw_line(id: string, coords1: any, coords2: any) {
        if (this.phase != 'playing') return this.reject(id, "The game isn't running.");
        if (!this.valid_coords(coords1) || !this.valid_coords(coords2)) return this.reject(id, "That's not a valid line.");
        if (id != this.plyid) return this.reject(id, "It's not your turn.");
        if (!this.valid_line(coords1, coords2)) return this.reject(id, "Lines can only connect neighboring dots.");
        let close = this._closest_coord(coords1, coords2);
        let far = this._furthest_coord(coords1, coords2);
        let full_string = this.key(close, far);
        if (this.grid[full_string] !== undefined) return this.reject(id, "That line is already drawn.");

        let color = this.players[id].color;
        this.broadcast("draw_line", coords1, coords2, color);
        this.grid[full_string] = color;
        if (!this.try_score(id, close, far)) {
            this.next_turn();
        } else if (this.board_full()) {
            // Game over! Show everyone the score table
            this.phase = 'over';
            this.plyid = null;
            this.plyname = null;
            this.broadcast("game_over", this.leaderboard());
        }
    }

    // Tell a player why their move didn't count
    private reject(id: string, reason: string) {
        if (this.clients[id]) this.clients[id].send("invalid_move", reason);
    }

    private try_score(id: string, close: any, far: any): boolean {
        let result = false;
        let has = (x1: number, y1: number, x2: number, y2: number) =>
            this.grid[x1 + '_' + y1 + '_' + x2 + '_' + y2] !== undefined;
        // If it is a vertical line, check a possible left or right square
        if (this._vertical(close, far)) {
            // Check the left square
            if (has(close.x - 1, close.y, close.x, close.y) && has(far.x - 1, far.y, far.x, far.y)
                && has(close.x - 1, close.y, far.x - 1, far.y)) {
                result = this.score(id, close.x - 1, close.y) || result;
            }
            // Check the right square
            if (has(close.x, close.y, close.x + 1, close.y) && has(far.x, far.y, far.x + 1, far.y)
                && has(close.x + 1, close.y, far.x + 1, far.y)) {
                result = this.score(id, close.x, close.y) || result;
            }
        } else {
            // else if horizontal, check a possible top or bottom square
            // Check the top square
            if (has(close.x, close.y - 1, close.x, close.y) && has(far.x, far.y - 1, far.x, far.y)
                && has(close.x, close.y - 1, far.x, far.y - 1)) {
                result = this.score(id, close.x, close.y - 1) || result;
            }
            // Check the bottom square
            if (has(close.x, close.y, close.x, close.y + 1) && has(far.x, far.y, far.x, far.y + 1)
                && has(close.x, close.y + 1, far.x, far.y + 1)) {
                result = this.score(id, close.x, close.y) || result;
            }
        }
        return result;
    }

    // Give a player the square at column x, row y
    private score(id: string, x: number, y: number): boolean {
        if (this.squares[y] === undefined || x < 0 || x >= this.size || this.squares[y][x] !== undefined) return false;
        let player = this.players[id];
        // Mark the square as filled
        this.squares[y][x] = player.color;
        // Increase the player's score
        player.score++;
        this.clients[id].send("update_score", player.score);
        this.broadcast("fill_square", x, y, player.color);
        this.update_leaderboard();
        return true;
    }

    private board_full(): boolean {
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.squares[r][c] === undefined) return false;
            }
        }
        return true;
    }

    private clear_board() {
        this.grid = {};
        this.squares = [];
        for (let r = 0; r < this.size; r++) this.squares.push([]);
    }

    private leaderboard(): HostPlayer[] {
        return Object.keys(this.players).map((key) => this.players[key])
            .sort((a, b) => b.score - a.score);
    }

    private update_leaderboard() {
        this.broadcast("update_leaderboard", this.leaderboard());
    }

    // Everyone in the lobby sees who's here and the board size
    private update_lobby() {
        let host = this.players[NetworkService.LOCAL_ID];
        this.broadcast("lobby", {
            players: this.queue.map((id) => ({
                username: this.players[id].username,
                color: this.players[id].color,
                host: id == NetworkService.LOCAL_ID
            })),
            size: this.size,
            host: host ? host.username : ''
        });
    }

    private broadcast(event: string, ...args: any[]) {
        for (let id of Object.keys(this.clients)) {
            this.clients[id].send(event, ...args);
        }
    }

    private key(close: any, far: any): string {
        return close.x + '_' + close.y + '_' + far.x + '_' + far.y;
    }

    private valid_coords(c: any): boolean {
        return c && typeof c.x == 'number' && typeof c.y == 'number'
            && c.x >= 0 && c.y >= 0 && c.x <= this.size && c.y <= this.size
            && Math.floor(c.x) == c.x && Math.floor(c.y) == c.y;
    }

    private valid_line(coords1: any, coords2: any): boolean {
        return this._valid_distance(coords1, coords2);
    }

    private _closest_coord(coords1: any, coords2: any) {
        if (coords1.x < coords2.x || coords1.y < coords2.y)
            return coords1;
        else
            return coords2;
    }

    private _furthest_coord(coords1: any, coords2: any) {
        if (coords1.x > coords2.x || coords1.y > coords2.y)
            return coords1;
        else
            return coords2;
    }

    private _valid_distance(coords1: any, coords2: any): boolean {
        return (Math.abs(coords1.x - coords2.x) == 1 || Math.abs(coords1.y - coords2.y) == 1)
            && (Math.abs(coords1.x - coords2.x) == 0 || Math.abs(coords1.y - coords2.y) == 0);
    }

    private _vertical(coords1: any, coords2: any): boolean {
        return Math.abs(coords1.y - coords2.y) == 1;
    }

}
