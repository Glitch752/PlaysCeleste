import { EventEmitter } from "events";
import * as net from "net";

export enum ServerToCelesteMsg {
    Test = 0x01
}

export enum CelesteToServerMsg {
    ScreenshotData = 0x01
}

export type FrameEvent = {
    data: Buffer;
    width: number;
    height: number;
};

type CelesteEventMap = {
    connect: [];
    close: [];
    error: [Error];
    screenshotData: [FrameEvent];
};

export class CelesteSocket extends EventEmitter<CelesteEventMap> {
    private readonly socket: net.Socket;
    private recvBuffer: Buffer = Buffer.alloc(0);
    
    constructor() {
        super();
        
        this.socket = net.createConnection("/tmp/discord-plays-celeste.sock");
        this.socket
            .on("connect", () => this.emit("connect"))
            .on("data", (chunk) => this.handleChunk(chunk))
            .on("close", () => this.emit("close"))
            .on("error", (err) => this.emit("error", err));
    }
    
    public sendCommand<T extends object>(command: T): void {
        const json = Buffer.from(JSON.stringify(command), "utf8");
        this.writeMessage(ServerToCelesteMsg.Test, json);
    }
    
    /** Cleanly close the connection. */
    public close(): void {
        this.socket.end();
    }
    
    private handleChunk(chunk: Buffer): void {
        this.recvBuffer = Buffer.concat([this.recvBuffer, chunk]);
        
        // Process as many complete messages as are buffered
        while (this.recvBuffer.length >= 5) {
            const type = this.recvBuffer.readUInt8(0);
            const length = this.recvBuffer.readUInt32LE(1);
            const total = 5 + length;
            
            if (this.recvBuffer.length < total) break; // Wait for full payload
            
            const payload = this.recvBuffer.subarray(5, total);
            this.recvBuffer = this.recvBuffer.subarray(total);
            
            switch (type) {
                case CelesteToServerMsg.ScreenshotData:
                    // First 8 bytes are width and height
                    const width = payload.readUInt32LE(0);
                    const height = payload.readUInt32LE(4);
                    // Remaining bytes are screenshot data in RGBA format
                    const data = payload.subarray(8);
                    this.emit("screenshotData", { data, width, height });
                    break;
                default:
                    this.emit("error", new Error(`Unknown message type 0x${type.toString(16)}`));
            }
        }
    }
    
    private writeMessage(type: ServerToCelesteMsg, payload: Buffer): void {
        const header = Buffer.alloc(5);
        header.writeUInt8(type, 0);
        header.writeUInt32LE(payload.length, 1);
        this.socket.write(header);
        this.socket.write(payload);
    }
}
