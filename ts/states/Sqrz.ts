
// This state represents the actual gameplay. It starts in the lobby (an
// overlay on top of the game screen) until the host starts the game.

class Sqrz extends Phaser.State {

    // The board fits in a 300px square with its top-left corner here
    static BOARD_LEFT = 240;
    static BOARD_TOP = 50;
    static BOARD_PIXELS = 300;

    // Group of dots for the grid
    nodes: Phaser.Group;
    // Filled-in squares (drawn underneath everything else)
    square_layer: Phaser.Group;
    // Lines players have drawn
    line_layer: Phaser.Group;
    // Main pointer of the game
    ptr: Phaser.Pointer;
    // Graphical representation of the user's line
    line: Phaser.Graphics;
    // Sprite that the user is drawing a line from
    line_origin: Phaser.Sprite;
    // Connection to the host (replaces the old socket.io connection)
    server: NetworkService;
    // Player's score text
    score_text: Phaser.Text;
    // Player's username
    username: string;
    // Player's colour (assigned by the host)
    my_color: number;
    // Text displays for the scores of the top players
    board_display: Phaser.Text[];
    // Shows who's turn it is
    turn_text: Phaser.Text;
    // Whether it's currently our turn
    my_turn: boolean;
    // Final score table shown when the grid is full
    score_table: Phaser.Group;
    // Waiting room shown before the game starts
    lobby: Phaser.Group;
    // Short-lived messages ("Sam joined", "It's not your turn.")
    toast: Phaser.Text;
    // Squares per side, and the pixel gap between dots
    size: number;
    spacing: number;
    line_width: number;
    // Lines already on the board, so we can explain a rejected move right away
    drawn: { [key: string]: boolean };

    init(name: string, net: NetworkService) {
        this.username = name;
        this.server = net;
    }

    // Function to create the initial game layout and world
    create() {
        // Log that we've entered the state
        console.log("State: Sqrz")

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
        UI.paragraph(this.game, 390, 420,
            "Drag from a dot to a neighboring dot to draw a line. " +
            "Close a square to score a point and go again.", 420, UI.SMALL, UI.GRAY, undefined, 0.5);
        // Room code, so friends can join
        this.create_room_info();
        // Notifications
        this.toast = UI.text(this.game, 390, 480, "", UI.SMALL + 2, UI.GRAY, true, undefined, 0.5);

        // Handle clicking on dots (should start a line)
        this.nodes.onChildInputDown.add((sprite: Phaser.Sprite) => {
            this.line_origin = sprite;
        }, this);
        // Handle releasing a click on a dot (tries to make a new permanent line)
        this.nodes.onChildInputUp.add(this.handle_node_click, this);

        // Call handler when receiving message from server
        this.server.on('draw_line', (coords1, coords2, color) => {
            this.server_draw_line(this.game, coords1, coords2, color);
        });

        // A square was completed
        this.server.on('fill_square', (x, y, color) => {
            this.server_fill_square(x, y, color);
        });

        // Handle request from server for username
        this.server.on("request_username", () => {
            this.server.emit("username", this.username);
        });

        // The host tells us which colour we are
        this.server.on("welcome", (color) => {
            this.my_color = color;
            this.score_text.fill = UI.hex(color);
        });

        // Handle updating score
        this.server.on("update_score", (myscore) => {
            this.score_text.text = "Score: " + myscore.toString();
            if (myscore > 0) this.bounce(this.score_text);
        });

        // Handle updating the leaderboard
        this.server.on("update_leaderboard", (leaderboard) => {
            this.server_update_leaderboard(this.game, leaderboard);
        });

        // Handle updating the turn
        this.server.on("next_turn", (name, color) => {
            this.server_next_turn(name, color);
        });

        // Waiting room: who's here and how big the board will be
        this.server.on("lobby", (info) => {
            this.show_lobby(info);
        });

        // The host started a game on a board of this size
        this.server.on("board", (size) => {
            this.server_board(size);
        });

        // The grid is full: show the final scores
        this.server.on("game_over", (leaderboard) => {
            this.server_game_over(leaderboard);
        });

        // The host didn't accept our move
        this.server.on("invalid_move", (reason) => {
            this.show_toast(reason, true);
        });

        this.server.on("player_joined", (name, color) => {
            if (name != this.username) this.show_toast(name + " joined", false, color);
        });

        this.server.on("player_left", (name) => {
            this.show_toast(name + " left");
        });

        // The host closed their game
        this.server.on("host_left", () => {
            this.game.state.start('Menu', true, false, "The host left the game.");
        });

        // Everything's listening, let the messages flow
        this.server.start();
    }

    update() {
        this.update_cursor_line();
    }

    shutdown() {
        // Leaving the game (back to the menu)
        this.server.close();
    }

    create_room_info() {
        UI.text(this.game, 15, 520, "Room code (click to copy invite link)", UI.SMALL, UI.GRAY);
        let code = UI.text(this.game, 15, 538, this.server.code, 34, UI.WHITE, true);
        code.inputEnabled = true;
        code.input.useHandCursor = true;
        code.events.onInputDown.add(() => this.copy_invite());

        // Leave button
        UI.link(this.game, 785, 566, "Leave", () => this.leave(), undefined, 1);
    }

    copy_invite() {
        UI.copyInvite(this.server.code, (msg) => this.show_toast(msg));
    }

    leave() {
        let others = this.server.isHost && this.server.host.queue.length > 1;
        if (others && !window.confirm("Leaving will end the game for everyone. Leave?")) return;
        this.game.state.start('Menu');
    }

    // Waiting room shown on top of the game screen
    show_lobby(info) {
        if (this.lobby) this.lobby.destroy();
        if (this.score_table) this.score_table.destroy();
        this.score_table = null;
        this.my_turn = false;
        this.line_origin = null;
        let g = this.lobby = this.game.add.group();
        let host = this.server.isHost;
        UI.panel(this.game, g);

        // Room code, big, so it's easy to read out to friends
        UI.text(this.game, 400, 25, "Room code", UI.SMALL, UI.GRAY, false, g, 0.5);
        UI.text(this.game, 400, 45, this.server.code, 64, UI.WHITE, true, g, 0.5);
        UI.button(this.game, 300, 125, 200, 36, "Copy Invite Link", () => this.copy_invite(), g);

        // Everyone who has joined, in up to 3 columns of 5
        let players = info.players || [];
        UI.text(this.game, 130, 185, "Players (" + players.length + ")", UI.HEADING, UI.WHITE, true, g);
        let rows = 5, cols = 3;
        let shown = players.length > rows * cols ? rows * cols - 1 : players.length;
        for (let i = 0; i < shown; i++) {
            let p = players[i];
            let label = p.username;
            if (p.host) label += " (host)";
            else if (p.username == this.username && p.color == this.my_color) label += " (you)";
            UI.text(this.game, 130 + Math.floor(i / rows) * 190, 225 + (i % rows) * 28, label,
                UI.BODY, UI.hex(p.color), true, g);
        }
        if (shown < players.length) {
            UI.text(this.game, 130 + 2 * 190, 225 + 4 * 28, "+" + (players.length - shown) + " more", UI.BODY, UI.GRAY, false, g);
        }

        // Board size: the host can change it, everyone else just sees it
        let size = info.size;
        UI.text(this.game, 130, 382, "Board size", UI.BODY, UI.GRAY, false, g);
        if (host) {
            let minus = UI.button(this.game, 280, 375, 40, 36, "-", () => this.server.emit("set_size", size - 1), g);
            UI.text(this.game, 370, 382, size + " x " + size, UI.BODY, UI.WHITE, true, g, 0.5);
            let plus = UI.button(this.game, 420, 375, 40, 36, "+", () => this.server.emit("set_size", size + 1), g);
            minus.setEnabled(size > HostService.MIN_SIZE);
            plus.setEnabled(size < HostService.MAX_SIZE);
        } else {
            UI.text(this.game, 280, 382, size + " x " + size, UI.BODY, UI.WHITE, true, g);
        }

        // Start button for the host, a waiting message for everyone else
        if (host) {
            let start = UI.button(this.game, 290, 435, 220, 50, "Start Game!", () => this.server.emit("start"), g);
            if (players.length < 2) {
                start.setEnabled(false);
                UI.text(this.game, 400, 492, "Waiting for at least 2 players...", UI.SMALL, UI.GRAY, false, g, 0.5);
            }
        } else {
            UI.text(this.game, 400, 450, "Waiting for " + (info.host || "the host") + " to start the game...",
                UI.BODY, UI.GRAY, false, g, 0.5);
        }

        UI.paragraph(this.game, 400, 525,
            "How to play: drag from a dot to a neighboring dot to draw a line. " +
            "Close a square to score and go again. Most squares wins.", 520, UI.SMALL, UI.GRAY, g, 0.5);
        UI.link(this.game, 785, 566, "Leave", () => this.leave(), g, 1);
    }

    // The host started the game: build a fresh board
    server_board(size: number) {
        if (this.lobby) this.lobby.destroy();
        this.lobby = null;
        if (this.score_table) this.score_table.destroy();
        this.score_table = null;
        this.score_text.text = "Score: 0";
        this.create_nodes(size);
    }

    // Draw the game grid
    create_nodes(size: number) {
        this.size = size;
        this.spacing = Sqrz.BOARD_PIXELS / size;
        this.line_width = Math.round(Math.max(4, Math.min(8, this.spacing * 0.12)));
        let dot_size = Math.max(10, Math.min(16, this.spacing * 0.4));
        let hit_size = Math.min(this.spacing * 0.9, 40);
        this.line_origin = null;
        this.drawn = {};
        this.nodes.removeAll(true);
        this.line_layer.removeAll(true);
        this.square_layer.removeAll(true);

        // Draw the circles
        for (let r = 0; r <= size; r++) {
            for (let c = 0; c <= size; c++) {
                let dot = this.game.add.graphics(this._x(c), this._y(r), this.nodes);
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
    }

    handle_node_click(sprite: Phaser.Sprite, cursor: Phaser.Pointer) {
        // Remove the click origin point (as the click is over)
        this.line_origin = null;
        // Find the dot under the pointer
        let sprite2 = this.dot_at(cursor.x, cursor.y);
        if (sprite2 === sprite) return;
        if (!sprite2) {
            // Let go over empty space after dragging
            if (Phaser.Math.distance(sprite.x, sprite.y, cursor.x, cursor.y) > this.spacing / 2) {
                this.show_toast("Let go on a neighboring dot to draw a line.", true);
            }
            return;
        }
        let coords1 = { x: this._column(sprite.x), y: this._row(sprite.y) };
        let coords2 = { x: this._column(sprite2.x), y: this._row(sprite2.y) };
        // Explain bad moves right away instead of waiting for the host
        if (!this.my_turn) return this.show_toast("It's not your turn.", true);
        if (!this.adjacent(coords1, coords2)) return this.show_toast("Lines can only connect neighboring dots.", true);
        if (this.drawn[this.line_key(coords1, coords2)]) return this.show_toast("That line is already drawn.", true);
        // Send a message to the server
        this.server.emit('draw_line', coords1, coords2);
    }

    dot_at(x: number, y: number): Phaser.Sprite {
        let found: Phaser.Sprite = null;
        let reach = this.spacing * 0.45;
        this.nodes.forEach((dot: Phaser.Sprite) => {
            if (Math.abs(dot.x - x) <= reach && Math.abs(dot.y - y) <= reach) found = dot;
        }, this);
        return found;
    }

    adjacent(a, b): boolean {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) == 1;
    }

    line_key(a, b): string {
        return Math.min(a.x, b.x) + '_' + Math.min(a.y, b.y) + '_' + Math.max(a.x, b.x) + '_' + Math.max(a.y, b.y);
    }

    server_draw_line(game: Phaser.Game, coords1, coords2, color: number) {
        if (!this.size) return;
        this.drawn[this.line_key(coords1, coords2)] = true;
        let new_line: Phaser.Graphics = game.add.graphics(0, 0, this.line_layer);
        // Line style for the line
        new_line.lineStyle(this.line_width, color);
        new_line.moveTo(this._x(coords1.x), this._y(coords1.y));
        new_line.lineTo(this._x(coords2.x), this._y(coords2.y));
        // Fade it in
        new_line.alpha = 0;
        game.add.tween(new_line).to({ alpha: 1 }, 200, Phaser.Easing.Quadratic.Out, true);
    }

    server_fill_square(x: number, y: number, color: number) {
        if (!this.size) return;
        let size = this.spacing;
        // Draw around the square's centre so it can pop in
        let square = this.game.add.graphics(this._x(x) + size / 2, this._y(y) + size / 2, this.square_layer);
        square.beginFill(color, 0.5);
        square.drawRect(-size / 2, -size / 2, size, size);
        square.endFill();
        square.scale.set(0.2, 0.2);
        this.game.add.tween(square.scale).to({ x: 1, y: 1 }, 300, Phaser.Easing.Back.Out, true);
    }

    server_next_turn(name, color: number) {
        if (!name) {
            this.my_turn = false;
            this.turn_text.text = "";
            return;
        }
        let was_my_turn = this.my_turn;
        this.my_turn = name == this.username && color == this.my_color;
        this.turn_text.text = this.my_turn ? "Your Turn!" : name + "'s Turn!";
        this.turn_text.fill = UI.hex(color);
        if (this.my_turn && !was_my_turn) this.bounce(this.turn_text);
    }

    server_update_leaderboard(game: Phaser.Game, leaderboard) {
        // Delete everything else
        this.board_display.forEach((text) => {
            text.destroy();
        });
        this.board_display = [];
        // Add all the texts for the leaders
        for (let i = 0; i < 5; i++) {
            if (leaderboard[i]) {
                this.board_display.push(UI.text(game, 600, 25 * i + 50,
                    leaderboard[i].username + ': ' + leaderboard[i].score,
                    UI.SMALL + 2, UI.hex(leaderboard[i].color), true));
            }
        }
        if (leaderboard.length > 5) {
            this.board_display.push(UI.text(game, 600, 25 * 5 + 50, "+" + (leaderboard.length - 5) + " more",
                UI.SMALL, UI.GRAY));
        }
    }

    // Grid is completely connected: show the score table
    server_game_over(leaderboard) {
        if (this.score_table) this.score_table.destroy();
        this.my_turn = false;
        this.line_origin = null;
        this.turn_text.text = "Game Over!";
        this.turn_text.fill = UI.WHITE;

        let table = this.score_table = this.game.add.group();
        UI.panel(this.game, table, 0.85);

        let top = leaderboard.length ? leaderboard[0].score : 0;
        let winners = leaderboard.filter((p) => p.score == top);
        let headline = winners.length > 1 ? "It's a tie!" : winners[0].username + " wins!";
        UI.text(this.game, 400, 80, headline, UI.TITLE, winners.length == 1 ? UI.hex(winners[0].color) : UI.WHITE, true, table, 0.5);

        leaderboard.slice(0, 8).forEach((p, i) => {
            let y = 170 + i * 36;
            let rank = leaderboard.filter((q) => q.score > p.score).length + 1;
            UI.text(this.game, 250, y, rank + ".", UI.BODY + 4, UI.GRAY, true, table);
            UI.text(this.game, 290, y, p.username, UI.BODY + 4, UI.hex(p.color), true, table);
            UI.text(this.game, 550, y, String(p.score), UI.BODY + 4, UI.WHITE, true, table, 1);
        });
        if (leaderboard.length > 8) {
            UI.text(this.game, 290, 170 + 8 * 36, "+" + (leaderboard.length - 8) + " more", UI.SMALL, UI.GRAY, false, table);
        }

        if (this.server.isHost) {
            UI.button(this.game, 175, 500, 210, 50, "Play Again!", () => this.server.emit("start"), table);
            UI.button(this.game, 415, 500, 210, 50, "Change Settings", () => this.server.emit("lobby"), table);
        } else {
            UI.text(this.game, 400, 512, "Waiting for the host to start a new game...", UI.BODY, UI.GRAY, false, table, 0.5);
        }

        table.alpha = 0;
        this.game.add.tween(table).to({ alpha: 1 }, 400, Phaser.Easing.Quadratic.Out, true);
    }

    show_toast(msg: string, error = false, color?: number) {
        this.toast.text = msg;
        this.toast.fill = error ? UI.RED : color ? UI.hex(color) : UI.GRAY;
        // Keep it visible over the lobby and score table
        this.game.world.bringToTop(this.toast);
        this.game.tweens.removeFrom(this.toast);
        this.toast.alpha = 1;
        this.game.add.tween(this.toast).to({ alpha: 0 }, 600, Phaser.Easing.Linear.None, true, 2200);
    }

    bounce(text: Phaser.Text) {
        this.game.tweens.removeFrom(text.scale);
        text.scale.set(1.25, 1.25);
        this.game.add.tween(text.scale).to({ x: 1, y: 1 }, 300, Phaser.Easing.Back.Out, true);
    }

    update_cursor_line() {
        // Clear the line
        this.line.clear();
        // Check if we should be drawing a line
        if (this.line_origin) {
            // Snap to a neighboring dot when the pointer is over one
            let end: { x: number, y: number } = this.ptr;
            let target = this.dot_at(this.ptr.x, this.ptr.y);
            if (target && this.adjacent(
                { x: this._column(target.x), y: this._row(target.y) },
                { x: this._column(this.line_origin.x), y: this._row(this.line_origin.y) })) {
                end = target;
            }
            // Line style for the line (faded out if it's not our turn)
            this.line.lineStyle(this.line_width, this.my_color, this.my_turn ? 1 : 0.3);
            // Draw from the mouse
            this.line.moveTo(end.x, end.y);
            // Draw to the center (the dot)
            this.line.lineTo(this.line_origin.x, this.line_origin.y);
        }
    }

    _column(x: number) {
        return Math.round((x - Sqrz.BOARD_LEFT) / this.spacing);
    }

    _row(y: number) {
        return Math.round((y - Sqrz.BOARD_TOP) / this.spacing);
    }

    _x(column: number) {
        return column * this.spacing + Sqrz.BOARD_LEFT;
    }

    _y(row: number) {
        return row * this.spacing + Sqrz.BOARD_TOP;
    }

}
