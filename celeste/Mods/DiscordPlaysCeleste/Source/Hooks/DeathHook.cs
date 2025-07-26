using Celeste;
using Celeste.Mod.mod;
using Microsoft.Xna.Framework;

public static class DeathHook {
    [Load]
    private static void Load() {
        On.Celeste.Player.Die += Die;
    }

    [Unload]
    private static void Unload() {
        On.Celeste.Player.Die -= Die;
    }
    
    private static Celeste.PlayerDeadBody Die(
        On.Celeste.Player.orig_Die orig,
        Player self,
        Vector2 direction, bool evenIfInvincible, bool registerDeathInStats
    ) {
        var body = orig(self, direction, evenIfInvincible, registerDeathInStats);
        
        SocketConnection.SendPlayerDeath(new SocketConnection.DeathEvent(SaveData.Instance.TotalDeaths));
        
        return body;
    }
}