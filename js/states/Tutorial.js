// How to play: three small animated examples and how to play with friends.
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
var Tutorial = /** @class */ (function (_super) {
    __extends(Tutorial, _super);
    function Tutorial() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Tutorial.prototype.create = function () {
        var _this = this;
        console.log("State: Tutorial");
        UI.text(this.game, 400, 25, "How to Play", UI.TITLE, UI.WHITE, true, undefined, 0.5);
        this.draw_lines_example(150, 115);
        this.close_square_example(400, 115);
        this.winner_example(650, 115);
        UI.paragraph(this.game, 150, 215, "Drag from a dot to a neighboring dot to draw a line. Then it's the next player's turn.", 210, UI.SMALL, UI.WHITE, undefined, 0.5);
        UI.paragraph(this.game, 400, 215, "Draw the 4th side of a square to claim it. You score a point and go again.", 210, UI.SMALL, UI.WHITE, undefined, 0.5);
        UI.paragraph(this.game, 650, 215, "When every square is claimed, the player with the most squares wins.", 210, UI.SMALL, UI.WHITE, undefined, 0.5);
        UI.text(this.game, 90, 320, "Playing with friends", UI.HEADING, UI.WHITE, true);
        UI.paragraph(this.game, 90, 360, "1. Enter a name and click Host Game.\n" +
            "2. Send your friends the room code, or click the code to copy an invite link.\n" +
            "3. Friends type the code and click Join, or just open the link.\n" +
            "4. Pick a board size and click Start Game. You need at least 2 players.", 640, UI.SMALL + 2, UI.GRAY);
        UI.button(this.game, 300, 525, 200, 46, "Back", function () { return _this.game.state.start('Menu'); });
    };
    // A finger drags from one dot to the next and the line follows
    Tutorial.prototype.draw_lines_example = function (cx, top) {
        var _this = this;
        var s = 70, left = cx - s / 2;
        var line = this.segment(left, top, s, 0, Tutorial.RED);
        this.dots(left, top, s, 1);
        var finger = this.game.add.graphics(left, top);
        finger.beginFill(0xffffff, 0.35);
        finger.drawCircle(0, 0, 30);
        finger.endFill();
        var play = function () {
            line.scale.x = 0;
            finger.x = left;
            finger.alpha = 1;
            _this.game.add.tween(line.scale).to({ x: 1 }, 700, Phaser.Easing.Quadratic.InOut, true, 300);
            _this.game.add.tween(finger).to({ x: left + s }, 700, Phaser.Easing.Quadratic.InOut, true, 300);
            _this.game.add.tween(finger).to({ alpha: 0 }, 300, Phaser.Easing.Linear.None, true, 1100);
        };
        play();
        this.game.time.events.loop(2600, play);
    };
    // Three sides are there; the fourth closes the square and scores
    Tutorial.prototype.close_square_example = function (cx, top) {
        var _this = this;
        var s = 70, left = cx - s / 2;
        var fill = this.square(left, top, s, Tutorial.RED);
        this.segment(left, top, s, 0, Tutorial.BLUE);
        this.segment(left, top, 0, s, Tutorial.BLUE);
        this.segment(left, top + s, s, 0, Tutorial.RED);
        var last = this.segment(left + s, top, 0, s, Tutorial.RED);
        this.dots(left, top, s, 1);
        var plus = UI.text(this.game, left + s + 30, top + 15, "+1", UI.HEADING, UI.hex(Tutorial.RED), true);
        var play = function () {
            last.scale.y = 0;
            fill.alpha = 0;
            plus.alpha = 0;
            _this.game.add.tween(last.scale).to({ y: 1 }, 500, Phaser.Easing.Quadratic.InOut, true, 400);
            _this.game.add.tween(fill).to({ alpha: 1 }, 300, Phaser.Easing.Quadratic.Out, true, 950);
            _this.game.add.tween(plus).to({ alpha: 1 }, 200, Phaser.Easing.Linear.None, true, 950);
        };
        play();
        this.game.time.events.loop(2600, play);
    };
    // A finished 2x2 board: red has 3, blue has 1
    Tutorial.prototype.winner_example = function (cx, top) {
        var _this = this;
        var s = 35, left = cx - s;
        var owners = [Tutorial.RED, Tutorial.RED, Tutorial.BLUE, Tutorial.RED];
        owners.forEach(function (color, i) { return _this.square(left + (i % 2) * s, top + Math.floor(i / 2) * s, s, color); });
        for (var i = 0; i <= 2; i++) {
            this.segment(left, top + i * s, 2 * s, 0, 0xcccccc);
            this.segment(left + i * s, top, 0, 2 * s, 0xcccccc);
        }
        this.dots(left, top, s, 2);
        UI.text(this.game, cx + s + 15, top + 10, "3", UI.HEADING, UI.hex(Tutorial.RED), true);
        UI.text(this.game, cx + s + 15, top + 40, "1", UI.HEADING, UI.hex(Tutorial.BLUE), true);
    };
    // A grid of (n+1) x (n+1) dots
    Tutorial.prototype.dots = function (left, top, s, n) {
        for (var r = 0; r <= n; r++) {
            for (var c = 0; c <= n; c++) {
                var dot = this.game.add.graphics(left + c * s, top + r * s);
                dot.beginFill(0xffffff);
                dot.drawCircle(0, 0, 14);
                dot.endFill();
            }
        }
    };
    // A line from (x, y) going dx across and dy down; scale it to animate drawing
    Tutorial.prototype.segment = function (x, y, dx, dy, color) {
        var g = this.game.add.graphics(x, y);
        g.lineStyle(6, color);
        g.moveTo(0, 0);
        g.lineTo(dx, dy);
        return g;
    };
    Tutorial.prototype.square = function (x, y, s, color) {
        var g = this.game.add.graphics(x, y);
        g.beginFill(color, 0.5);
        g.drawRect(0, 0, s, s);
        g.endFill();
        return g;
    };
    Tutorial.RED = 0xff5d73;
    Tutorial.BLUE = 0x3fa7ff;
    return Tutorial;
}(Phaser.State));
//# sourceMappingURL=Tutorial.js.map