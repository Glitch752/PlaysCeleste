using System;
using System.Net.Sockets;
using System.Threading.Tasks;
using Celeste.Mod;

public class ConcurrentSocket {
    public record SocketMessage(byte messageType, byte[] payload);
    
    private Socket socket;
    private readonly string socketPath;
    private static readonly object socketLock = new object();
    
    // Callback to handle incoming messages
    public Action<SocketMessage> OnMessageReceived;
    
    public ConcurrentSocket(string socketPath, Action<SocketMessage> onMessageReceived) {
        this.socketPath = socketPath;
        OnMessageReceived = onMessageReceived;
        
        // Start listening for messages.
        StartListening();
    }
    
    private void ConnectToSocket() {
        // Always delete the socket file before binding
        if(System.IO.File.Exists(socketPath)) {
            try {
                System.IO.File.Delete(socketPath);
            } catch(Exception e) {
                $"Failed to delete existing socket file: {e.Message}".Log(LogLevel.Error);
            }
        }

        socket = new Socket(AddressFamily.Unix, SocketType.Stream, ProtocolType.Unspecified);
        var ep = new UnixDomainSocketEndPoint(socketPath);

        try {
            socket.Bind(ep);
            socket.Listen(1);

            "Waiting for server socket connection...".Log();
            socket = socket.Accept();
            "Server socket connected.".Log();
        } catch(SocketException e) {
            $"Socket connection failed: {e.Message}".Log(LogLevel.Error);
            Close();
        }
    }
    
    public void Close() {
        lock(socketLock) {
            if(socket != null) {
                try {
                    socket.Close();
                } catch { }
                socket = null;
            }
            // Clean up socket file
            if(System.IO.File.Exists(socketPath)) {
                try {
                    System.IO.File.Delete(socketPath);
                } catch (Exception e) {
                    $"Failed to delete socket file on close: {e.Message}".Log(LogLevel.Error);
                }
            }
        }
    }
    
    private void EnsureConnected() {
        lock(socketLock) {
            if(socket == null || !socket.Connected) {
                Reconnect();
            }
        }
    }
    
    private void Reconnect() {
        Close();
        ConnectToSocket();
    }

    public void Send(byte messageType, byte[] payload, byte[] extraHeader = null) {
        EnsureConnected();
        if(socket == null || !socket.Connected) {
            return;
        }

        int headerLength = 1 + 4 + (extraHeader?.Length ?? 0);
        byte[] header = new byte[headerLength];
        header[0] = messageType;
        BitConverter.GetBytes(payload.Length + (extraHeader?.Length ?? 0)).CopyTo(header, 1);

        if(extraHeader != null) {
            Buffer.BlockCopy(extraHeader, 0, header, 5, extraHeader.Length);
        }

        try {
            lock(socketLock) {
                socket.Send(header);
                socket.Send(payload);
            }
        } catch (SocketException e) {
            $"Failed to send data: {e.Message}".Log(LogLevel.Error);
            Reconnect();
        }
    }
    
    private void StartListening() {
        EnsureConnected();
        
        // Start a background thread to listen for messages
        Task.Run(() => {
            while(true) {
                try {
                    SocketMessage message = ReceiveMessage();
                    if(message != null) {
                        OnMessageReceived?.Invoke(message);
                    }
                } catch(Exception e) {
                    $"Error in socket listener: {e.Message}".Log(LogLevel.Error);
                    Reconnect();
                }
            }
        });
    }
    
    private SocketMessage ReceiveMessage() {
        EnsureConnected();
        if(socket == null || !socket.Connected) {
            return null;
        }
        
        // Receiving doesn't require a lock because sockets are thread-safe for reading
        
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

        byte messageType = header[0];
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
        
        return new SocketMessage(messageType, payload);
    }
}