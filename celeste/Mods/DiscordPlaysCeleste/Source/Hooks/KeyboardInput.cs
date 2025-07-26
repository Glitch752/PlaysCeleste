using Celeste.Mod.mod;

public static class KeyboardInput {
    [Load]
    private static void Load() {
        On.Monocle.MInput.Update += Update;
    }

    [Unload]
    private static void Unload() {
        On.Monocle.MInput.Update -= Update;
    }
    
    private static void Update(On.Monocle.MInput.orig_Update orig) {
        if(GameState.Instance.syncedState.ControlledByDiscord) {
            // Use custom input logic; see GameState
        } else {
            // If we're not controlled by Discord, just use the original update method.
            orig();
        }
    }
}