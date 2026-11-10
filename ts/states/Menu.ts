class Menu extends Phaser.State {

    name_input: PhaserInput.InputField;
    code_input: PhaserInput.InputField;
    status_text: Phaser.Text;
    buttons: UIButton[];
    busy: boolean;
    message: string;

    // A message to show when we arrive here (e.g. "The host left the game")
    init(message?: string) {
        this.message = message || '';
    }

    create() {
        // Log that we've entered the state
        console.log("State: Menu");

        this.game.plugins.add(PhaserInput.Plugin);
        this.busy = false;
        this.buttons = [];

        this.draw_logo();

        let field_style = {
            font: UI.BODY - 2 + 'px Arial',
            fill: '#212121',
            fontWeight: 'bold',
            padding: 8,
            borderWidth: 1,
            borderColor: '#000',
            borderRadius: 6,
            type: PhaserInput.InputType.text
        };

        this.name_input = this.game.add.inputField(300, 280, (<any>Object).assign({
            width: 200,
            max: '14',
            placeHolder: 'Username'
        }, field_style));
        this.name_input.setText(this.load_pref('sqrz_name'));

        // Create a host button
        this.buttons.push(UI.button(this.game, 300, 330, 216, 46, "Host Game!", () => this.host_game()));

        UI.text(this.game, 400, 395, "or join a friend's room", UI.SMALL, UI.GRAY, false, undefined, 0.5);

        this.code_input = this.game.add.inputField(300, 420, (<any>Object).assign({
            width: 100,
            max: '4',
            placeHolder: 'CODE',
            forceCase: PhaserInput.ForceCase.upper,
            textAlign: 'center'
        }, field_style));

        // Create a join button
        this.buttons.push(UI.button(this.game, 426, 420, 90, 36, "Join!", () => this.join_game()));

        // Tutorial
        this.buttons.push(UI.button(this.game, 300, 480, 216, 36, "How to Play", () => this.game.state.start('Tutorial')));

        this.status_text = UI.text(this.game, 400, 540, this.message, UI.BODY - 2, UI.RED, true, undefined, 0.5);

        this.handle_invite();
    }

    // Invite links look like ?room=ABCD and take you straight to that room's lobby
    handle_invite() {
        let match = /[?&]room=([A-Za-z]{4})/.exec(window.location.search);
        if (!match) return;
        let code = match[1].toUpperCase();
        this.code_input.setText(code);
        // Only use the link once, so leaving the room doesn't send you back in
        window.history.replaceState(null, '', window.location.pathname);
        if (this.message) return;
        if (this.name_input.value.trim()) {
            this.join_game();
        } else {
            this.show_status("Enter a name, then click Join! to join room " + code + ".", UI.WHITE);
            this.name_input.startFocus();
        }
    }

    // Big title with a little square being "drawn" next to it
    draw_logo() {
        let title = this.game.add.text(400, 120, "sqrz", UI.style(96, UI.WHITE, true));
        title.anchor.set(0.5);
        this.game.add.tween(title).to({ y: 128 }, 1400, Phaser.Easing.Sinusoidal.InOut, true, 0, -1, true);

        UI.text(this.game, 400, 190, "a game about connecting squares", UI.BODY, UI.GRAY, false, undefined, 0.5);

        // Four dots, four coloured sides, one filled square, on loop
        let x = 535, y = 90, s = 44;
        let fill = this.game.add.graphics(x, y);
        fill.beginFill(0xffc145, 0.45);
        fill.drawRect(0, 0, s, s);
        fill.endFill();
        fill.alpha = 0;
        let colors = [0xff5d73, 0x3fa7ff, 0xff5d73, 0xffc145];
        let sides = [[0, 0, s, 0], [s, 0, s, s], [0, s, s, s], [0, 0, 0, s]].map((p, i) => {
            let g = this.game.add.graphics(x, y);
            g.lineStyle(4, colors[i]);
            g.moveTo(p[0], p[1]);
            g.lineTo(p[2], p[3]);
            g.alpha = 0;
            return g;
        });
        [[0, 0], [s, 0], [0, s], [s, s]].forEach((p) => {
            let dot = this.game.add.graphics(x + p[0], y + p[1]);
            dot.beginFill(0xffffff);
            dot.drawCircle(0, 0, 12);
            dot.endFill();
        });
        let step = 0;
        this.game.time.events.loop(450, () => {
            if (step < 4) sides[step].alpha = 1;
            else if (step == 4) this.game.add.tween(fill).to({ alpha: 1 }, 250, Phaser.Easing.Quadratic.Out, true);
            else if (step == 9) {
                sides.forEach((g) => g.alpha = 0);
                fill.alpha = 0;
                step = -1;
            }
            step++;
        });
    }

    username(): string {
        let name = this.name_input.value.trim();
        if (!name) {
            this.show_status("Pick a username first!");
            this.name_input.startFocus();
            return null;
        }
        this.save_pref('sqrz_name', name);
        return name;
    }

    host_game() {
        if (this.busy) return;
        let name = this.username();
        if (!name) return;
        this.set_busy("Creating a room...");
        NetworkService.createRoom(
            (net) => this.game.state.start('Sqrz', true, false, name, net),
            (msg) => this.fail(msg)
        );
    }

    join_game() {
        if (this.busy) return;
        let code = this.code_input.value.trim().toUpperCase();
        if (!/^[A-Z]{4}$/.test(code)) {
            this.show_status("Room codes are 4 letters.");
            this.code_input.startFocus();
            return;
        }
        let name = this.username();
        if (!name) return;
        this.set_busy("Joining room " + code + "...");
        NetworkService.joinRoom(code,
            (net) => this.game.state.start('Sqrz', true, false, name, net),
            (msg) => this.fail(msg)
        );
    }

    set_busy(msg: string) {
        this.busy = true;
        this.buttons.forEach((b) => b.setEnabled(false));
        this.show_status(msg, UI.WHITE);
    }

    fail(msg: string) {
        this.busy = false;
        this.buttons.forEach((b) => b.setEnabled(true));
        this.show_status(msg);
    }

    show_status(msg: string, color = UI.RED) {
        this.status_text.text = msg;
        this.status_text.fill = color;
    }

    load_pref(key: string): string {
        try { return window.localStorage.getItem(key) || ''; } catch (e) { return ''; }
    }

    save_pref(key: string, value: string) {
        try { window.localStorage.setItem(key, value); } catch (e) { }
    }

}
