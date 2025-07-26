using System;
using Celeste;
using Celeste.Mod.mod;

public static class ReliabilityHooks {
    [Load]
    private static void Load() {
        // CelesteTAS makes some threads run synchronously so they're 100% consistent, so we do too
        On.Celeste.RunThread.Start += RunThreadStart;
    }

    [Unload]
    private static void Unload() {
        On.Celeste.RunThread.Start -= RunThreadStart;
    }
    
    private static void RunThreadStart(On.Celeste.RunThread.orig_Start orig, Action method, string name, bool highPriority) {
        if(GameState.Instance.syncedState.ControlledByDiscord && name != "USER_IO" && name != "MOD_IO") {
            RunThread.RunThreadWithLogging(method);
            return;
        }

        orig(method, name, highPriority);
    }
}