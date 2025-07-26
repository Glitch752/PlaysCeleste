using System;
using Celeste.Mod.mod;
using Microsoft.Xna.Framework;
using Monocle;

public static class MainLoopAdvance {
    [Load]
    private static void Load() {
        On.Monocle.Engine.Update += OnUpdate;
        
        // We simulate individual frames manually, so turn off fixed timestep.
        Engine.Instance.IsFixedTimeStep = false;
    }

    [Unload]
    private static void Unload() {
        On.Monocle.Engine.Update -= OnUpdate;
        
        Engine.Instance.IsFixedTimeStep = true;
    }
    
    
    /// <summary>
    /// Called before draw. We simulate a single advanced frame at 60FPS no matter what actually happened.
    /// </summary>
    private static void OnUpdate(On.Monocle.Engine.orig_Update orig, Engine self, GameTime gameTime) {
        if(gameTime.TotalGameTime.TotalSeconds < 2) {
            orig(self, gameTime);
            return;
        }
        
        long startRealTime = DateTime.Now.Ticks;
        
        GameState.Instance.Update(gameTime);
        orig(self, GameState.Instance.simulatedGameTime);
        
        while(
            GameState.Instance.framesToAdvanceRemaining > 0 &&
            GameState.Instance.syncedState.ControlledByDiscord &&
            DateTime.Now.Ticks - startRealTime < TimeSpan.TicksPerSecond / 80
        ) {
            // Simulate as fast as possible while controlled by Discord
            GameState.Instance.Update(gameTime);
            orig(self, GameState.Instance.simulatedGameTime);
        }
    }
}