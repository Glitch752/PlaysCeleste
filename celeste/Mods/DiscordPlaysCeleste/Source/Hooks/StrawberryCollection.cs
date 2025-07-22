using Celeste;
using Celeste.Mod.mod;

public static class StrawberryCollection {
    [Load]
    private static void Load() {
        On.Celeste.Strawberry.OnCollect += OnCollect;
    }

    [Unload]
    private static void Unload() {
        On.Celeste.Strawberry.OnCollect -= OnCollect;
    }
    
    private static void OnCollect(On.Celeste.Strawberry.orig_OnCollect orig, Celeste.Strawberry self) {
        orig(self);
        
        string roomName = self.SceneAs<Level>().Session.LevelData.Name;
        string chapterName = self.SceneAs<Level>().Session.Area.GetLevelSet();
        int newStrawberryCount = SaveData.Instance.TotalStrawberries;
        
        if(self.Moon) {
            SocketConnection.SendMessage("Wow. actually insane. what. how did you do this. I didn't even add support for this because I didn't think it would ever happen.");
        }
        
        SocketConnection.SendStrawberryCollected(new SocketConnection.StrawberryCollectedEvent(
            roomName,
            chapterName,
            self.Golden,
            self.Winged,
            newStrawberryCount
        ));
    }
}