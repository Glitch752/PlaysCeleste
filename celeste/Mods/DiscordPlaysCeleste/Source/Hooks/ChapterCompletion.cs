using Celeste;
using Celeste.Mod.mod;

public static class ChapterCompletion {
    [Load]
    private static void Load() {
        On.Celeste.Level.End += End;
    }

    [Unload]
    private static void Unload() {
        On.Celeste.Level.End -= End;
    }
    
    private static void End(On.Celeste.Level.orig_End orig, Celeste.Level self) {
        string chapterName = self.Session.Area.GetLevelSet();
        SocketConnection.SendCompleteChapter(new SocketConnection.CompleteChapterEvent(chapterName));
        
        orig(self);
    }
}