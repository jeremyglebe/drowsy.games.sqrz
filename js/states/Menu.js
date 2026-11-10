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
var Menu = /** @class */ (function (_super) {
    __extends(Menu, _super);
    function Menu() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    // A message to show when we arrive here (e.g. "The host left the game")
    Menu.prototype.init = function (message) {
        this.message = message || '';
    };
    Menu.prototype.create = function () {
        var _this = this;
        // Log that we've entered the state
        console.log("State: Menu");
        this.game.plugins.add(PhaserInput.Plugin);
        this.busy = false;
        this.buttons = [];
        this.draw_logo();
        var field_style = {
            font: '18px Arial',
            fill: '#212121',
            fontWeight: 'bold',
            padding: 8,
            borderWidth: 1,
            borderColor: '#000',
            borderRadius: 6,
            type: PhaserInput.InputType.text
        };
        this.name_input = this.game.add.inputField(300, 290, Object.assign({
            width: 200,
            max: '14',
            placeHolder: 'Username'
        }, field_style));
        this.name_input.setText(this.load_pref('sqrz_name'));
        // Create a host button
        this.make_button(300, 340, 216, 46, "Host Game!", function () { return _this.host_game(); });
        this.game.add.text(400, 418, "or join a friend's room", {
            font: '16px Arial',
            fill: '#9a9a9a'
        }).anchor.set(0.5);
        this.code_input = this.game.add.inputField(300, 440, Object.assign({
            width: 100,
            max: '4',
            placeHolder: 'CODE',
            forceCase: PhaserInput.ForceCase.upper,
            textAlign: 'center'
        }, field_style));
        // Invite links look like ?room=ABCD
        var match = /[?&]room=([A-Za-z]{4})/.exec(window.location.search);
        if (match)
            this.code_input.setText(match[1].toUpperCase());
        // Create a join button
        this.make_button(426, 440, 90, 36, "Join!", function () { return _this.join_game(); });
        this.status_text = this.game.add.text(400, 530, this.message, {
            font: '18px Arial',
            fill: '#ff5d73',
            align: 'center'
        });
        this.status_text.anchor.set(0.5);
    };
    // Big title with a little square being "drawn" next to it
    Menu.prototype.draw_logo = function () {
        var _this = this;
        var title = this.game.add.text(400, 120, "sqrz", {
            font: 'bold 96px Arial',
            fill: '#ffffff'
        });
        title.anchor.set(0.5);
        this.game.add.tween(title).to({ y: 128 }, 1400, Phaser.Easing.Sinusoidal.InOut, true, 0, -1, true);
        this.game.add.text(400, 200, "a game about connecting squares", {
            font: '20px Arial',
            fill: '#9a9a9a'
        }).anchor.set(0.5);
        // Four dots, four coloured sides, one filled square, on loop
        var x = 535, y = 90, s = 44;
        var fill = this.game.add.graphics(x, y);
        fill.beginFill(0xffc145, 0.45);
        fill.drawRect(0, 0, s, s);
        fill.endFill();
        fill.alpha = 0;
        var colors = [0xff5d73, 0x3fa7ff, 0xff5d73, 0xffc145];
        var sides = [[0, 0, s, 0], [s, 0, s, s], [0, s, s, s], [0, 0, 0, s]].map(function (p, i) {
            var g = _this.game.add.graphics(x, y);
            g.lineStyle(4, colors[i]);
            g.moveTo(p[0], p[1]);
            g.lineTo(p[2], p[3]);
            g.alpha = 0;
            return g;
        });
        [[0, 0], [s, 0], [0, s], [s, s]].forEach(function (p) {
            var dot = _this.game.add.graphics(x + p[0], y + p[1]);
            dot.beginFill(0xffffff);
            dot.drawCircle(0, 0, 12);
            dot.endFill();
        });
        var step = 0;
        this.game.time.events.loop(450, function () {
            if (step < 4)
                sides[step].alpha = 1;
            else if (step == 4)
                _this.game.add.tween(fill).to({ alpha: 1 }, 250, Phaser.Easing.Quadratic.Out, true);
            else if (step == 9) {
                sides.forEach(function (g) { return g.alpha = 0; });
                fill.alpha = 0;
                step = -1;
            }
            step++;
        });
    };
    Menu.prototype.make_button = function (x, y, w, h, label, onClick) {
        var _this = this;
        var button = this.game.add.graphics(x, y);
        // Draw the button
        button.beginFill(0xFFFFFF);
        button.drawRoundedRect(0, 0, w, h, 6);
        button.endFill();
        // Enable button input
        button.inputEnabled = true;
        button.input.useHandCursor = true;
        button.events.onInputOver.add(function () { return button.tint = 0xdddddd; });
        button.events.onInputOut.add(function () { return button.tint = 0xffffff; });
        // Create a listener
        button.events.onInputDown.add(function () { if (!_this.busy)
            onClick(); });
        // Add text to the button
        var text = this.game.add.text(x + w / 2, y + h / 2 + 2, label, {
            font: 'bold 20px Arial',
            fill: 'black'
        });
        text.anchor.set(0.5);
        this.buttons.push(button);
        return button;
    };
    Menu.prototype.username = function () {
        var name = this.name_input.value.trim();
        if (!name) {
            this.show_status("Pick a username first!");
            this.name_input.startFocus();
            return null;
        }
        this.save_pref('sqrz_name', name);
        return name;
    };
    Menu.prototype.host_game = function () {
        var _this = this;
        var name = this.username();
        if (!name)
            return;
        this.set_busy("Creating a room...");
        NetworkService.createRoom(function (net) { return _this.game.state.start('Sqrz', true, false, name, net); }, function (msg) { return _this.fail(msg); });
    };
    Menu.prototype.join_game = function () {
        var _this = this;
        var code = this.code_input.value.trim().toUpperCase();
        if (!/^[A-Z]{4}$/.test(code)) {
            this.show_status("Room codes are 4 letters.");
            this.code_input.startFocus();
            return;
        }
        var name = this.username();
        if (!name)
            return;
        this.set_busy("Joining room " + code + "...");
        NetworkService.joinRoom(code, function (net) { return _this.game.state.start('Sqrz', true, false, name, net); }, function (msg) { return _this.fail(msg); });
    };
    Menu.prototype.set_busy = function (msg) {
        this.busy = true;
        this.buttons.forEach(function (b) { return b.alpha = 0.5; });
        this.show_status(msg, '#ffffff');
    };
    Menu.prototype.fail = function (msg) {
        this.busy = false;
        this.buttons.forEach(function (b) { return b.alpha = 1; });
        this.show_status(msg);
    };
    Menu.prototype.show_status = function (msg, color) {
        if (color === void 0) { color = '#ff5d73'; }
        this.status_text.text = msg;
        this.status_text.fill = color;
    };
    Menu.prototype.load_pref = function (key) {
        try {
            return window.localStorage.getItem(key) || '';
        }
        catch (e) {
            return '';
        }
    };
    Menu.prototype.save_pref = function (key, value) {
        try {
            window.localStorage.setItem(key, value);
        }
        catch (e) { }
    };
    return Menu;
}(Phaser.State));
//# sourceMappingURL=Menu.js.map