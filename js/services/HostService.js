// The game "server". This used to be server.js running on Node with socket.io;
// now it runs inside the host player's browser and talks to everyone over
// PeerJS (see NetworkService). The rules and turn queue are the same.
//
// A room starts in the lobby. The host picks a board size and starts the
// game; when the board is full it shows the scores and the host can play
// again or go back to the lobby.
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var HostService = /** @class */ (function () {
    function HostService() {
        // Connected clients (including the host's own local client)
        this.clients = {};
        // List of players
        this.players = {};
        // Player turn queue
        this.queue = [];
        // Current player turn id
        this.plyid = null;
        // Current player turn username
        this.plyname = null;
        // 'lobby', 'playing' or 'over'
        this.phase = 'lobby';
        // Squares per side
        this.size = HostService.DEFAULT_SIZE;
        // Tracking the lines that have been connected (stores the drawer's colour)
        this.grid = {};
        this.next_color = 0;
        this.clear_board();
    }
    // A player has connected
    HostService.prototype.connect = function (client) {
        console.log("User has connected...");
        this.clients[client.id] = client;
        // Get the username of the player
        client.send("request_username");
    };
    // A message arrived from a player
    HostService.prototype.handle = function (id, event, args) {
        if (!this.clients[id])
            return;
        var host = id == NetworkService.LOCAL_ID;
        if (event == "username")
            this.user_username(id, args[0]);
        else if (event == "draw_line")
            this.user_draw_line(id, args[0], args[1]);
        else if (event == "start" && host)
            this.start();
        else if (event == "set_size" && host)
            this.set_size(args[0]);
        else if (event == "lobby" && host)
            this.to_lobby();
    };
    // A player has disconnected
    HostService.prototype.disconnect = function (id) {
        if (!this.clients[id])
            return;
        console.log("User has disconnected...");
        var player = this.players[id];
        delete this.clients[id];
        delete this.players[id];
        this.queue = this.queue.filter(function (val) { return val != id; });
        if (player)
            this.broadcast("player_left", player.username);
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
        if (this.phase == 'lobby')
            this.update_lobby();
    };
    HostService.prototype.user_username = function (id, name) {
        if (this.players[id])
            return;
        var username = (typeof name == 'string' ? name : '').replace(/[^\x20-\x7e]/g, '').trim().substr(0, 14) || 'Player';
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
        }
        else {
            // Joined mid-game: send them the board so far
            this.send_board(id);
        }
    };
    // Catch a late joiner up on the current game
    HostService.prototype.send_board = function (id) {
        var client = this.clients[id];
        client.send("board", this.size);
        for (var _i = 0, _a = Object.keys(this.grid); _i < _a.length; _i++) {
            var key = _a[_i];
            var coords = key.split('_').map(function (n) { return parseInt(n); });
            client.send("draw_line", { x: coords[0], y: coords[1] }, { x: coords[2], y: coords[3] }, this.grid[key]);
        }
        for (var r = 0; r < this.size; r++) {
            for (var c = 0; c < this.size; c++) {
                if (this.squares[r][c] !== undefined) {
                    client.send("fill_square", c, r, this.squares[r][c]);
                }
            }
        }
        client.send("next_turn", this.plyname, this.plyid ? this.players[this.plyid].color : 0xffffff);
        if (this.phase == 'over')
            client.send("game_over", this.leaderboard());
    };
    HostService.prototype.pick_color = function () {
        var _this = this;
        var used = Object.keys(this.players).map(function (k) { return _this.players[k].color; });
        for (var i = 0; i < HostService.COLORS.length; i++) {
            var color = HostService.COLORS[(this.next_color + i) % HostService.COLORS.length];
            if (used.indexOf(color) < 0) {
                this.next_color = (this.next_color + i + 1) % HostService.COLORS.length;
                return color;
            }
        }
        // More than 8 players: fall back to a random bright colour
        return Phaser.Color.HSVtoRGB(Math.random(), 0.7, 1).color;
    };
    // Host pressed Start (or Play Again)
    HostService.prototype.start = function () {
        if (this.phase == 'playing')
            return;
        if (this.queue.length < 2) {
            this.reject(NetworkService.LOCAL_ID, "You need at least 2 players to start.");
            return;
        }
        this.clear_board();
        for (var _i = 0, _a = Object.keys(this.players); _i < _a.length; _i++) {
            var id = _a[_i];
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
    };
    HostService.prototype.set_size = function (value) {
        if (this.phase == 'playing')
            return;
        var size = Math.round(Number(value));
        if (!(size >= HostService.MIN_SIZE && size <= HostService.MAX_SIZE))
            return;
        this.size = size;
        this.update_lobby();
    };
    HostService.prototype.to_lobby = function () {
        this.phase = 'lobby';
        this.plyid = null;
        this.plyname = null;
        this.clear_board();
        this.update_lobby();
    };
    HostService.prototype.next_turn = function () {
        if (this.queue.length == 0)
            return;
        this.queue.push(this.queue.shift());
        this.plyid = this.queue[0];
        this.plyname = this.players[this.plyid].username;
        // Inform clients who is playing next
        this.broadcast("next_turn", this.plyname, this.players[this.plyid].color);
    };
    HostService.prototype.user_draw_line = function (id, coords1, coords2) {
        if (this.phase != 'playing')
            return this.reject(id, "The game isn't running.");
        if (!this.valid_coords(coords1) || !this.valid_coords(coords2))
            return this.reject(id, "That's not a valid line.");
        if (id != this.plyid)
            return this.reject(id, "It's not your turn.");
        if (!this.valid_line(coords1, coords2))
            return this.reject(id, "Lines can only connect neighboring dots.");
        var close = this._closest_coord(coords1, coords2);
        var far = this._furthest_coord(coords1, coords2);
        var full_string = this.key(close, far);
        if (this.grid[full_string] !== undefined)
            return this.reject(id, "That line is already drawn.");
        var color = this.players[id].color;
        this.broadcast("draw_line", coords1, coords2, color);
        this.grid[full_string] = color;
        if (!this.try_score(id, close, far)) {
            this.next_turn();
        }
        else if (this.board_full()) {
            // Game over! Show everyone the score table
            this.phase = 'over';
            this.plyid = null;
            this.plyname = null;
            this.broadcast("game_over", this.leaderboard());
        }
    };
    // Tell a player why their move didn't count
    HostService.prototype.reject = function (id, reason) {
        if (this.clients[id])
            this.clients[id].send("invalid_move", reason);
    };
    HostService.prototype.try_score = function (id, close, far) {
        var _this = this;
        var result = false;
        var has = function (x1, y1, x2, y2) {
            return _this.grid[x1 + '_' + y1 + '_' + x2 + '_' + y2] !== undefined;
        };
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
        }
        else {
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
    };
    // Give a player the square at column x, row y
    HostService.prototype.score = function (id, x, y) {
        if (this.squares[y] === undefined || x < 0 || x >= this.size || this.squares[y][x] !== undefined)
            return false;
        var player = this.players[id];
        // Mark the square as filled
        this.squares[y][x] = player.color;
        // Increase the player's score
        player.score++;
        this.clients[id].send("update_score", player.score);
        this.broadcast("fill_square", x, y, player.color);
        this.update_leaderboard();
        return true;
    };
    HostService.prototype.board_full = function () {
        for (var r = 0; r < this.size; r++) {
            for (var c = 0; c < this.size; c++) {
                if (this.squares[r][c] === undefined)
                    return false;
            }
        }
        return true;
    };
    HostService.prototype.clear_board = function () {
        this.grid = {};
        this.squares = [];
        for (var r = 0; r < this.size; r++)
            this.squares.push([]);
    };
    HostService.prototype.leaderboard = function () {
        var _this = this;
        return Object.keys(this.players).map(function (key) { return _this.players[key]; })
            .sort(function (a, b) { return b.score - a.score; });
    };
    HostService.prototype.update_leaderboard = function () {
        this.broadcast("update_leaderboard", this.leaderboard());
    };
    // Everyone in the lobby sees who's here and the board size
    HostService.prototype.update_lobby = function () {
        var _this = this;
        var host = this.players[NetworkService.LOCAL_ID];
        this.broadcast("lobby", {
            players: this.queue.map(function (id) { return ({
                username: _this.players[id].username,
                color: _this.players[id].color,
                host: id == NetworkService.LOCAL_ID
            }); }),
            size: this.size,
            host: host ? host.username : ''
        });
    };
    HostService.prototype.broadcast = function (event) {
        var _a;
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        for (var _b = 0, _c = Object.keys(this.clients); _b < _c.length; _b++) {
            var id = _c[_b];
            (_a = this.clients[id]).send.apply(_a, __spreadArray([event], args, false));
        }
    };
    HostService.prototype.key = function (close, far) {
        return close.x + '_' + close.y + '_' + far.x + '_' + far.y;
    };
    HostService.prototype.valid_coords = function (c) {
        return c && typeof c.x == 'number' && typeof c.y == 'number'
            && c.x >= 0 && c.y >= 0 && c.x <= this.size && c.y <= this.size
            && Math.floor(c.x) == c.x && Math.floor(c.y) == c.y;
    };
    HostService.prototype.valid_line = function (coords1, coords2) {
        return this._valid_distance(coords1, coords2);
    };
    HostService.prototype._closest_coord = function (coords1, coords2) {
        if (coords1.x < coords2.x || coords1.y < coords2.y)
            return coords1;
        else
            return coords2;
    };
    HostService.prototype._furthest_coord = function (coords1, coords2) {
        if (coords1.x > coords2.x || coords1.y > coords2.y)
            return coords1;
        else
            return coords2;
    };
    HostService.prototype._valid_distance = function (coords1, coords2) {
        return (Math.abs(coords1.x - coords2.x) == 1 || Math.abs(coords1.y - coords2.y) == 1)
            && (Math.abs(coords1.x - coords2.x) == 0 || Math.abs(coords1.y - coords2.y) == 0);
    };
    HostService.prototype._vertical = function (coords1, coords2) {
        return Math.abs(coords1.y - coords2.y) == 1;
    };
    // Bright colours that read well on the black board, handed out in join order
    HostService.COLORS = [0xff5d73, 0x3fa7ff, 0xffc145, 0x3ddc97, 0xb281ff, 0xff8f3f, 0x2fd4d4, 0xff6fd8];
    HostService.MIN_SIZE = 2;
    HostService.MAX_SIZE = 10;
    HostService.DEFAULT_SIZE = 6;
    return HostService;
}());
//# sourceMappingURL=HostService.js.map