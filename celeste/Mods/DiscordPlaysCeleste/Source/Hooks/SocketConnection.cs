using System;
using System.Net.Sockets;
using System.Text.Json;
using System.Text.Json.Serialization;
using Celeste.Mod;
using Celeste.Mod.mod;

public static class SocketConnection {
    private static Socket socket;
    private static readonly string SocketPath = "/tmp/discord-plays-celeste.sock";
    private static readonly object socketLock = new object();

    [Initialize]
    private static void Initialize() {
        EnsureConnected();
    }

    [Unload]
    private static void Unload() {
        CloseSocket();
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

    private enum CelesteToServerMessageType {
        Frame = 0x01,
        Message = 0x02,
        PlayerDeath = 0x03,
        StrawberryCollected = 0x04,
        ChangeRoom = 0x05,
        CompleteChapter = 0x06
    }

    private static void EnsureConnected() {
        lock(socketLock) {
            if(socket == null || !socket.Connected) {
                Reconnect();
            }
        }
    }

    private static void ConnectToSocket() {
        // Always delete the socket file before binding
        if(System.IO.File.Exists(SocketPath)) {
            try {
                System.IO.File.Delete(SocketPath);
            } catch(Exception e) {
                $"Failed to delete existing socket file: {e.Message}".Log(LogLevel.Error);
            }
        }

        socket = new Socket(AddressFamily.Unix, SocketType.Stream, ProtocolType.Unspecified);
        var ep = new UnixDomainSocketEndPoint(SocketPath);

        try {
            socket.Bind(ep);
            socket.Listen(1);

            "Waiting for server socket connection...".Log();
            socket = socket.Accept();
            "Server socket connected.".Log();
            GameState.Instance.Reset();
        } catch(SocketException e) {
            $"Socket connection failed: {e.Message}".Log(LogLevel.Error);
            CloseSocket();
        }
    }

    private static void CloseSocket() {
        lock(socketLock) {
            if(socket != null) {
                try {
                    socket.Close();
                } catch { }
                socket = null;
            }
            // Clean up socket file
            if(System.IO.File.Exists(SocketPath)) {
                try {
                    System.IO.File.Delete(SocketPath);
                } catch (Exception e) {
                    $"Failed to delete socket file on close: {e.Message}".Log(LogLevel.Error);
                }
            }
        }
    }

    private static void Send(CelesteToServerMessageType messageType, byte[] payload, byte[] extraHeader = null) {
        EnsureConnected();
        if(socket == null || !socket.Connected) {
            return;
        }

        int headerLength = 1 + 4 + (extraHeader?.Length ?? 0);
        byte[] header = new byte[headerLength];
        header[0] = (byte)messageType;
        BitConverter.GetBytes(payload.Length + (extraHeader?.Length ?? 0)).CopyTo(header, 1);

        if(extraHeader != null) {
            Buffer.BlockCopy(extraHeader, 0, header, 5, extraHeader.Length);
        }

        try {
            socket.Send(header);
            socket.Send(payload);
        } catch (SocketException e) {
            $"Failed to send data: {e.Message}".Log(LogLevel.Error);
            Reconnect();
        }
    }

    private static void Reconnect() {
        CloseSocket();
        ConnectToSocket();
    }
    
    /// <summary>
    /// Returns true and updates the state if there has been a synced state update, but returns immediately if no update is available.
    /// </summary>
    public static bool ConsumeUpdatesNonblocking() {
        EnsureConnected();
        if(socket == null || !socket.Connected) {
            return false;
        }
    
        if(socket.Available < 5) {
            // No data available
            return false;
        }
    
        byte[] header = new byte[5];
        try {
            int received = socket.Receive(header, 5, SocketFlags.None);
            if(received < 5) {
                // No data available
                return false;
            }
        } catch(SocketException e) {
            $"Failed to peek data: {e.Message}".Log(LogLevel.Error);
            Reconnect();
            return false;
        }
        
        ServerToCelesteMessageType messageType = (ServerToCelesteMessageType)header[0];
        byte[] payloadLengthBytes = new byte[4];
        Array.Copy(header, 1, payloadLengthBytes, 0, 4);
        int payloadLength = BitConverter.ToInt32(payloadLengthBytes, 0);
        byte[] payload = new byte[payloadLength];
        try {
            int received = socket.Receive(payload, payload.Length, SocketFlags.None);
            if(received < payloadLength) {
                "Received incomplete payload.".Log(LogLevel.Error);
                Reconnect();
                return false;
            }
        } catch(SocketException e) {
            $"Failed to receive data: {e.Message}".Log(LogLevel.Error);
            Reconnect();
        }
        
        if(messageType != ServerToCelesteMessageType.UpdateSyncedState) {
            // This isn't an update message, but we need to consume it to avoid blocking future messages
            $"Received unexpected message type while consuming nonblocking: {messageType}".Log(LogLevel.Error);
            return false;
        }
        
        // We have an update message
        string json = System.Text.Encoding.UTF8.GetString(payload);
        try {
            GameState.SyncedState state = JsonSerializer.Deserialize<GameState.SyncedState>(json);
            GameState.Instance.syncedState = state;
        } catch(JsonException e) {
            $"Failed to deserialize synced state: {e.Message}".Log(LogLevel.Error);
            return false;
        }
        return true;
    }

    public static FrameAdvanceData WaitForFrameAdvance() {
        while(true) {
            EnsureConnected();
            if(socket == null || !socket.Connected) {
                return null;
            }

            byte[] header = new byte[5];
            try {
                int received = socket.Receive(header, 5, SocketFlags.None);
                if(received < 5) {
                    "Received invalid header length.".Log(LogLevel.Error);
                    Reconnect();
                    continue;
                }
            } catch(SocketException e) {
                $"Failed to receive data: {e.Message}".Log(LogLevel.Error);
                Reconnect();
                continue;
            }

            ServerToCelesteMessageType messageType = (ServerToCelesteMessageType)header[0];
            int payloadLength = BitConverter.ToInt32(header, 1);

            byte[] payload = new byte[payloadLength];
            try {
                int received = socket.Receive(payload, payload.Length, SocketFlags.None);
                if(received < payloadLength) {
                    "Received incomplete payload.".Log(LogLevel.Error);
                    Reconnect();
                    continue;
                }
            } catch(SocketException e) {
                $"Failed to receive payload: {e.Message}".Log(LogLevel.Error);
                Reconnect();
                continue;
            }

            switch(messageType) {
                case ServerToCelesteMessageType.AdvanceFrame: {
                    string json = System.Text.Encoding.UTF8.GetString(payload);
                    FrameAdvanceData frameData = JsonSerializer.Deserialize<FrameAdvanceData>(json);
                    return frameData;
                }
                case ServerToCelesteMessageType.UpdateSyncedState: {
                    string json = System.Text.Encoding.UTF8.GetString(payload);
                    GameState.SyncedState state = JsonSerializer.Deserialize<GameState.SyncedState>(json);
                    GameState.Instance.syncedState = state;
                    if(!state.ControlledByDiscord) {
                        return new FrameAdvanceData();
                    }
                    continue;
                }
                default:
                    $"Unknown message type: {messageType}".Log(LogLevel.Error);
                    return null;
            }
        }
    }

    public static void SendMessage(string message) {
        byte[] data = System.Text.Encoding.UTF8.GetBytes(message);
        Send(CelesteToServerMessageType.Message, data);
    }

    public static void SendFrame(byte[] rgbaFrameData, int width, int height) {
        byte[] extraHeader = new byte[8];
        BitConverter.GetBytes(width).CopyTo(extraHeader, 0);
        BitConverter.GetBytes(height).CopyTo(extraHeader, 4);
        Send(CelesteToServerMessageType.Frame, rgbaFrameData, extraHeader);
    }
    
    public static void SendPlayerDeath() {
        Send(CelesteToServerMessageType.PlayerDeath, []);
    }
    
    public static void SendStrawberryCollected(StrawberryCollectedEvent strawberryEvent) {
        string json = JsonSerializer.Serialize(strawberryEvent);
        byte[] data = System.Text.Encoding.UTF8.GetBytes(json);
        Send(CelesteToServerMessageType.StrawberryCollected, data);
    }
    
    public static void SendChangeRoom(ChangeRoomEvent changeRoomEvent) {
        string json = JsonSerializer.Serialize(changeRoomEvent);
        byte[] data = System.Text.Encoding.UTF8.GetBytes(json);
        Send(CelesteToServerMessageType.ChangeRoom, data);
    }
    
    public static void SendCompleteChapter(CompleteChapterEvent completeChapterEvent) {
        string json = JsonSerializer.Serialize(completeChapterEvent);
        byte[] data = System.Text.Encoding.UTF8.GetBytes(json);
        Send(CelesteToServerMessageType.CompleteChapter, data);
    }
}