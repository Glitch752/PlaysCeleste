using System.Collections;
using Celeste;
using Celeste.Mod.mod;

public static class CassetteCollection {
    [Load]
    private static void Load() {
        On.Celeste.Cassette.CollectRoutine += CollectRoutine;
    }

    [Unload]
    private static void Unload() {
        On.Celeste.Cassette.CollectRoutine -= CollectRoutine;
    }

    private static IEnumerator CollectRoutine(
        On.Celeste.Cassette.orig_CollectRoutine orig,
        Cassette self,
        Player player
    ) {
        IEnumerator routine = orig(self, player);
        
        routine.MoveNext();
        yield return routine.Current;

        Level level = self.SceneAs<Level>();
        string roomName = level.Session.LevelData.Name;
        string chapterName = ChangeRoom.GetChapterName(level.Session.Area);
        int newCassetteCount = SaveData.Instance.TotalCassettes;

        SocketConnection.SendCassetteCollected(new SocketConnection.CassetteCollectedEvent(
            self.IsGhost,
            roomName,
            chapterName,
            newCassetteCount
        ));
        
        while(routine.MoveNext()) {
            yield return routine.Current;
        }
    }
}