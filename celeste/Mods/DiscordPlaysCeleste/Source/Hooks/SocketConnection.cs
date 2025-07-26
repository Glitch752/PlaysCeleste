using System;
using System.Collections.Concurrent;
using System.Text.Json;
using System.Threading;
using Celeste.Mod;
using Celeste.Mod.mod;

public static class SocketConnection {
    private static ConcurrentSocket socket;
    private static readonly string SocketPath = "/tmp/discord-plays-celeste.sock";
    private static readonly ConcurrentQueue<FrameAdvanceData> frameAdvanceEvents = new();

    [Initialize]
    private static void Initialize() {
        socket = new ConcurrentSocket(SocketPath, OnMessageReceived);
    }

    [Unload]
    private static void Unload() {
        if(socket != null) socket.Close();
    }

    private enum ServerToCelesteMessageType {
        AdvanceFrame = 0x01,
        UpdateSyncedState = 0x02
    }

    public class FrameAdvanceData {
        public string[] KeysHeld { get; set; }
        public int FramesToAdvance { get; set; }
        
        public FrameAdvanceData() {
            KeysHeld = Array.Empty<string>();
            FramesToAdvance = 0;
        }
    }
    
    #nullable enable
    public class StrawberryCollectedEvent {
        public string roomName { get; set; }
        public string chapterName { get; set; }
        public string idKey { get; set; }
        public bool isGhost { get; set; }
        public bool isGolden { get; set; }
        public bool isWinged { get; set; }
        public int newStrawberryCount { get; set; }
        
        public StrawberryCollectedEvent(
            string roomName,
            string chapterName,
            string idKey,
            bool isGhost,
            bool isGolden, bool isWinged,
            int newStrawberryCount
        ) {
            this.roomName = roomName;
            this.chapterName = chapterName;
            this.idKey = idKey;
            this.isGhost = isGhost;
            this.isGolden = isGolden;
            this.isWinged = isWinged;
            this.newStrawberryCount = newStrawberryCount;
        }
    }
    
    public class ChangeRoomEvent {
        public string fromRoomName { get; set; }
        public string toRoomName { get; set; }
        public string chapterName { get; set; }

        public ChangeRoomEvent(string fromRoomName, string toRoomName, string chapterName) {
            this.fromRoomName = fromRoomName;
            this.toRoomName = toRoomName;
            this.chapterName = chapterName;
        }
    }
    
    public class CompleteChapterEvent {
        public string chapterName { get; set; }

        public CompleteChapterEvent(string chapterName) {
            this.chapterName = chapterName;
        }
    }
    
    public class SetControlledChapterEvent {
        public string? chapter { get; set; }
        
        public SetControlledChapterEvent(string? chapter) {
            this.chapter = chapter;
        }
    }
    #nullable disable

    private enum CelesteToServerMessageType {
        Frame = 0x01,
        Message = 0x02,
        PlayerDeath = 0x03,
        StrawberryCollected = 0x04,
        ChangeRoom = 0x05,
        CompleteChapter = 0x06,
        SetControlledChapter = 0x07
    }
    
    public static void OnMessageReceived(ConcurrentSocket.SocketMessage message) {
        ServerToCelesteMessageType messageType = (ServerToCelesteMessageType)message.messageType;
        byte[] payload = message.payload;
        
        if(!GameState.Instance.syncedState.ControlledByDiscord) {
            if(messageType != ServerToCelesteMessageType.UpdateSyncedState) {
                // This isn't an update message, but we need to consume it to avoid blocking future messages
                $"Received unexpected message type while not controlled by Discord: {messageType}".Log(LogLevel.Error);
                return;
            }
            
            // We have an update message
            string json = System.Text.Encoding.UTF8.GetString(payload);
            try {
                GameState.SyncedState state = JsonSerializer.Deserialize<GameState.SyncedState>(json);
                GameState.Instance.syncedState = state;
            } catch(JsonException e) {
                $"Failed to deserialize synced state: {e.Message}".Log(LogLevel.Error);
            }
            return;
        }
        
        switch(messageType) {
            case ServerToCelesteMessageType.AdvanceFrame: {
                string json = System.Text.Encoding.UTF8.GetString(payload);
                FrameAdvanceData frameData = JsonSerializer.Deserialize<FrameAdvanceData>(json);
                if(frameData != null) {
                    frameAdvanceEvents.Enqueue(frameData);
                } else {
                    "Failed to deserialize frame advance data.".Log(LogLevel.Error);
                }
                return;
            }
            case ServerToCelesteMessageType.UpdateSyncedState: {
                string json = System.Text.Encoding.UTF8.GetString(payload);
                GameState.SyncedState state = JsonSerializer.Deserialize<GameState.SyncedState>(json);
                GameState.Instance.syncedState = state;
                if(!state.ControlledByDiscord) {
                    frameAdvanceEvents.Enqueue(new FrameAdvanceData());
                }
                return;
            }
            default:
                $"Unknown message type: {messageType}".Log(LogLevel.Error);
                return;
        }
    }

    public static void SendMessage(string message) {
        byte[] data = System.Text.Encoding.UTF8.GetBytes(message);
        socket.Send((byte)CelesteToServerMessageType.Message, data);
    }

    public static void SendFrame(byte[] rgbaFrameData, int width, int height) {
        byte[] extraHeader = new byte[8];
        BitConverter.GetBytes(width).CopyTo(extraHeader, 0);
        BitConverter.GetBytes(height).CopyTo(extraHeader, 4);
        socket.Send((byte)CelesteToServerMessageType.Frame, rgbaFrameData, extraHeader);
    }
    
    public static void SendPlayerDeath() {
        socket.Send((byte)CelesteToServerMessageType.PlayerDeath, []);
    }
    
    private static void SendEvent<T>(CelesteToServerMessageType messageType, T eventData) {
        string json = JsonSerializer.Serialize(eventData);
        byte[] data = System.Text.Encoding.UTF8.GetBytes(json);
        socket.Send((byte)messageType, data);
    }

    public static void SendStrawberryCollected(StrawberryCollectedEvent ev) => SendEvent(CelesteToServerMessageType.StrawberryCollected, ev);
    public static void SendChangeRoom(ChangeRoomEvent ev) => SendEvent(CelesteToServerMessageType.ChangeRoom, ev);
    public static void SendCompleteChapter(CompleteChapterEvent ev) => SendEvent(CelesteToServerMessageType.CompleteChapter, ev);
    public static void SendSetControlledChapter(SetControlledChapterEvent ev) => SendEvent(CelesteToServerMessageType.SetControlledChapter, ev);
    
    public static FrameAdvanceData BlockUntilFrameAdvance() {
        FrameAdvanceData data;
        while(!frameAdvanceEvents.TryDequeue(out data)) {
            Thread.Sleep(10); // Avoid busy-waiting
        }
        return data;
    }
}