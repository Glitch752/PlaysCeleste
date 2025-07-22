using Celeste.Mod.mod;
using Microsoft.Xna.Framework.Input;

public static class KeyboardInput {
    [Load]
    private static void Load() {
        On.Monocle.MInput.KeyboardData.Update += Update;
    }

    [Unload]
    private static void Unload() {
        On.Monocle.MInput.KeyboardData.Update -= Update;
    }
    
    private static void Update(On.Monocle.MInput.KeyboardData.orig_Update orig, Monocle.MInput.KeyboardData self) {
        if(GameState.Instance.syncedState.ControlledByDiscord) {
            self.PreviousState = self.CurrentState;
            
            KeyboardState state = new KeyboardState(GameState.Instance.heldKeys.ToArray());
            self.CurrentState = state;
        } else {
            // If we're not controlled by Discord, just use the original update method.
            orig(self);
        }
    }
}