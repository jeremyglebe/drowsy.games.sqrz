// This state represents the actual gameplay. It starts in the lobby (an
// overlay on top of the game screen) until the host starts the game.
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var Sqrz = /** @class */ (function (_super) {
    __extends(Sqrz, _super);
    function Sqrz() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Sqrz.prototype.init = function (name, net) {
        this.username = name;
        this.server = net;
    };
    // Function to create the initial game layout and world
    Sqrz.prototype.create = function () {
        var _this = this;
        // Log that we've entered the state
        console.log("State: Sqrz");
        //Initialize the game pointer
        this.ptr = this.game.input.activePointer;
        // Initialize the line origin (no origin until a dot is clicked)
        this.line_origin = null;
        this.my_color = 0xffffff;
        this.my_turn = false;
        this.score_table = null;
        this.lobby = null;
        this.size = 0;
        this.drawn = {};
        // Layers, back to front: squares, lines, dots, the line being dragged
        this.square_layer = this.game.add.group();
        this.line_layer = this.game.add.group();
        // Initialize the dots group
        this.nodes = this.game.add.group();
        // Enabled input on the dots
        this.nodes.inputEnableChildren = true;
        // Create a graphics object to draw lines
        this.line = this.game.add.graphics(0, 0);
        // Player's score text
        this.score_text = UI.text(this.game, 15, 15, "Score: 0", UI.HEADING, UI.WHITE, true);
        // leaderboard
        this.board_display = [];
        UI.text(this.game, 600, 20, "Leaderboard", UI.SMALL + 2, UI.GRAY, true);
        // Turn text
        this.turn_text = UI.text(this.game, 390, 375, "", UI.HEADING, UI.WHITE, true, undefined, 0.5);
        // Short instructions under the board
        UI.paragraph(this.game, 390, 420, "Drag from a dot to a neighboring dot to draw a line. " +
            "Close a square to score a point and go again.", 420, UI.SMALL, UI.GRAY, undefined, 0.5);
        // Room code, so friends can join
        this.create_room_info();
        // Notifications
        this.toast = UI.text(this.game, 390, 480, "", UI.SMALL + 2, UI.GRAY, true, undefined, 0.5);
        // Handle clicking on dots (should start a line)
        this.nodes.onChildInputDown.add(function (sprite) {
            _this.line_origin = sprite;
        }, this);
        // Handle releasing a click on a dot (tries to make a new permanent line)
        this.nodes.onChildInputUp.add(this.handle_node_click, this);
        // Call handler when receiving message from server
        this.server.on('draw_line', function (coords1, coords2, color) {
            _this.server_draw_line(_this.game, coords1, coords2, color);
        });
        // A square was completed
        this.server.on('fill_square', function (x, y, color) {
            _this.server_fill_square(x, y, color);
        });
        // Handle request from server for username
        this.server.on("request_username", function () {
            _this.server.emit("username", _this.username);
        });
        // The host tells us which colour we are
        this.server.on("welcome", function (color) {
            _this.my_color = color;
            _this.score_text.fill = UI.hex(color);
        });
        // Handle updating score
        this.server.on("update_score", function (myscore) {
            _this.score_text.text = "Score: " + myscore.toString();
            if (myscore > 0)
                _this.bounce(_this.score_text);
        });
        // Handle updating the leaderboard
        this.server.on("update_leaderboard", function (leaderboard) {
            _this.server_update_leaderboard(_this.game, leaderboard);
        });
        // Handle updating the turn
        this.server.on("next_turn", function (name, color) {
            _this.server_next_turn(name, color);
        });
        // Waiting room: who's here and how big the board will be
        this.server.on("lobby", function (info) {
            _this.show_lobby(info);
        });
        // The host started a game on a board of this size
        this.server.on("board", function (size) {
            _this.server_board(size);
        });
        // The grid is full: show the final scores
        this.server.on("game_over", function (leaderboard) {
            _this.server_game_over(leaderboard);
        });
        // The host didn't accept our move
        this.server.on("invalid_move", function (reason) {
            _this.show_toast(reason, true);
        });
        this.server.on("player_joined", function (name, color) {
            if (name != _this.username)
                _this.show_toast(name + " joined", false, color);
        });
        this.server.on("player_left", function (name) {
            _this.show_toast(name + " left");
        });
        // The host closed their game
        this.server.on("host_left", function () {
            _this.game.state.start('Menu', true, false, "The host left the game.");
        });
        // Everything's listening, let the messages flow
        this.server.start();
    };
    Sqrz.prototype.update = function () {
        this.update_cursor_line();
    };
    Sqrz.prototype.shutdown = function () {
        // Leaving the game (back to the menu)
        this.server.close();
    };
    Sqrz.prototype.create_room_info = function () {
        var _this = this;
        UI.text(this.game, 15, 520, "Room code (click to copy invite link)", UI.SMALL, UI.GRAY);
        var code = UI.text(this.game, 15, 538, this.server.code, 34, UI.WHITE, true);
        code.inputEnabled = true;
        code.input.useHandCursor = true;
        code.events.onInputDown.add(function () { return _this.copy_invite(); });
        // Leave button
        UI.link(this.game, 785, 566, "Leave", function () { return _this.leave(); }, undefined, 1);
    };
    Sqrz.prototype.copy_invite = function () {
        var _this = this;
        UI.copyInvite(this.server.code, function (msg) { return _this.show_toast(msg); });
    };
    Sqrz.prototype.leave = function () {
        var others = this.server.isHost && this.server.host.queue.length > 1;
        if (others && !window.confirm("Leaving will end the game for everyone. Leave?"))
            return;
        this.game.state.start('Menu');
    };
    // Waiting room shown on top of the game screen
    Sqrz.prototype.show_lobby = function (info) {
        var _this = this;
        if (this.lobby)
            this.lobby.destroy();
        if (this.score_table)
            this.score_table.destroy();
        this.score_table = null;
        this.my_turn = false;
        this.line_origin = null;
        var g = this.lobby = this.game.add.group();
        var host = this.server.isHost;
        UI.panel(this.game, g);
        // Room code, big, so it's easy to read out to friends
        UI.text(this.game, 400, 25, "Room code", UI.SMALL, UI.GRAY, false, g, 0.5);
        UI.text(this.game, 400, 45, this.server.code, 64, UI.WHITE, true, g, 0.5);
        UI.button(this.game, 300, 125, 200, 36, "Copy Invite Link", function () { return _this.copy_invite(); }, g);
        // Everyone who has joined, in up to 3 columns of 5
        var players = info.players || [];
        UI.text(this.game, 130, 185, "Players (" + players.length + ")", UI.HEADING, UI.WHITE, true, g);
        var rows = 5, cols = 3;
        var shown = players.length > rows * cols ? rows * cols - 1 : players.length;
        for (var i = 0; i < shown; i++) {
            var p = players[i];
            var label = p.username;
            if (p.host)
                label += " (host)";
            else if (p.username == this.username && p.color == this.my_color)
                label += " (you)";
            UI.text(this.game, 130 + Math.floor(i / rows) * 190, 225 + (i % rows) * 28, label, UI.BODY, UI.hex(p.color), true, g);
        }
        if (shown < players.length) {
            UI.text(this.game, 130 + 2 * 190, 225 + 4 * 28, "+" + (players.length - shown) + " more", UI.BODY, UI.GRAY, false, g);
        }
        // Board size: the host can change it, everyone else just sees it
        var size = info.size;
        UI.text(this.game, 130, 382, "Board size", UI.BODY, UI.GRAY, false, g);
        if (host) {
            var minus = UI.button(this.game, 280, 375, 40, 36, "-", function () { return _this.server.emit("set_size", size - 1); }, g);
            UI.text(this.game, 370, 382, size + " x " + size, UI.BODY, UI.WHITE, true, g, 0.5);
            var plus = UI.button(this.game, 420, 375, 40, 36, "+", function () { return _this.server.emit("set_size", size + 1); }, g);
            minus.setEnabled(size > HostService.MIN_SIZE);
            plus.setEnabled(size < HostService.MAX_SIZE);
        }
        else {
            UI.text(this.game, 280, 382, size + " x " + size, UI.BODY, UI.WHITE, true, g);
        }
        // Start button for the host, a waiting message for everyone else
        if (host) {
            var start = UI.button(this.game, 290, 435, 220, 50, "Start Game!", function () { return _this.server.emit("start"); }, g);
            if (players.length < 2) {
                start.setEnabled(false);
                UI.text(this.game, 400, 492, "Waiting for at least 2 players...", UI.SMALL, UI.GRAY, false, g, 0.5);
            }
        }
        else {
            UI.text(this.game, 400, 450, "Waiting for " + (info.host || "the host") + " to start the game...", UI.BODY, UI.GRAY, false, g, 0.5);
        }
        UI.paragraph(this.game, 400, 525, "How to play: drag from a dot to a neighboring dot to draw a line. " +
            "Close a square to score and go again. Most squares wins.", 520, UI.SMALL, UI.GRAY, g, 0.5);
        UI.link(this.game, 785, 566, "Leave", function () { return _this.leave(); }, g, 1);
    };
    // The host started the game: build a fresh board
    Sqrz.prototype.server_board = function (size) {
        if (this.lobby)
            this.lobby.destroy();
        this.lobby = null;
        if (this.score_table)
            this.score_table.destroy();
        this.score_table = null;
        this.score_text.text = "Score: 0";
        this.create_nodes(size);
    };
    // Draw the game grid
    Sqrz.prototype.create_nodes = function (size) {
        this.size = size;
        this.spacing = Sqrz.BOARD_PIXELS / size;
        this.line_width = Math.round(Math.max(4, Math.min(8, this.spacing * 0.12)));
        var dot_size = Math.max(10, Math.min(16, this.spacing * 0.4));
        var hit_size = Math.min(this.spacing * 0.9, 40);
        this.line_origin = null;
        this.drawn = {};
        this.nodes.removeAll(true);
        this.line_layer.removeAll(true);
        this.square_layer.removeAll(true);
        // Draw the circles
        for (var r = 0; r <= size; r++) {
            for (var c = 0; c <= size; c++) {
                var dot = this.game.add.graphics(this._x(c), this._y(r), this.nodes);
                // Set the fill color
                dot.beginFill(0xFFFFFF);
                // Draw the circle (small enough that lines and squares show between dots)
                dot.drawCircle(0, 0, dot_size);
                // End the filling
                dot.endFill();
                // ...but keep a generous area to click/tap on
                dot.hitArea = new Phaser.Circle(0, 0, hit_size);
            }
        }
    };
    Sqrz.prototype.handle_node_click = function (sprite, cursor) {
        // Remove the click origin point (as the click is over)
        this.line_origin = null;
        // Find the dot under the pointer
        var sprite2 = this.dot_at(cursor.x, cursor.y);
        if (sprite2 === sprite)
            return;
        if (!sprite2) {
            // Let go over empty space after dragging
            if (Phaser.Math.distance(sprite.x, sprite.y, cursor.x, cursor.y) > this.spacing / 2) {
                this.show_toast("Let go on a neighboring dot to draw a line.", true);
            }
            return;
        }
        var coords1 = { x: this._column(sprite.x), y: this._row(sprite.y) };
        var coords2 = { x: this._column(sprite2.x), y: this._row(sprite2.y) };
        // Explain bad moves right away instead of waiting for the host
        if (!this.my_turn)
            return this.show_toast("It's not your turn.", true);
        if (!this.adjacent(coords1, coords2))
            return this.show_toast("Lines can only connect neighboring dots.", true);
        if (this.drawn[this.line_key(coords1, coords2)])
            return this.show_toast("That line is already drawn.", true);
        // Send a message to the server
        this.server.emit('draw_line', coords1, coords2);
    };
    Sqrz.prototype.dot_at = function (x, y) {
        var found = null;
        var reach = this.spacing * 0.45;
        this.nodes.forEach(function (dot) {
            if (Math.abs(dot.x - x) <= reach && Math.abs(dot.y - y) <= reach)
                found = dot;
        }, this);
        return found;
    };
    Sqrz.prototype.adjacent = function (a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) == 1;
    };
    Sqrz.prototype.line_key = function (a, b) {
        return Math.min(a.x, b.x) + '_' + Math.min(a.y, b.y) + '_' + Math.max(a.x, b.x) + '_' + Math.max(a.y, b.y);
    };
    Sqrz.prototype.server_draw_line = function (game, coords1, coords2, color) {
        if (!this.size)
            return;
        this.drawn[this.line_key(coords1, coords2)] = true;
        var new_line = game.add.graphics(0, 0, this.line_layer);
        // Line style for the line
        new_line.lineStyle(this.line_width, color);
        new_line.moveTo(this._x(coords1.x), this._y(coords1.y));
        new_line.lineTo(this._x(coords2.x), this._y(coords2.y));
        // Fade it in
        new_line.alpha = 0;
        game.add.tween(new_line).to({ alpha: 1 }, 200, Phaser.Easing.Quadratic.Out, true);
    };
    Sqrz.prototype.server_fill_square = function (x, y, color) {
        if (!this.size)
            return;
        var size = this.spacing;
        // Draw around the square's centre so it can pop in
        var square = this.game.add.graphics(this._x(x) + size / 2, this._y(y) + size / 2, this.square_layer);
        square.beginFill(color, 0.5);
        square.drawRect(-size / 2, -size / 2, size, size);
        square.endFill();
        square.scale.set(0.2, 0.2);
        this.game.add.tween(square.scale).to({ x: 1, y: 1 }, 300, Phaser.Easing.Back.Out, true);
    };
    Sqrz.prototype.server_next_turn = function (name, color) {
        if (!name) {
            this.my_turn = false;
            this.turn_text.text = "";
            return;
        }
        var was_my_turn = this.my_turn;
        this.my_turn = name == this.username && color == this.my_color;
        this.turn_text.text = this.my_turn ? "Your Turn!" : name + "'s Turn!";
        this.turn_text.fill = UI.hex(color);
        if (this.my_turn && !was_my_turn)
            this.bounce(this.turn_text);
    };
    Sqrz.prototype.server_update_leaderboard = function (game, leaderboard) {
        // Delete everything else
        this.board_display.forEach(function (text) {
            text.destroy();
        });
        this.board_display = [];
        // Add all the texts for the leaders
        for (var i = 0; i < 5; i++) {
            if (leaderboard[i]) {
                this.board_display.push(UI.text(game, 600, 25 * i + 50, leaderboard[i].username + ': ' + leaderboard[i].score, UI.SMALL + 2, UI.hex(leaderboard[i].color), true));
            }
        }
        if (leaderboard.length > 5) {
            this.board_display.push(UI.text(game, 600, 25 * 5 + 50, "+" + (leaderboard.length - 5) + " more", UI.SMALL, UI.GRAY));
        }
    };
    // Grid is completely connected: show the score table
    Sqrz.prototype.server_game_over = function (leaderboard) {
        var _this = this;
        if (this.score_table)
            this.score_table.destroy();
        this.my_turn = false;
        this.line_origin = null;
        this.turn_text.text = "Game Over!";
        this.turn_text.fill = UI.WHITE;
        var table = this.score_table = this.game.add.group();
        UI.panel(this.game, table, 0.85);
        var top = leaderboard.length ? leaderboard[0].score : 0;
        var winners = leaderboard.filter(function (p) { return p.score == top; });
        var headline = winners.length > 1 ? "It's a tie!" : winners[0].username + " wins!";
        UI.text(this.game, 400, 80, headline, UI.TITLE, winners.length == 1 ? UI.hex(winners[0].color) : UI.WHITE, true, table, 0.5);
        leaderboard.slice(0, 8).forEach(function (p, i) {
            var y = 170 + i * 36;
            var rank = leaderboard.filter(function (q) { return q.score > p.score; }).length + 1;
            UI.text(_this.game, 250, y, rank + ".", UI.BODY + 4, UI.GRAY, true, table);
            UI.text(_this.game, 290, y, p.username, UI.BODY + 4, UI.hex(p.color), true, table);
            UI.text(_this.game, 550, y, String(p.score), UI.BODY + 4, UI.WHITE, true, table, 1);
        });
        if (leaderboard.length > 8) {
            UI.text(this.game, 290, 170 + 8 * 36, "+" + (leaderboard.length - 8) + " more", UI.SMALL, UI.GRAY, false, table);
        }
        if (this.server.isHost) {
            UI.button(this.game, 175, 500, 210, 50, "Play Again!", function () { return _this.server.emit("start"); }, table);
            UI.button(this.game, 415, 500, 210, 50, "Change Settings", function () { return _this.server.emit("lobby"); }, table);
        }
        else {
            UI.text(this.game, 400, 512, "Waiting for the host to start a new game...", UI.BODY, UI.GRAY, false, table, 0.5);
        }
        table.alpha = 0;
        this.game.add.tween(table).to({ alpha: 1 }, 400, Phaser.Easing.Quadratic.Out, true);
    };
    Sqrz.prototype.show_toast = function (msg, error, color) {
        if (error === void 0) { error = false; }
        this.toast.text = msg;
        this.toast.fill = error ? UI.RED : color ? UI.hex(color) : UI.GRAY;
        // Keep it visible over the lobby and score table
        this.game.world.bringToTop(this.toast);
        this.game.tweens.removeFrom(this.toast);
        this.toast.alpha = 1;
        this.game.add.tween(this.toast).to({ alpha: 0 }, 600, Phaser.Easing.Linear.None, true, 2200);
    };
    Sqrz.prototype.bounce = function (text) {
        this.game.tweens.removeFrom(text.scale);
        text.scale.set(1.25, 1.25);
        this.game.add.tween(text.scale).to({ x: 1, y: 1 }, 300, Phaser.Easing.Back.Out, true);
    };
    Sqrz.prototype.update_cursor_line = function () {
        // Clear the line
        this.line.clear();
        // Check if we should be drawing a line
        if (this.line_origin) {
            // Snap to a neighboring dot when the pointer is over one
            var end = this.ptr;
            var target = this.dot_at(this.ptr.x, this.ptr.y);
            if (target && this.adjacent({ x: this._column(target.x), y: this._row(target.y) }, { x: this._column(this.line_origin.x), y: this._row(this.line_origin.y) })) {
                end = target;
            }
            // Line style for the line (faded out if it's not our turn)
            this.line.lineStyle(this.line_width, this.my_color, this.my_turn ? 1 : 0.3);
            // Draw from the mouse
            this.line.moveTo(end.x, end.y);
            // Draw to the center (the dot)
            this.line.lineTo(this.line_origin.x, this.line_origin.y);
        }
    };
    Sqrz.prototype._column = function (x) {
        return Math.round((x - Sqrz.BOARD_LEFT) / this.spacing);
    };
    Sqrz.prototype._row = function (y) {
        return Math.round((y - Sqrz.BOARD_TOP) / this.spacing);
    };
    Sqrz.prototype._x = function (column) {
        return column * this.spacing + Sqrz.BOARD_LEFT;
    };
    Sqrz.prototype._y = function (row) {
        return row * this.spacing + Sqrz.BOARD_TOP;
    };
    // The board fits in a 300px square with its top-left corner here
    Sqrz.BOARD_LEFT = 240;
    Sqrz.BOARD_TOP = 50;
    Sqrz.BOARD_PIXELS = 300;
    return Sqrz;
}(Phaser.State));
//# sourceMappingURL=Sqrz.js.map