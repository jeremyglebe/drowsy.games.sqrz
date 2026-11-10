// How to play: three small animated examples and how to play with friends.

class Tutorial extends Phaser.State {

    static RED = 0xff5d73;
    static BLUE = 0x3fa7ff;

    create() {
        console.log("State: Tutorial");

        UI.text(this.game, 400, 25, "How to Play", UI.TITLE, UI.WHITE, true, undefined, 0.5);

        this.draw_lines_example(150, 115);
        this.close_square_example(400, 115);
        this.winner_example(650, 115);

        UI.paragraph(this.game, 150, 215,
            "Drag from a dot to a neighboring dot to draw a line. Then it's the next player's turn.",
            210, UI.SMALL, UI.WHITE, undefined, 0.5);
        UI.paragraph(this.game, 400, 215,
            "Draw the 4th side of a square to claim it. You score a point and go again.",
            210, UI.SMALL, UI.WHITE, undefined, 0.5);
        UI.paragraph(this.game, 650, 215,
            "When every square is claimed, the player with the most squares wins.",
            210, UI.SMALL, UI.WHITE, undefined, 0.5);

        UI.text(this.game, 90, 320, "Playing with friends", UI.HEADING, UI.WHITE, true);
        UI.paragraph(this.game, 90, 360,
            "1. Enter a name and click Host Game.\n" +
            "2. Send your friends the room code, or click the code to copy an invite link.\n" +
            "3. Friends type the code and click Join, or just open the link.\n" +
            "4. Pick a board size and click Start Game. You need at least 2 players.",
            640, UI.SMALL + 2, UI.GRAY);

        UI.button(this.game, 300, 525, 200, 46, "Back", () => this.game.state.start('Menu'));
    }

    // A finger drags from one dot to the next and the line follows
    draw_lines_example(cx: number, top: number) {
        let s = 70, left = cx - s / 2;
        let line = this.segment(left, top, s, 0, Tutorial.RED);
        this.dots(left, top, s, 1);
        let finger = this.game.add.graphics(left, top);
        finger.beginFill(0xffffff, 0.35);
        finger.drawCircle(0, 0, 30);
        finger.endFill();

        let play = () => {
            line.scale.x = 0;
            finger.x = left;
            finger.alpha = 1;
            this.game.add.tween(line.scale).to({ x: 1 }, 700, Phaser.Easing.Quadratic.InOut, true, 300);
            this.game.add.tween(finger).to({ x: left + s }, 700, Phaser.Easing.Quadratic.InOut, true, 300);
            this.game.add.tween(finger).to({ alpha: 0 }, 300, Phaser.Easing.Linear.None, true, 1100);
        };
        play();
        this.game.time.events.loop(2600, play);
    }

    // Three sides are there; the fourth closes the square and scores
    close_square_example(cx: number, top: number) {
        let s = 70, left = cx - s / 2;
        let fill = this.square(left, top, s, Tutorial.RED);
        this.segment(left, top, s, 0, Tutorial.BLUE);
        this.segment(left, top, 0, s, Tutorial.BLUE);
        this.segment(left, top + s, s, 0, Tutorial.RED);
        let last = this.segment(left + s, top, 0, s, Tutorial.RED);
        this.dots(left, top, s, 1);
        let plus = UI.text(this.game, left + s + 30, top + 15, "+1", UI.HEADING, UI.hex(Tutorial.RED), true);

        let play = () => {
            last.scale.y = 0;
            fill.alpha = 0;
            plus.alpha = 0;
            this.game.add.tween(last.scale).to({ y: 1 }, 500, Phaser.Easing.Quadratic.InOut, true, 400);
            this.game.add.tween(fill).to({ alpha: 1 }, 300, Phaser.Easing.Quadratic.Out, true, 950);
            this.game.add.tween(plus).to({ alpha: 1 }, 200, Phaser.Easing.Linear.None, true, 950);
        };
        play();
        this.game.time.events.loop(2600, play);
    }

    // A finished 2x2 board: red has 3, blue has 1
    winner_example(cx: number, top: number) {
        let s = 35, left = cx - s;
        let owners = [Tutorial.RED, Tutorial.RED, Tutorial.BLUE, Tutorial.RED];
        owners.forEach((color, i) => this.square(left + (i % 2) * s, top + Math.floor(i / 2) * s, s, color));
        for (let i = 0; i <= 2; i++) {
            this.segment(left, top + i * s, 2 * s, 0, 0xcccccc);
            this.segment(left + i * s, top, 0, 2 * s, 0xcccccc);
        }
        this.dots(left, top, s, 2);
        UI.text(this.game, cx + s + 15, top + 10, "3", UI.HEADING, UI.hex(Tutorial.RED), true);
        UI.text(this.game, cx + s + 15, top + 40, "1", UI.HEADING, UI.hex(Tutorial.BLUE), true);
    }

    // A grid of (n+1) x (n+1) dots
    dots(left: number, top: number, s: number, n: number) {
        for (let r = 0; r <= n; r++) {
            for (let c = 0; c <= n; c++) {
                let dot = this.game.add.graphics(left + c * s, top + r * s);
                dot.beginFill(0xffffff);
                dot.drawCircle(0, 0, 14);
                dot.endFill();
            }
        }
    }

    // A line from (x, y) going dx across and dy down; scale it to animate drawing
    segment(x: number, y: number, dx: number, dy: number, color: number): Phaser.Graphics {
        let g = this.game.add.graphics(x, y);
        g.lineStyle(6, color);
        g.moveTo(0, 0);
        g.lineTo(dx, dy);
        return g;
    }

    square(x: number, y: number, s: number, color: number): Phaser.Graphics {
        let g = this.game.add.graphics(x, y);
        g.beginFill(color, 0.5);
        g.drawRect(0, 0, s, s);
        g.endFill();
        return g;
    }

}
