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
        AdvanceFrame = 0x01
    }

    public class FrameAdvanceData {
        public string[] KeysHeld { get; set; }
        public int FramesToAdvance { get; set; }
    }

    private enum CelesteToServerMessageType {
        Frame = 0x01,
        Message = 0x02
    }

    private static void EnsureConnected() {
        lock(socketLock) {
            if(socket == null || !socket.Connected) {
                CloseSocket();
                ConnectToSocket();
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

    public static FrameAdvanceData WaitForFrameAdvance() {
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
                return null;
            }
        } catch(SocketException e) {
            $"Failed to receive data: {e.Message}".Log(LogLevel.Error);
            Reconnect();
            return null;
        }

        ServerToCelesteMessageType messageType = (ServerToCelesteMessageType)header[0];
        int payloadLength = BitConverter.ToInt32(header, 1);

        byte[] payload = new byte[payloadLength];
        try {
            int received = socket.Receive(payload, payload.Length, SocketFlags.None);
            if(received < payloadLength) {
                "Received incomplete payload.".Log(LogLevel.Error);
                Reconnect();
                return null;
            }
        } catch(SocketException e) {
            $"Failed to receive payload: {e.Message}".Log(LogLevel.Error);
            Reconnect();
            return null;
        }

        switch(messageType) {
            case ServerToCelesteMessageType.AdvanceFrame:
                string json = System.Text.Encoding.UTF8.GetString(payload);
                FrameAdvanceData frameData = JsonSerializer.Deserialize<FrameAdvanceData>(json);
                return frameData;
            default:
                $"Unknown message type: {messageType}".Log(LogLevel.Error);
                return null;
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
}