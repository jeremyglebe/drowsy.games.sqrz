// The game "server". This used to be server.js running on Node with socket.io;
// now it runs inside the host player's browser and talks to everyone over
// PeerJS (see NetworkService). The rules and turn queue are the same.

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
    static SIZE = 10;

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
    // Tracking the squares that have been filled (stores the owner's colour)
    squares: number[][];
    // Tracking the lines that have been connected (stores the drawer's colour)
    grid: { [key: string]: number } = {};
    // Whether the board is full and we're showing the score table
    over = false;
    private next_color = 0;

    constructor() {
        this.clear_board();
    }

    // A player has connected
    connect(client: HostClient) {
        console.log("User has connected...");
        this.clients[client.id] = client;
        // Draw each of the lines and squares that already exist
        for (let key of Object.keys(this.grid)) {
            let coords = key.split('_').map((n) => parseInt(n));
            client.send("draw_line", { x: coords[0], y: coords[1] }, { x: coords[2], y: coords[3] }, this.grid[key]);
        }
        for (let r = 0; r < HostService.SIZE; r++) {
            for (let c = 0; c < HostService.SIZE; c++) {
                if (this.squares[r][c] !== undefined) {
                    client.send("fill_square", c, r, this.squares[r][c]);
                }
            }
        }
        // Get the username of the player
        client.send("request_username");
    }

    // A message arrived from a player
    handle(id: string, event: string, args: any[]) {
        if (!this.clients[id]) return;
        if (event == "username") this.user_username(id, args[0]);
        else if (event == "draw_line") this.user_draw_line(id, args[0], args[1]);
        else if (event == "restart" && id == NetworkService.LOCAL_ID) this.restart();
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
        // Make sure there is an active player
        if (!this.plyid) {
            this.next_turn();
        }
        // Make sure that they get the current turn (and the score table if it's over)
        this.clients[id].send("next_turn", this.plyname, this.plyid ? this.players[this.plyid].color : 0xffffff);
        if (this.over) this.clients[id].send("game_over", this.leaderboard());
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

    private next_turn() {
        this.queue.push(this.queue.shift());
        this.plyid = this.queue[0];
        this.plyname = this.players[this.plyid].username;
        // Inform clients who is playing next
        this.broadcast("next_turn", this.plyname, this.players[this.plyid].color);
    }

    private user_draw_line(id: string, coords1: any, coords2: any) {
        if (this.over || !this.valid_coords(coords1) || !this.valid_coords(coords2)) return;
        let close = this._closest_coord(coords1, coords2);
        let far = this._furthest_coord(coords1, coords2);
        let full_string = this.key(close, far);
        if (this.valid_line(coords1, coords2) && this.grid[full_string] === undefined && id == this.plyid) {
            let color = this.players[id].color;
            this.broadcast("draw_line", coords1, coords2, color);
            this.grid[full_string] = color;
            if (!this.try_score(id, close, far)) {
                this.next_turn();
            } else if (this.board_full()) {
                // Game over! Show everyone the score table
                this.over = true;
                this.broadcast("game_over", this.leaderboard());
            }
        }
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
        if (this.squares[y] === undefined || this.squares[y][x] !== undefined) return false;
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
        for (let r = 0; r < HostService.SIZE; r++) {
            for (let c = 0; c < HostService.SIZE; c++) {
                if (this.squares[r][c] === undefined) return false;
            }
        }
        return true;
    }

    // Start a fresh board with the same players
    private restart() {
        this.clear_board();
        this.over = false;
        for (let id of Object.keys(this.players)) {
            this.players[id].score = 0;
            this.clients[id].send("update_score", 0);
        }
        this.broadcast("reset");
        this.update_leaderboard();
        if (this.queue.length > 0) this.next_turn();
    }

    private clear_board() {
        this.grid = {};
        this.squares = [];
        for (let r = 0; r < HostService.SIZE; r++) this.squares.push([]);
    }

    private leaderboard(): HostPlayer[] {
        return Object.keys(this.players).map((key) => this.players[key])
            .sort((a, b) => b.score - a.score);
    }

    private update_leaderboard() {
        this.broadcast("update_leaderboard", this.leaderboard());
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
            && c.x >= 0 && c.y >= 0 && c.x <= HostService.SIZE && c.y <= HostService.SIZE
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
