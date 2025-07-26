using System.Collections.Generic;
using Celeste;
using Celeste.Mod.mod;
using Microsoft.Xna.Framework;

public static class StrawberryCollection {
    [Load]
    private static void Load() {
        On.Celeste.Strawberry.ctor += StrawberryCtor;
        On.Celeste.Strawberry.OnCollect += OnCollect;
    }

    [Unload]
    private static void Unload() {
        On.Celeste.Strawberry.ctor -= StrawberryCtor;
        On.Celeste.Strawberry.OnCollect -= OnCollect;
    }
    
    // hack aaaahh
    private static Dictionary<EntityID, bool> ActuallyWingedStrawberries = new Dictionary<EntityID, bool>();
    
    private static void StrawberryCtor(
        On.Celeste.Strawberry.orig_ctor orig,
        Strawberry self,
        EntityData data, Vector2 offset, EntityID gid
    ) {
        orig(self, data, offset, gid);
        
        ActuallyWingedStrawberries[self.ID] = self.Winged;
    }
    
    private static void OnCollect(On.Celeste.Strawberry.orig_OnCollect orig, Strawberry self) {
        orig(self);
        
        string roomName = self.ID.Level;
        string chapterName = ChangeRoom.GetChapterName(self.SceneAs<Level>().Session.Area);
        int newStrawberryCount = SaveData.Instance.TotalStrawberries;
        
        if(self.Moon) {
            SocketConnection.SendMessage("Wow. actually insane. what. how did you do this. I didn't even add support for this because I didn't think it would ever happen.");
        }
        
        SocketConnection.SendStrawberryCollected(new SocketConnection.StrawberryCollectedEvent(
            roomName,
            chapterName,
            self.ID.Key,
            self.isGhostBerry,
            self.Golden,
            ActuallyWingedStrawberries[self.ID],
            newStrawberryCount
        ));
    }
}