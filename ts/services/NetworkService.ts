// Peer-to-peer replacement for the old socket.io connection.
//
// One player hosts: their browser runs the HostService (the old server) and
// registers a PeerJS id made from a short room code. Everyone else connects
// straight to that id. The API mirrors socket.io (`on` / `emit`) so the game
// states don't care whether they're the host or a guest.

class NetworkService {

    static PREFIX = 'sqrz-room-';
    static LOCAL_ID = 'host';
    static CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    static PING_INTERVAL = 3000;
    static TIMEOUT = 12000;

    // Room code other players type in to join
    code: string;
    isHost: boolean;
    // Only set on the host
    host: HostService = null;

    private peer: Peer;
    private conn: PeerDataConnection = null;
    private handlers: { [event: string]: ((...args: any[]) => void)[] } = {};
    // Messages that arrive before the game state is ready for them
    private backlog: { e: string, a: any[] }[] = [];
    private started = false;
    private closed = false;
    private last_seen: { [id: string]: number } = {};
    private guests: { [id: string]: PeerDataConnection } = {};
    private ping_timer: number;

    // Create a room and become its host
    static createRoom(onReady: (net: NetworkService) => void, onError: (msg: string) => void, attempt = 0) {
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += NetworkService.CODE_CHARS.charAt(Math.floor(Math.random() * NetworkService.CODE_CHARS.length));
        }
        let peer = new Peer(NetworkService.PREFIX + code);
        let done = false;
        peer.on('open', () => {
            done = true;
            let net = new NetworkService(peer, code, true);
            onReady(net);
        });
        peer.on('error', (err: any) => {
            if (done) return console.warn('Peer error', err);
            done = true;
            peer.destroy();
            // Someone already has this code, try another one
            if (err.type == 'unavailable-id' && attempt < 5) NetworkService.createRoom(onReady, onError, attempt + 1);
            else onError(NetworkService.describe(err));
        });
    }

    // Join somebody else's room by code
    static joinRoom(code: string, onReady: (net: NetworkService) => void, onError: (msg: string) => void) {
        let peer = new Peer();
        let done = false;
        let fail = (msg: string) => {
            if (done) return;
            done = true;
            peer.destroy();
            onError(msg);
        };
        let timer = setTimeout(() => fail("Couldn't reach room " + code + "."), 12000);
        peer.on('open', () => {
            let conn = peer.connect(NetworkService.PREFIX + code, { reliable: true, serialization: 'json' });
            conn.on('open', () => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                let net = new NetworkService(peer, code, false);
                net.attach(conn);
                onReady(net);
            });
        });
        peer.on('error', (err: any) => {
            if (err.type == 'peer-unavailable') fail('No room called ' + code + '.');
            else fail(NetworkService.describe(err));
        });
    }

    private static describe(err: any): string {
        if (err && err.type == 'browser-incompatible') return "This browser doesn't support WebRTC.";
        return "Couldn't connect to the matchmaking server.";
    }

    constructor(peer: Peer, code: string, isHost: boolean) {
        this.peer = peer;
        this.code = code;
        this.isHost = isHost;
        if (isHost) {
            this.host = new HostService();
            peer.on('connection', (conn: PeerDataConnection) => this.accept(conn));
        }
        // If we lose the matchmaking server, reconnect so new players can still join
        peer.on('disconnected', () => {
            if (!this.closed) setTimeout(() => { if (!this.closed && !peer.destroyed) peer.reconnect(); }, 1000);
        });
        // Notice players (or the host) who vanish without saying goodbye
        this.ping_timer = setInterval(() => this.heartbeat(), NetworkService.PING_INTERVAL);
        window.addEventListener('beforeunload', () => this.close());
    }

    // Listen for an event, same as socket.on
    on(event: string, handler: (...args: any[]) => void) {
        (this.handlers[event] = this.handlers[event] || []).push(handler);
    }

    // Send an event to the host, same as socket.emit
    emit(event: string, ...args: any[]) {
        if (this.closed) return;
        if (this.isHost) {
            // Our own moves go straight into the host logic
            setTimeout(() => this.host.handle(NetworkService.LOCAL_ID, event, args), 0);
        } else if (this.conn && this.conn.open) {
            this.conn.send({ e: event, a: args });
        }
    }

    // Call once all the `on` handlers are registered
    start() {
        this.started = true;
        if (this.isHost) {
            this.host.connect({
                id: NetworkService.LOCAL_ID,
                send: (e: string, ...a: any[]) => setTimeout(() => this.receive(e, a), 0)
            });
        }
        let backlog = this.backlog;
        this.backlog = [];
        backlog.forEach((m) => this.receive(m.e, m.a));
    }

    // Leave the room (as host this ends the game for everyone)
    close() {
        if (this.closed) return;
        this.closed = true;
        clearInterval(this.ping_timer);
        for (let id of Object.keys(this.guests)) this.guests[id].close();
        if (this.conn) this.conn.close();
        this.peer.destroy();
        this.handlers = {};
    }

    private receive(event: string, args: any[]) {
        if (!this.started) {
            this.backlog.push({ e: event, a: args });
            return;
        }
        (this.handlers[event] || []).forEach((h) => h.apply(null, args));
    }

    // Guest side: wire up the connection to the host
    private attach(conn: PeerDataConnection) {
        this.conn = conn;
        this.last_seen['host'] = Date.now();
        conn.on('data', (msg: any) => {
            this.last_seen['host'] = Date.now();
            if (!msg || typeof msg.e != 'string') return;
            if (msg.e == '_ping') return conn.send({ e: '_pong', a: [] });
            if (msg.e == '_pong') return;
            this.receive(msg.e, msg.a || []);
        });
        conn.on('close', () => this.lost_host());
        conn.on('error', () => this.lost_host());
    }

    private lost_host() {
        if (this.closed) return;
        this.receive('host_left', []);
        this.close();
    }

    // Host side: a new player connected to us
    private accept(conn: PeerDataConnection) {
        let id = conn.peer;
        let gone = () => {
            if (this.guests[id] !== conn) return;
            delete this.guests[id];
            delete this.last_seen[id];
            this.host.disconnect(id);
        };
        conn.on('open', () => {
            this.guests[id] = conn;
            this.last_seen[id] = Date.now();
            this.host.connect({
                id: id,
                send: (e: string, ...a: any[]) => { if (conn.open) conn.send({ e: e, a: a }); }
            });
        });
        conn.on('data', (msg: any) => {
            this.last_seen[id] = Date.now();
            if (!msg || typeof msg.e != 'string') return;
            if (msg.e == '_ping') return conn.send({ e: '_pong', a: [] });
            if (msg.e == '_pong') return;
            this.host.handle(id, msg.e, Array.isArray(msg.a) ? msg.a : []);
        });
        conn.on('close', gone);
        conn.on('error', gone);
    }

    private heartbeat() {
        let now = Date.now();
        if (this.isHost) {
            for (let id of Object.keys(this.guests)) {
                let conn = this.guests[id];
                if (now - this.last_seen[id] > NetworkService.TIMEOUT) {
                    conn.close();
                    delete this.guests[id];
                    this.host.disconnect(id);
                } else if (conn.open) {
                    conn.send({ e: '_ping', a: [] });
                }
            }
        } else if (this.conn) {
            if (now - this.last_seen['host'] > NetworkService.TIMEOUT) this.lost_host();
            else if (this.conn.open) this.conn.send({ e: '_ping', a: [] });
        }
    }

}
