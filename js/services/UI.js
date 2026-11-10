// Shared look for every screen: one font, one set of text sizes and colours,
// and one button style.
var UI = /** @class */ (function () {
    function UI() {
    }
    UI.style = function (size, color, bold) {
        if (color === void 0) { color = UI.WHITE; }
        if (bold === void 0) { bold = false; }
        return { font: (bold ? 'bold ' : '') + size + 'px Arial', fill: color };
    };
    // Add text. anchorX of 0.5 centres it on x, 1 right-aligns it.
    UI.text = function (game, x, y, str, size, color, bold, group, anchorX) {
        if (color === void 0) { color = UI.WHITE; }
        if (bold === void 0) { bold = false; }
        if (anchorX === void 0) { anchorX = 0; }
        var t = game.add.text(x, y, str, UI.style(size, color, bold), group);
        t.anchor.set(anchorX, 0);
        return t;
    };
    // Wrapped paragraph of text
    UI.paragraph = function (game, x, y, str, width, size, color, group, anchorX) {
        if (size === void 0) { size = UI.SMALL; }
        if (color === void 0) { color = UI.GRAY; }
        if (anchorX === void 0) { anchorX = 0; }
        var style = UI.style(size, color);
        style.wordWrap = true;
        style.wordWrapWidth = width;
        style.align = anchorX == 0.5 ? 'center' : 'left';
        var t = game.add.text(x, y, str, style, group);
        t.anchor.set(anchorX, 0);
        return t;
    };
    // White rounded button with black bold text
    UI.button = function (game, x, y, w, h, label, onClick, group) {
        var enabled = true;
        var bg = game.add.graphics(x, y, group);
        bg.beginFill(0xFFFFFF);
        bg.drawRoundedRect(0, 0, w, h, 6);
        bg.endFill();
        bg.inputEnabled = true;
        bg.input.useHandCursor = true;
        bg.events.onInputOver.add(function () { if (enabled)
            bg.tint = 0xdddddd; });
        bg.events.onInputOut.add(function () { return bg.tint = 0xffffff; });
        bg.events.onInputDown.add(function () { if (enabled)
            onClick(); });
        var text = game.add.text(x + w / 2, y + h / 2 + 2, label, UI.style(h >= 44 ? UI.BODY : UI.SMALL + 2, '#000000', true), group);
        text.anchor.set(0.5);
        return {
            bg: bg,
            label: text,
            setEnabled: function (on) {
                enabled = on;
                bg.alpha = on ? 1 : 0.4;
                text.alpha = on ? 1 : 0.6;
                bg.input.useHandCursor = on;
                if (!on)
                    bg.tint = 0xffffff;
            }
        };
    };
    // Gray text that acts as a link
    UI.link = function (game, x, y, label, onClick, group, anchorX) {
        if (anchorX === void 0) { anchorX = 0; }
        var t = UI.text(game, x, y, label, UI.SMALL, UI.GRAY, false, group, anchorX);
        t.inputEnabled = true;
        t.input.useHandCursor = true;
        t.events.onInputOver.add(function () { return t.fill = UI.WHITE; });
        t.events.onInputOut.add(function () { return t.fill = UI.GRAY; });
        t.events.onInputDown.add(onClick);
        return t;
    };
    // Full-screen black panel that blocks clicks to whatever is underneath
    UI.panel = function (game, group, alpha) {
        if (alpha === void 0) { alpha = 1; }
        var shade = game.add.graphics(0, 0, group);
        shade.beginFill(0x000000, alpha);
        shade.drawRect(0, 0, 800, 600);
        shade.endFill();
        shade.inputEnabled = true;
        return shade;
    };
    UI.hex = function (color) {
        return '#' + ('000000' + (color || 0).toString(16)).slice(-6);
    };
    // Link that drops you straight into a room's lobby
    UI.inviteLink = function (code) {
        return window.location.origin + window.location.pathname + '?room=' + code;
    };
    UI.copyInvite = function (code, done) {
        var link = UI.inviteLink(code);
        var nav = navigator;
        if (nav.clipboard && window.isSecureContext) {
            nav.clipboard.writeText(link).then(function () { return done("Invite link copied!"); }, function () { return window.prompt("Invite link:", link); });
        }
        else {
            window.prompt("Invite link:", link);
        }
    };
    UI.WHITE = '#ffffff';
    UI.GRAY = '#9a9a9a';
    UI.RED = '#ff5d73';
    // Text sizes
    UI.TITLE = 48;
    UI.HEADING = 26;
    UI.BODY = 20;
    UI.SMALL = 16;
    return UI;
}());
//# sourceMappingURL=UI.js.map