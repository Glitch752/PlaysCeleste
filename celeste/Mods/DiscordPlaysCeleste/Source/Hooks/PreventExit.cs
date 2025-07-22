using Celeste.Mod.mod;

public static class PreventExitGame {
    [Load]
    private static void Load() {
        On.Celeste.OuiMainMenu.OnExit += OnExit;
    }

    [Unload]
    private static void Unload() {
        On.Celeste.OuiMainMenu.OnExit -= OnExit;
    }
    
    private static void OnExit(On.Celeste.OuiMainMenu.orig_OnExit orig, Celeste.OuiMainMenu self) {
        if(GameState.Instance.syncedState.ControlledByDiscord) {
            SocketConnection.SendMessage("Prevented exiting Celeste... whatcha doing?");
        } else {
            orig(self);
        }
    }
}