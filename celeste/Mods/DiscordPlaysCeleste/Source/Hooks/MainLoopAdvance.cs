using System;
using Celeste.Mod.mod;
using Microsoft.Xna.Framework;
using Monocle;

public static class MainLoopAdvance {
    [Load]
    private static void Load() {
        On.Monocle.Engine.Update += OnUpdate;
        On.Monocle.Engine.Draw += OnDraw;   
        
        // We simulate individual frames manually, so turn off fixed timestep.
        Engine.Instance.IsFixedTimeStep = false;
    }

    [Unload]
    private static void Unload() {
        On.Monocle.Engine.Update -= OnUpdate;
        On.Monocle.Engine.Draw -= OnDraw;
        
        Engine.Instance.IsFixedTimeStep = true;
    }
    
    
    /// <summary>
    /// Called before draw. We simulate a single advanced frame at 60FPS no matter what actually happened.
    /// </summary>
    private static void OnUpdate(On.Monocle.Engine.orig_Update orig, Engine self, GameTime _gameTime) {
        GameState.Instance.Update();
        
        orig(self, GameState.Instance.simulatedGameTime);
    }
    
    private static void OnDraw(On.Monocle.Engine.orig_Draw orig, Monocle.Engine self, GameTime _gameTime) {
        orig(self, GameState.Instance.simulatedGameTime);
    }
}