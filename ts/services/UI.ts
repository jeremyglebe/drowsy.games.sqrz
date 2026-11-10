// Shared look for every screen: one font, one set of text sizes and colours,
// and one button style.

interface UIButton {
    bg: Phaser.Graphics;
    label: Phaser.Text;
    setEnabled(enabled: boolean): void;
}

class UI {

    static WHITE = '#ffffff';
    static GRAY = '#9a9a9a';
    static RED = '#ff5d73';

    // Text sizes
    static TITLE = 48;
    static HEADING = 26;
    static BODY = 20;
    static SMALL = 16;

    static style(size: number, color = UI.WHITE, bold = false): any {
        return { font: (bold ? 'bold ' : '') + size + 'px Arial', fill: color };
    }

    // Add text. anchorX of 0.5 centres it on x, 1 right-aligns it.
    static text(game: Phaser.Game, x: number, y: number, str: string, size: number,
        color = UI.WHITE, bold = false, group?: Phaser.Group, anchorX = 0): Phaser.Text {
        let t = game.add.text(x, y, str, UI.style(size, color, bold), group);
        t.anchor.set(anchorX, 0);
        return t;
    }

    // Wrapped paragraph of text
    static paragraph(game: Phaser.Game, x: number, y: number, str: string, width: number,
        size = UI.SMALL, color = UI.GRAY, group?: Phaser.Group, anchorX = 0): Phaser.Text {
        let style = UI.style(size, color);
        style.wordWrap = true;
        style.wordWrapWidth = width;
        style.align = anchorX == 0.5 ? 'center' : 'left';
        let t = game.add.text(x, y, str, style, group);
        t.anchor.set(anchorX, 0);
        return t;
    }

    // White rounded button with black bold text
    static button(game: Phaser.Game, x: number, y: number, w: number, h: number, label: string,
        onClick: () => void, group?: Phaser.Group): UIButton {
        let enabled = true;
        let bg = game.add.graphics(x, y, group);
        bg.beginFill(0xFFFFFF);
        bg.drawRoundedRect(0, 0, w, h, 6);
        bg.endFill();
        bg.inputEnabled = true;
        bg.input.useHandCursor = true;
        bg.events.onInputOver.add(() => { if (enabled) bg.tint = 0xdddddd; });
        bg.events.onInputOut.add(() => bg.tint = 0xffffff);
        bg.events.onInputDown.add(() => { if (enabled) onClick(); });
        let text = game.add.text(x + w / 2, y + h / 2 + 2, label,
            UI.style(h >= 44 ? UI.BODY : UI.SMALL + 2, '#000000', true), group);
        text.anchor.set(0.5);
        return {
            bg: bg,
            label: text,
            setEnabled: (on: boolean) => {
                enabled = on;
                bg.alpha = on ? 1 : 0.4;
                text.alpha = on ? 1 : 0.6;
                bg.input.useHandCursor = on;
                if (!on) bg.tint = 0xffffff;
            }
        };
    }

    // Gray text that acts as a link
    static link(game: Phaser.Game, x: number, y: number, label: string, onClick: () => void,
        group?: Phaser.Group, anchorX = 0): Phaser.Text {
        let t = UI.text(game, x, y, label, UI.SMALL, UI.GRAY, false, group, anchorX);
        t.inputEnabled = true;
        t.input.useHandCursor = true;
        t.events.onInputOver.add(() => t.fill = UI.WHITE);
        t.events.onInputOut.add(() => t.fill = UI.GRAY);
        t.events.onInputDown.add(onClick);
        return t;
    }

    // Full-screen black panel that blocks clicks to whatever is underneath
    static panel(game: Phaser.Game, group: Phaser.Group, alpha = 1): Phaser.Graphics {
        let shade = game.add.graphics(0, 0, group);
        shade.beginFill(0x000000, alpha);
        shade.drawRect(0, 0, 800, 600);
        shade.endFill();
        shade.inputEnabled = true;
        return shade;
    }

    static hex(color: number): string {
        return '#' + ('000000' + (color || 0).toString(16)).slice(-6);
    }

    // Link that drops you straight into a room's lobby
    static inviteLink(code: string): string {
        return window.location.origin + window.location.pathname + '?room=' + code;
    }

    static copyInvite(code: string, done: (msg: string) => void) {
        let link = UI.inviteLink(code);
        let nav: any = navigator;
        if (nav.clipboard && window.isSecureContext) {
            nav.clipboard.writeText(link).then(() => done("Invite link copied!"),
                () => window.prompt("Invite link:", link));
        } else {
            window.prompt("Invite link:", link);
        }
    }

}
