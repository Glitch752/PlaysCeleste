using Celeste.Mod.mod;

public static class PauseMenuHook {
    [Load]
    private static void Load() {
        On.Celeste.Level.Unpause += Unpause;
        On.Celeste.Level.Pause += Pause;
    }

    [Unload]
    private static void Unload() {
        On.Celeste.Level.Unpause -= Unpause;
        On.Celeste.Level.Pause -= Pause;
    }
    
    private static void Unpause(On.Celeste.Level.orig_Unpause orig, Celeste.Level self) {
        "Unpaused".Log();
        orig(self);
    }
    
    private static void Pause(
        On.Celeste.Level.orig_Pause orig, Celeste.Level self,
        int startIndex, bool minimal, bool quickReset
    ) {
        "Paused".Log(); 
        orig(self, startIndex, minimal, quickReset);
    }
}