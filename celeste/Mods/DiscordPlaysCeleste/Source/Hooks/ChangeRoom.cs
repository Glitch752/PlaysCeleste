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
        string chapterName = GetChapterName(self.Session.Area);
        
        SocketConnection.SendChangeRoom(new SocketConnection.ChangeRoomEvent(
            fromRoomName, toRoomName, chapterName
        ));
        
        orig(self, next, direction);
    }
    
    public static string GetChapterName(AreaKey? area) {
        if(area == null) {
            return string.Empty;
        }

        AreaData areaData = AreaData.Get(area.Value);
        string chapterName = Dialog.Get(areaData.Name, Dialog.Languages["english"]);

        if(areaData.Interlude || chapterName == "Farewell") {
            return chapterName;
        }

        AreaMode areaMode = area.Value.Mode;
        string side = areaMode switch {
            AreaMode.Normal => "",
            AreaMode.BSide => " B Side",
            AreaMode.CSide => " C Side",
            _ => $" {(char) (areaMode + 'A')} Side"
        };

        return $"{chapterName}{side}";
    }
}