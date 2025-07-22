using Celeste.Mod.mod;

public static class DeathHook {
    [Load]
    private static void Load() {
        On.Celeste.SaveData.AddDeath += AddDeath;
    }

    [Unload]
    private static void Unload() {
        On.Celeste.SaveData.AddDeath -= AddDeath;
    }
    
    private static void AddDeath(On.Celeste.SaveData.orig_AddDeath orig, Celeste.SaveData self, Celeste.AreaKey area) {
        SocketConnection.SendPlayerDeath();
        
        orig(self, area);
    }
}