// Minimal typings for the PeerJS browser build (window.Peer).
// Only covers the parts of the API sqrz uses.

declare class Peer {
    constructor(id?: string, options?: any);
    id: string;
    open: boolean;
    destroyed: boolean;
    disconnected: boolean;
    on(event: string, callback: (...args: any[]) => void): this;
    connect(id: string, options?: any): PeerDataConnection;
    reconnect(): void;
    destroy(): void;
}

interface PeerDataConnection {
    peer: string;
    open: boolean;
    on(event: string, callback: (...args: any[]) => void): this;
    send(data: any): void;
    close(): void;
}
