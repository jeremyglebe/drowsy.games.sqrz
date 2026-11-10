
// This state represents the actual gameplay

class Sqrz extends Phaser.State {

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
    // Short-lived messages ("Sam joined")
    toast: Phaser.Text;

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
        this.my_color = 0xff0000;
        this.my_turn = false;
        this.score_table = null;
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
        this.score_text = this.game.add.text(15, 15, "Score: 0", { fill: 'white' });
        // leaderboard
        this.board_display = [];
        this.game.add.text(600, 20, "Leaderboard", { font: 'bold 18px Arial', fill: '#9a9a9a' });
        // Turn text
        this.turn_text = this.game.add.text(390, 400, "Waiting for players...", { fill: 'white' });
        this.turn_text.anchor.set(0.5);
        // Room code, so friends can join
        this.create_room_info();
        // Notifications
        this.toast = this.game.add.text(390, 560, "", { font: '18px Arial', fill: '#9a9a9a' });
        this.toast.anchor.set(0.5);

        // Draw all the dots
        for (let r = 0; r < 11; r++) {
            for (let c = 0; c < 11; c++) {
                this.game.add.graphics(this._x(c), this._y(r), this.nodes);
            }
        }
        this.create_nodes();

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
            this.score_text.fill = this._hex(color);
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

        // The grid is full: show the final scores
        this.server.on("game_over", (leaderboard) => {
            this.server_game_over(leaderboard);
        });

        // The host started a new round
        this.server.on("reset", () => {
            this.server_reset();
        });

        this.server.on("player_joined", (name, color) => {
            if (name != this.username) this.show_toast(name + " joined", color);
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
        let label = this.game.add.text(15, 520, "Room code", { font: '16px Arial', fill: '#9a9a9a' });
        let code = this.game.add.text(15, 538, this.server.code, { font: 'bold 34px Arial', fill: 'white' });
        if (this.server.isHost) {
            label.text = "Room code (click to copy invite link)";
            code.inputEnabled = true;
            code.input.useHandCursor = true;
            code.events.onInputDown.add(() => {
                let link = window.location.origin + window.location.pathname + '?room=' + this.server.code;
                let nav: any = navigator;
                if (nav.clipboard) {
                    nav.clipboard.writeText(link).then(() => this.show_toast("Invite link copied!"),
                        () => window.prompt("Invite link:", link));
                } else {
                    window.prompt("Invite link:", link);
                }
            });
        }

        // Leave button
        let leave = this.game.add.text(785, 575, "Leave", { font: '16px Arial', fill: '#9a9a9a' });
        leave.anchor.set(1, 0.5);
        leave.inputEnabled = true;
        leave.input.useHandCursor = true;
        leave.events.onInputDown.add(() => {
            if (this.server.isHost && !window.confirm("Leaving will end the game for everyone. Leave?")) return;
            this.game.state.start('Menu');
        });
    }

    // Draw the game grid
    create_nodes() {
        // Draw the circles
        this.nodes.forEach((dot: Phaser.Graphics) => {
            // Set the fill color
            dot.beginFill(0xFFFFFF);
            // Draw the circle (small enough that lines and squares show between dots)
            dot.drawCircle(0, 0, 12);
            // End the filling
            dot.endFill();
            // ...but keep a generous area to click/tap on
            dot.hitArea = new Phaser.Circle(0, 0, 26);
        }, this, true);

        // Handle clicking on dots (should start a line)
        this.nodes.onChildInputDown.add((sprite: Phaser.Sprite, cursor: Phaser.Pointer) => {
            this.line_origin = sprite;
        }, this)

        // Handle releasing a click on a dot (tries to make a new permanent line)
        this.nodes.onChildInputUp.add(this.handle_node_click, this);
    }

    handle_node_click(sprite: Phaser.Sprite, cursor: Phaser.Pointer) {
        // Remove the click origin point (as the click is over)
        this.line_origin = null;
        // Find the dot under the pointer (if they let go over empty space, do nothing)
        let sprite2 = this.dot_at(cursor.x, cursor.y);
        if (!sprite2 || sprite2 === sprite) return;
        let sprite1 = sprite;
        // Send a message to the server
        this.server.emit('draw_line',
            {
                x: this._column(sprite1.x),
                y: this._row(sprite1.y)
            },
            {
                x: this._column(sprite2.x),
                y: this._row(sprite2.y)
            }
        );
    }

    dot_at(x: number, y: number): Phaser.Sprite {
        let found: Phaser.Sprite = null;
        this.nodes.forEach((dot: Phaser.Sprite) => {
            if (Math.abs(dot.x - x) <= 13 && Math.abs(dot.y - y) <= 13) found = dot;
        }, this);
        return found;
    }

    server_draw_line(game: Phaser.Game, coords1, coords2, color: number) {
        let new_line: Phaser.Graphics = game.add.graphics(0, 0, this.line_layer);
        // Line style for the line
        new_line.lineStyle(4, color);
        new_line.moveTo(this._x(coords1.x), this._y(coords1.y));
        new_line.lineTo(this._x(coords2.x), this._y(coords2.y));
        // Fade it in
        new_line.alpha = 0;
        game.add.tween(new_line).to({ alpha: 1 }, 200, Phaser.Easing.Quadratic.Out, true);
    }

    server_fill_square(x: number, y: number, color: number) {
        let size = 30;
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
            this.turn_text.text = "Waiting for players...";
            this.turn_text.fill = 'white';
            return;
        }
        let was_my_turn = this.my_turn;
        this.my_turn = name == this.username && color == this.my_color;
        this.turn_text.text = this.my_turn ? "Your Turn!" : name + "'s Turn!";
        this.turn_text.fill = this._hex(color);
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
                this.board_display.push(game.add.text(600, 25 * i + 50,
                    leaderboard[i].username + ': ' + leaderboard[i].score,
                    {
                        fill: this._hex(leaderboard[i].color),
                        font: 'bold 18px Arial'
                    }));
            }
        }
        if (leaderboard.length > 5) {
            this.board_display.push(game.add.text(600, 25 * 5 + 50, "+" + (leaderboard.length - 5) + " more",
                { font: '16px Arial', fill: '#9a9a9a' }));
        }
    }

    // Grid is completely connected: show the score table
    server_game_over(leaderboard) {
        if (this.score_table) this.score_table.destroy();
        this.my_turn = false;
        this.line_origin = null;
        this.turn_text.text = "Game Over!";
        this.turn_text.fill = 'white';

        let table = this.score_table = this.game.add.group();
        let shade = this.game.add.graphics(0, 0, table);
        shade.beginFill(0x000000, 0.8);
        shade.drawRect(0, 0, 800, 600);
        shade.endFill();
        // Swallow clicks so you can't keep drawing underneath
        shade.inputEnabled = true;

        let top = leaderboard.length ? leaderboard[0].score : 0;
        let winners = leaderboard.filter((p) => p.score == top);
        let headline = winners.length > 1 ? "It's a tie!" : winners[0].username + " wins!";
        let title = this.game.add.text(400, 110, headline, { font: 'bold 48px Arial', fill: winners.length == 1 ? this._hex(winners[0].color) : '#ffffff' }, table);
        title.anchor.set(0.5);

        leaderboard.slice(0, 8).forEach((p, i) => {
            let y = 190 + i * 36;
            let rank = leaderboard.filter((q) => q.score > p.score).length + 1;
            this.game.add.text(250, y, rank + ".", { font: 'bold 24px Arial', fill: '#9a9a9a' }, table);
            this.game.add.text(290, y, p.username, { font: 'bold 24px Arial', fill: this._hex(p.color) }, table);
            let score = this.game.add.text(550, y, String(p.score), { font: 'bold 24px Arial', fill: 'white' }, table);
            score.anchor.set(1, 0);
        });

        if (this.server.isHost) {
            let again = this.game.add.graphics(300, 500, table);
            again.beginFill(0xFFFFFF);
            again.drawRoundedRect(0, 0, 200, 50, 6);
            again.endFill();
            again.inputEnabled = true;
            again.input.useHandCursor = true;
            again.events.onInputDown.add(() => this.server.emit("restart"));
            let label = this.game.add.text(400, 527, "Play Again!", { font: 'bold 20px Arial', fill: 'black' }, table);
            label.anchor.set(0.5);
        } else {
            let wait = this.game.add.text(400, 525, "Waiting for the host to start a new game...", { font: '18px Arial', fill: '#9a9a9a' }, table);
            wait.anchor.set(0.5);
        }

        table.alpha = 0;
        this.game.add.tween(table).to({ alpha: 1 }, 400, Phaser.Easing.Quadratic.Out, true);
    }

    // New round: wipe the board
    server_reset() {
        if (this.score_table) this.score_table.destroy();
        this.score_table = null;
        this.square_layer.removeAll(true);
        this.line_layer.removeAll(true);
    }

    show_toast(msg: string, color?: number) {
        this.toast.text = msg;
        this.toast.fill = color ? this._hex(color) : '#9a9a9a';
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
            // Line style for the line (faded out if it's not our turn)
            this.line.lineStyle(4, this.my_color, this.my_turn ? 1 : 0.3);
            // Draw from the mouse
            this.line.moveTo(this.ptr.x, this.ptr.y);
            // Draw to the center (the dot)
            this.line.lineTo(this.line_origin.x, this.line_origin.y);
        }
    }

    _hex(color: number) {
        return '#' + ('000000' + (color || 0).toString(16)).slice(-6);
    }

    _column(x: number) {
        return (x - 240) / 30;
    }

    _row(y: number) {
        return (y - 50) / 30;
    }

    _x(column: number) {
        return column * 30 + 240
    }

    _y(row: number) {
        return row * 30 + 50
    }

}
