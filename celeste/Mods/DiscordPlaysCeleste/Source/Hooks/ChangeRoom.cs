using Celeste;
using Celeste.Mod.mod;
using Microsoft.Xna.Framework;

public static class ChangeRoom {
    [Load]
    private static void Load() {
        On.Celeste.Level.TransitionTo += TransitionTo;
    }

    [Unload]
    private static void Unload() {
        On.Celeste.Level.TransitionTo -= TransitionTo;
    }
    
    private static void TransitionTo(
        On.Celeste.Level.orig_TransitionTo orig,
        Level self,
        LevelData next,
        Vector2 direction
    ) {
        string fromRoomName = self.Session.LevelData.Name;
        string toRoomName = next.Name;
        string chapterName = self.Session.Level;
        
        SocketConnection.SendChangeRoom(new SocketConnection.ChangeRoomEvent(
            fromRoomName, toRoomName, chapterName
        ));
        
        orig(self, next, direction);
    }
}