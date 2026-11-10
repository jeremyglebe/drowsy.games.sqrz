// Handles initial setup for the game

class Boot extends Phaser.State {

    device: DeviceService;

    constructor() {
        super();
        this.device = DeviceService.Instance;
    }

    create() {
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

    }

}