// Service that provides device information
// Services are singletons
var DeviceService = /** @class */ (function () {
    function DeviceService() {
        // Assign the screen size
        this.width = window.innerWidth;
        this.height = window.innerHeight;
    }
    Object.defineProperty(DeviceService, "Instance", {
        // Get or create the instance of the service
        get: function () { return this._instance || (this._instance = new this()); },
        enumerable: false,
        configurable: true
    });
    return DeviceService;
}());
//# sourceMappingURL=DeviceService.js.map