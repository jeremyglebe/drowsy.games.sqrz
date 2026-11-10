// Peer-to-peer replacement for the old socket.io connection.
//
// One player hosts: their browser runs the HostService (the old server) and
// registers a PeerJS id made from a short room code. Everyone else connects
// straight to that id. The API mirrors socket.io (`on` / `emit`) so the game
// states don't care whether they're the host or a guest.
var NetworkService = /** @class */ (function () {
    function NetworkService(peer, code, isHost) {
        var _this = this;
        // Only set on the host
        this.host = null;
        this.conn = null;
        this.handlers = {};
        // Messages that arrive before the game state is ready for them
        this.backlog = [];
        this.started = false;
        this.closed = false;
        this.last_seen = {};
        this.guests = {};
        this.peer = peer;
        this.code = code;
        this.isHost = isHost;
        if (isHost) {
            this.host = new HostService();
            peer.on('connection', function (conn) { return _this.accept(conn); });
        }
        // If we lose the matchmaking server, reconnect so new players can still join
        peer.on('disconnected', function () {
            if (!_this.closed)
                setTimeout(function () { if (!_this.closed && !peer.destroyed)
                    peer.reconnect(); }, 1000);
        });
        // Notice players (or the host) who vanish without saying goodbye
        this.ping_timer = setInterval(function () { return _this.heartbeat(); }, NetworkService.PING_INTERVAL);
        window.addEventListener('beforeunload', function () { return _this.close(); });
    }
    // Create a room and become its host
    NetworkService.createRoom = function (onReady, onError, attempt) {
        if (attempt === void 0) { attempt = 0; }
        var code = '';
        for (var i = 0; i < 4; i++) {
            code += NetworkService.CODE_CHARS.charAt(Math.floor(Math.random() * NetworkService.CODE_CHARS.length));
        }
        var peer = new Peer(NetworkService.PREFIX + code);
        var done = false;
        peer.on('open', function () {
            done = true;
            var net = new NetworkService(peer, code, true);
            onReady(net);
        });
        peer.on('error', function (err) {
            if (done)
                return console.warn('Peer error', err);
            done = true;
            peer.destroy();
            // Someone already has this code, try another one
            if (err.type == 'unavailable-id' && attempt < 5)
                NetworkService.createRoom(onReady, onError, attempt + 1);
            else
                onError(NetworkService.describe(err));
        });
    };
    // Join somebody else's room by code
    NetworkService.joinRoom = function (code, onReady, onError) {
        var peer = new Peer();
        var done = false;
        var fail = function (msg) {
            if (done)
                return;
            done = true;
            peer.destroy();
            onError(msg);
        };
        var timer = setTimeout(function () { return fail("Couldn't reach room " + code + "."); }, 12000);
        peer.on('open', function () {
            var conn = peer.connect(NetworkService.PREFIX + code, { reliable: true, serialization: 'json' });
            conn.on('open', function () {
                if (done)
                    return;
                done = true;
                clearTimeout(timer);
                var net = new NetworkService(peer, code, false);
                net.attach(conn);
                onReady(net);
            });
        });
        peer.on('error', function (err) {
            if (err.type == 'peer-unavailable')
                fail('No room called ' + code + '.');
            else
                fail(NetworkService.describe(err));
        });
    };
    NetworkService.describe = function (err) {
        if (err && err.type == 'browser-incompatible')
            return "This browser doesn't support WebRTC.";
        return "Couldn't connect to the matchmaking server.";
    };
    // Listen for an event, same as socket.on
    NetworkService.prototype.on = function (event, handler) {
        (this.handlers[event] = this.handlers[event] || []).push(handler);
    };
    // Send an event to the host, same as socket.emit
    NetworkService.prototype.emit = function (event) {
        var _this = this;
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        if (this.closed)
            return;
        if (this.isHost) {
            // Our own moves go straight into the host logic
            setTimeout(function () { return _this.host.handle(NetworkService.LOCAL_ID, event, args); }, 0);
        }
        else if (this.conn && this.conn.open) {
            this.conn.send({ e: event, a: args });
        }
    };
    // Call once all the `on` handlers are registered
    NetworkService.prototype.start = function () {
        var _this = this;
        this.started = true;
        if (this.isHost) {
            this.host.connect({
                id: NetworkService.LOCAL_ID,
                send: function (e) {
                    var a = [];
                    for (var _i = 1; _i < arguments.length; _i++) {
                        a[_i - 1] = arguments[_i];
                    }
                    return setTimeout(function () { return _this.receive(e, a); }, 0);
                }
            });
        }
        var backlog = this.backlog;
        this.backlog = [];
        backlog.forEach(function (m) { return _this.receive(m.e, m.a); });
    };
    // Leave the room (as host this ends the game for everyone)
    NetworkService.prototype.close = function () {
        if (this.closed)
            return;
        this.closed = true;
        clearInterval(this.ping_timer);
        for (var _i = 0, _a = Object.keys(this.guests); _i < _a.length; _i++) {
            var id = _a[_i];
            this.guests[id].close();
        }
        if (this.conn)
            this.conn.close();
        this.peer.destroy();
        this.handlers = {};
    };
    NetworkService.prototype.receive = function (event, args) {
        if (!this.started) {
            this.backlog.push({ e: event, a: args });
            return;
        }
        (this.handlers[event] || []).forEach(function (h) { return h.apply(null, args); });
    };
    // Guest side: wire up the connection to the host
    NetworkService.prototype.attach = function (conn) {
        var _this = this;
        this.conn = conn;
        this.last_seen['host'] = Date.now();
        conn.on('data', function (msg) {
            _this.last_seen['host'] = Date.now();
            if (!msg || typeof msg.e != 'string')
                return;
            if (msg.e == '_ping')
                return conn.send({ e: '_pong', a: [] });
            if (msg.e == '_pong')
                return;
            _this.receive(msg.e, msg.a || []);
        });
        conn.on('close', function () { return _this.lost_host(); });
        conn.on('error', function () { return _this.lost_host(); });
    };
    NetworkService.prototype.lost_host = function () {
        if (this.closed)
            return;
        this.receive('host_left', []);
        this.close();
    };
    // Host side: a new player connected to us
    NetworkService.prototype.accept = function (conn) {
        var _this = this;
        var id = conn.peer;
        var gone = function () {
            if (_this.guests[id] !== conn)
                return;
            delete _this.guests[id];
            delete _this.last_seen[id];
            _this.host.disconnect(id);
        };
        conn.on('open', function () {
            _this.guests[id] = conn;
            _this.last_seen[id] = Date.now();
            _this.host.connect({
                id: id,
                send: function (e) {
                    var a = [];
                    for (var _i = 1; _i < arguments.length; _i++) {
                        a[_i - 1] = arguments[_i];
                    }
                    if (conn.open)
                        conn.send({ e: e, a: a });
                }
            });
        });
        conn.on('data', function (msg) {
            _this.last_seen[id] = Date.now();
            if (!msg || typeof msg.e != 'string')
                return;
            if (msg.e == '_ping')
                return conn.send({ e: '_pong', a: [] });
            if (msg.e == '_pong')
                return;
            _this.host.handle(id, msg.e, Array.isArray(msg.a) ? msg.a : []);
        });
        conn.on('close', gone);
        conn.on('error', gone);
    };
    NetworkService.prototype.heartbeat = function () {
        var now = Date.now();
        if (this.isHost) {
            for (var _i = 0, _a = Object.keys(this.guests); _i < _a.length; _i++) {
                var id = _a[_i];
                var conn = this.guests[id];
                if (now - this.last_seen[id] > NetworkService.TIMEOUT) {
                    conn.close();
                    delete this.guests[id];
                    this.host.disconnect(id);
                }
                else if (conn.open) {
                    conn.send({ e: '_ping', a: [] });
                }
            }
        }
        else if (this.conn) {
            if (now - this.last_seen['host'] > NetworkService.TIMEOUT)
                this.lost_host();
            else if (this.conn.open)
                this.conn.send({ e: '_ping', a: [] });
        }
    };
    NetworkService.PREFIX = 'sqrz-room-';
    NetworkService.LOCAL_ID = 'host';
    NetworkService.CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    NetworkService.PING_INTERVAL = 3000;
    NetworkService.TIMEOUT = 12000;
    return NetworkService;
}());
//# sourceMappingURL=NetworkService.js.map