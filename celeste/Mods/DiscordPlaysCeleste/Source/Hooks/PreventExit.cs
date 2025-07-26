using Celeste.Mod;
using Celeste.Mod.mod;
using Celeste.Mod.UI;
using Monocle;

public static class PreventExitGame {
    [Load]
    private static void Load() {
        On.Celeste.OuiMainMenu.OnExit += OnExit;
        Everest.Events.OnCriticalError += OnCriticalError;
    }

    [Unload]
    private static void Unload() {
        On.Celeste.OuiMainMenu.OnExit -= OnExit;
        Everest.Events.OnCriticalError -= OnCriticalError;
    }
    
    private static void OnExit(On.Celeste.OuiMainMenu.orig_OnExit orig, Celeste.OuiMainMenu self) {
        if(GameState.Instance.syncedState.ControlledByDiscord) {
            SocketConnection.SendMessage("Prevented exiting Celeste... whatcha doing?");
        } else {
            orig(self);
        }
    }
    
    private static void OnCriticalError(CriticalErrorHandler handler) {
        SocketConnection.SendMessage("<@601206663059603487>... Critical error handler called. if someone did this, [you deserve a role](https://discord.com/channels/1396648547708829778/1397050040882696244/1398561475345387593). The game will restart; hopefully no progress was lost!");
        
        // Restart the game
        Engine.Instance.Exit();
    }
}