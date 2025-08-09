using Celeste.Mod.mod;
using Microsoft.Xna.Framework;

public static class OverrideDebugMode {
    [Load]
    private static void Load() {
        On.Celeste.Celeste.Update += Update;
    }

    [Unload]
    private static void Unload() {
        On.Celeste.Celeste.Update -= Update;
    }
    
    private static void Update(On.Celeste.Celeste.orig_Update orig, Celeste.Celeste self, GameTime time) {
        if(GameState.Instance.syncedState.OverrideDebugMode) {
            Celeste.Celeste.PlayMode = Celeste.Celeste.PlayModes.Normal;
        }
        orig(self, time);
    }
}