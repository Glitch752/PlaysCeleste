using Celeste;
using Celeste.Mod;
using Celeste.Mod.mod;

public static class LevelControlHooks {
    [Load]
    private static void Load() {
        Everest.Events.Level.OnUnpause += OnUnpause;
        Everest.Events.Level.OnPause += OnPause;
        Everest.Events.Level.OnEnter += OnEnter;
        Everest.Events.Level.OnExit += OnExit;
    }

    [Unload]
    private static void Unload() {
        Everest.Events.Level.OnUnpause -= OnUnpause;
        Everest.Events.Level.OnPause -= OnPause;
        Everest.Events.Level.OnEnter -= OnEnter;
        Everest.Events.Level.OnExit -= OnExit;
    }
    
    private static void OnUnpause(Level self) {
        "Unpaused".Log();
        SocketConnection.SendSetControlledChapter(new SocketConnection.SetControlledChapterEvent(
            ChangeRoom.GetChapterName(self.Session.Area)
        ));
    }
    
    private static void OnPause(Level self, int startIndex, bool minimal, bool quickReset) {
        "Paused".Log(); 
        SocketConnection.SendSetControlledChapter(new SocketConnection.SetControlledChapterEvent(null));
    }
    
    private static void OnEnter(Session session, bool fromSaveData) {
        string chapter = ChangeRoom.GetChapterName(session.Area);
        $"Entered {chapter}".Log();
        SocketConnection.SendSetControlledChapter(new SocketConnection.SetControlledChapterEvent(chapter));
        SocketConnection.SendChangeRoom(new SocketConnection.ChangeRoomEvent(
            null,
            session.LevelData.Name,
            chapter
        ));
    }
    
    private static void OnExit(Level level, LevelExit exit, LevelExit.Mode mode, Session session, HiresSnow snow) {
        $"Exited {ChangeRoom.GetChapterName(session.Area)}".Log();
        SocketConnection.SendSetControlledChapter(new SocketConnection.SetControlledChapterEvent(null));
    }
}