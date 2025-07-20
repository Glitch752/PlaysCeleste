using System;
using System.Net.Sockets;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using Monocle;

namespace Celeste.Mod.mod;

public class modModule : EverestModule
{
    public static modModule Instance { get; private set; }

    // See https://github.com/EverestAPI/Resources/wiki/Code-Mod-Setup#mod-settings-session-and-save-data
    public override Type SettingsType => typeof(modModuleSettings);
    public static modModuleSettings Settings => (modModuleSettings)Instance._Settings;

    public override Type SessionType => typeof(modModuleSession);
    public static modModuleSession Session => (modModuleSession)Instance._Session;

    public override Type SaveDataType => typeof(modModuleSaveData);
    public static modModuleSaveData SaveData => (modModuleSaveData)Instance._SaveData;

    private static Socket socket;

    public modModule()
    {
        Instance = this;
#if DEBUG
        // debug builds use verbose logging
        Logger.SetLogLevel(nameof(modModule), LogLevel.Verbose);
#else
        // release builds use info logging to reduce spam in log files
        Logger.SetLogLevel(nameof(modModule), LogLevel.Info);
#endif
    }

    // Set up any hooks, event handlers and your mod in general here.
    // Load runs before Celeste itself has initialized properly.
    public override void Load()
    {
        On.Monocle.Engine.RenderCore += RenderCore;

        ConnectToSocket();
    }

    static private void ConnectToSocket()
    {
        socket = new Socket(AddressFamily.Unix, SocketType.Stream, ProtocolType.Unspecified);
        // If the file already exists, delete it
        if (System.IO.File.Exists("/tmp/discord-plays-celeste.sock"))
        {
            try
            {
                System.IO.File.Delete("/tmp/discord-plays-celeste.sock");
            }
            catch (Exception e)
            {
                Logger.Log(nameof(modModule), $"Failed to delete existing socket file: {e.Message}");
            }
        }

        var ep = new UnixDomainSocketEndPoint("/tmp/discord-plays-celeste.sock");
        socket.Bind(ep);
        socket.Listen(1);

        Logger.Log(nameof(modModule), "Connecting to server socket...");
        socket = socket.Accept();
        Logger.Log(nameof(modModule), "Server socket connected.");
    }

    static protected void RenderCore(On.Monocle.Engine.orig_RenderCore orig, Engine self)
    {
        if (self.scene != null)
        {
            self.scene.BeforeRender();
        }

        int width = self.GraphicsDevice.PresentationParameters.BackBufferWidth;
        int height = self.GraphicsDevice.PresentationParameters.BackBufferHeight;

        self.GraphicsDevice.SetRenderTarget(null);
        self.GraphicsDevice.Viewport = Engine.Viewport;

        self.GraphicsDevice.Clear(Engine.ClearColor);

        if (self.scene != null)
        {
            self.scene.Render();
            self.scene.AfterRender();
        }

        byte[] data = new byte[width * height * 4];
        self.GraphicsDevice.GetBackBufferData(data, 0, width * height * 4);

        SendFrame(data, width, height);
    }

    static void SendFrame(byte[] rgbaFrameData, int width, int height)
    {
        if (!socket.Connected)
        {
            return;
        }

        byte[] header = new byte[1 + 4 + 4 + 4];
        header[0] = 0x01; // Frame type
        BitConverter.GetBytes(rgbaFrameData.Length + 8).CopyTo(header, 1);
        BitConverter.GetBytes(width).CopyTo(header, 5);
        BitConverter.GetBytes(height).CopyTo(header, 9);

        try
        {
            socket.Send(header);
            socket.Send(rgbaFrameData);   
        } catch (SocketException e)
        {
            Logger.Log(nameof(modModule), $"Failed to send frame data: {e.Message}");
            // Attempt to reconnect if the socket is disconnected
            if (!socket.Connected)
            {
                Logger.Log(nameof(modModule), "Reconnecting to server socket...");
                socket.Close();
                socket = null;
                ConnectToSocket();
            }
        }
    }

    // Optional, initialize anything after Celeste has initialized itself properly.
    public override void Initialize()
    {
    }

    // Optional, do anything requiring either the Celeste or mod content here.
    public override void LoadContent(bool firstLoad)
    {
    }

    // Unload the entirety of your mod's content. Free up any native resources.
    public override void Unload()
    {
        On.Monocle.Engine.RenderCore -= RenderCore;

        if (socket != null)
        {
            socket.Close();
            socket = null;
        }
    }
}