using Celeste;
using Celeste.Mod.mod;
using Microsoft.Xna.Framework;

public static class ChangeRoom {
    private static string CurrentLevel = null;

    [Load]
    private static void Load() {
        On.Celeste.Level.TransitionTo += TransitionTo;
        On.Celeste.Level.TeleportTo += TeleportTo;
        On.Celeste.Level.LoadLevel += LoadLevel;
    }

    [Unload]
    private static void Unload() {
        On.Celeste.Level.TransitionTo -= TransitionTo;
        On.Celeste.Level.TeleportTo -= TeleportTo;
        On.Celeste.Level.LoadLevel += LoadLevel;
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
        RoomChanged(fromRoomName, toRoomName, chapterName, "transition");
        
        orig(self, next, direction);
    }
    
    private static void TeleportTo(
        On.Celeste.Level.orig_TeleportTo orig,
        Level self,
        Player player,
        string nextLevel,
        Player.IntroTypes introType,
        Vector2? nearestSpawn = null
    ) {
        string fromRoomName = self.Session.LevelData.Name;
        string toRoomName = nextLevel;
        string chapterName = GetChapterName(self.Session.Area);
        RoomChanged(fromRoomName, toRoomName, chapterName, "teleport");

        orig(self, player, nextLevel, introType, nearestSpawn);
    }

    private static void LoadLevel(
        On.Celeste.Level.orig_LoadLevel orig,
        Level self,
        Player.IntroTypes playerIntro,
        bool isFromLoader = false
    ) {
        string toRoomName = self.Session.LevelData.Name;
        if(CurrentLevel != toRoomName) {
            // We somehow got into this room without one of the known transitions
            // This could happen during evil cutscenes.
            RoomChanged(CurrentLevel, toRoomName, GetChapterName(self.Session.Area), "unknown");
            $"Changed room from {CurrentLevel} to {toRoomName} without a known transition.".Log();
        }

        orig(self, playerIntro, isFromLoader);
    }

    public static void RoomChanged(string fromRoomName, string toRoomName, string chapterName, string reason) {
        SocketConnection.SendChangeRoom(new SocketConnection.ChangeRoomEvent(fromRoomName, toRoomName, chapterName, reason));
        CurrentLevel = toRoomName;
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