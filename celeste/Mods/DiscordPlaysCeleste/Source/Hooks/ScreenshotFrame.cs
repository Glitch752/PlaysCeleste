using Celeste.Mod.mod;
using Monocle;

public static class ScreenshotFrame {
    [Load]
    private static void Load() {
        On.Monocle.Engine.RenderCore += RenderCore;
    }

    [Unload]
    private static void Unload() {
        On.Monocle.Engine.RenderCore -= RenderCore;
    }
    
    static void RenderCore(On.Monocle.Engine.orig_RenderCore orig, Engine self) {
        if(self.scene != null) {
            self.scene.BeforeRender();
        }

        int width = self.GraphicsDevice.PresentationParameters.BackBufferWidth;
        int height = self.GraphicsDevice.PresentationParameters.BackBufferHeight;

        self.GraphicsDevice.SetRenderTarget(null);
        self.GraphicsDevice.Viewport = Engine.Viewport;

        self.GraphicsDevice.Clear(Engine.ClearColor);

        if(self.scene != null) {
            self.scene.Render();
            self.scene.AfterRender();
        }

        if(GameState.Instance.shouldScreenshot) {
            byte[] data = new byte[width * height * 4];
            self.GraphicsDevice.GetBackBufferData(data, 0, width * height * 4);

            SocketConnection.SendFrame(data, width, height);   
        }
    }
}