using Celeste;
using Celeste.Mod.mod;

public static class HeartCollection {
    [Load]
    private static void Load() {
        On.Celeste.HeartGem.RegisterAsCollected += OnCollect;
    }

    [Unload]
    private static void Unload() {
        On.Celeste.HeartGem.RegisterAsCollected -= OnCollect;
    }
    
    private static SocketConnection.HeartColor GetHeartColor(HeartGem heart) {
        AreaKey area = (heart.Scene as Level).Session.Area;
        if(heart.IsFake) {
            return SocketConnection.HeartColor.Fake;
        } else if(area.Mode == AreaMode.Normal) {
            return SocketConnection.HeartColor.Blue;
        } else if(area.Mode == AreaMode.BSide) {
            return SocketConnection.HeartColor.Red;
        } else {
            return SocketConnection.HeartColor.Gold;
        }
    }

    private static void OnCollect(
        On.Celeste.HeartGem.orig_RegisterAsCollected orig,
        HeartGem self,
        Level level, string poemID
    ) {
        orig(self, level, poemID);

        SocketConnection.HeartColor color = GetHeartColor(self);

        string roomName = level.Session.LevelData.Name;
        string chapterName = ChangeRoom.GetChapterName(level.Session.Area);
        int newHeartCount = SaveData.Instance.TotalHeartGems;

        SocketConnection.SendHeartCollected(new SocketConnection.HeartCollectedEvent(
            color,
            self.IsGhost,
            roomName,
            chapterName,
            newHeartCount
        ));
    }
}