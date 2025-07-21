import { EventEmitter } from "events";
import * as net from "net";
import fs from "fs";

export enum ServerToCelesteMsg {
    AdvanceFrame = 0x01
}

export type AdvanceFrameData = {
    KeysHeld: string[],
    FramesToAdvance: number
}

export enum CelesteToServerMsg {
    ScreenshotData = 0x01,
    Message = 0x02
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
    message: [string];
};

export class CelesteSocket extends EventEmitter<CelesteEventMap> {
    private socket: net.Socket | null = null;
    private recvBuffer: Buffer = Buffer.alloc(0);
    
    private static readonly SOCKET_FILE = "/tmp/discord-plays-celeste.sock";
    private static readonly RETRY_INTERVAL_MS = 500;

    constructor() {
        super();
        this.waitForSocketFile();
    }

    private waitForSocketFile() {
        const tryConnect = () => {
            console.log(`Waiting for Celeste socket file at ${CelesteSocket.SOCKET_FILE}...`);
            fs.stat(CelesteSocket.SOCKET_FILE, (err, stats) => {
                if (!err && stats.isSocket()) {
                    this.socket = net.createConnection(CelesteSocket.SOCKET_FILE);
                    this.connect();
                } else {
                    setTimeout(tryConnect, CelesteSocket.RETRY_INTERVAL_MS);
                }
            });
        };
        tryConnect();
    }

    private connect() {
        if(!this.socket) return;
        
        this.socket
            .on("connect", () => this.emit("connect"))
            .on("data", (chunk) => this.handleChunk(chunk))
            .on("close", () => {
                this.emit("close");
                // Wait for socket file again before reconnecting
                this.waitForSocketFile();
            })
            .on("error", (err) => this.emit("error", err));
    }
    public sendAdvanceFrame(data: AdvanceFrameData) {
        const json = Buffer.from(JSON.stringify(data), "utf8");
        this.writeMessage(ServerToCelesteMsg.AdvanceFrame, json);
    }
    
    /** Cleanly close the connection. */
    public close() {
        if(!this.socket) return;
        
        this.socket.end();
    }
    
    private handleChunk(chunk: Buffer) {
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
                case CelesteToServerMsg.Message:
                    const string = payload.toString("utf8");
                    this.emit("message", string);
                    break;
                default:
                    this.emit("error", new Error(`Unknown message type 0x${type.toString(16)}`));
            }
        }
    }
    
    private writeMessage(type: ServerToCelesteMsg, payload: Buffer) {
        if(!this.socket) return;
        
        const header = Buffer.alloc(5);
        header.writeUInt8(type, 0);
        header.writeUInt32LE(payload.length, 1);
        this.socket.write(header);
        this.socket.write(payload);
    }
}
