using Celeste;
using Celeste.Mod.mod;

public static class ChapterCompletion {
    [Load]
    private static void Load() {
        On.Celeste.Level.CompleteArea_bool_bool_bool += CompleteArea;
    }

    [Unload]
    private static void Unload() {
        On.Celeste.Level.CompleteArea_bool_bool_bool -= CompleteArea;
    }
    
    private static ScreenWipe CompleteArea(
        On.Celeste.Level.orig_CompleteArea_bool_bool_bool orig,
        Level self,
        bool spotlightWipe, bool skipScreenWipe, bool skipCompleteScreen
    ) {
        string chapterName = ChangeRoom.GetChapterName(self.Session.Area);
        SocketConnection.SendCompleteChapter(new SocketConnection.CompleteChapterEvent(chapterName));
        
        return orig(self, spotlightWipe, skipScreenWipe, skipCompleteScreen);
    }
}