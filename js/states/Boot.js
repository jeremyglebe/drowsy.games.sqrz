// Handles initial setup for the game
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
var Boot = /** @class */ (function (_super) {
    __extends(Boot, _super);
    function Boot() {
        var _this = _super.call(this) || this;
        _this.device = DeviceService.Instance;
        return _this;
    }
    Boot.prototype.create = function () {
        // Log that we've entered the state
        console.log("State: Boot");
        // Get the length of the shortest side of the screen
        var device_size = this.device.width < this.device.height ? this.device.width : this.device.height;
        console.log("device_size = ", device_size);
        // Set the scale mode to stay proportional
        this.game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
        this.game.scale.setMinMax(200, 150, 1600, 1200);
        this.game.scale.pageAlignHorizontally = true;
        this.game.scale.pageAlignVertically = true;
        // Keep running in background tabs so we don't miss other players' moves
        this.game.stage.disableVisibilityChange = true;
        // Start the next state
        this.game.state.start('Menu');
    };
    return Boot;
}(Phaser.State));
//# sourceMappingURL=Boot.js.map