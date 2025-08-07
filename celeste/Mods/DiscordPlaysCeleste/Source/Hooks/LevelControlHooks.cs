using System.Linq;
using Celeste;
using Celeste.Mod;
using Celeste.Mod.mod;
using Celeste.Pico8;
using Microsoft.Xna.Framework;
using Monocle;

public static class LevelControlHooks {
    [Load]
    private static void Load() {
        Everest.Events.Level.OnUnpause += OnUnpause;
        Everest.Events.Level.OnPause += OnPause;
        Everest.Events.Level.OnEnter += OnEnter;
        Everest.Events.Level.OnExit += OnExit;
        On.Celeste.Celeste.Update += OnUpdate;
    }

    [Unload]
    private static void Unload() {
        Everest.Events.Level.OnUnpause -= OnUnpause;
        Everest.Events.Level.OnPause -= OnPause;
        Everest.Events.Level.OnEnter -= OnEnter;
        Everest.Events.Level.OnExit -= OnExit;
        On.Celeste.Celeste.Update -= OnUpdate;
    }
    
    private static void OnUnpause(Level self) {
        "Unpaused".Log();
        SocketConnection.SendSetControlledChapter(new SocketConnection.SetControlledChapterEvent(
            ChangeRoom.GetChapterName(self.Session.Area), "unpaused"
        ));
    }
    
    private static void OnPause(Level self, int startIndex, bool minimal, bool quickReset) {
        "Paused".Log(); 
        SocketConnection.SendSetControlledChapter(new SocketConnection.SetControlledChapterEvent(
            ChangeRoom.GetChapterName(self.Session.Area), "paused"
        ));
    }
    
    private static void OnEnter(Session session, bool fromSaveData) {
        string chapter = ChangeRoom.GetChapterName(session.Area);
        $"Entered {chapter}".Log();
        SocketConnection.SendSetControlledChapter(new SocketConnection.SetControlledChapterEvent(chapter, "enter"));
        ChangeRoom.RoomChanged(null, session.LevelData.Name, chapter, "enter");
    }
    
    private static void OnExit(Level level, LevelExit exit, LevelExit.Mode mode, Session session, HiresSnow snow) {
        $"Exited {ChangeRoom.GetChapterName(session.Area)}".Log();
        SocketConnection.SendSetControlledChapter(new SocketConnection.SetControlledChapterEvent(null, "exit"));
    }

    private static bool CurrentlyUnsafe = false;

    private static void OnUpdate(On.Celeste.Celeste.orig_Update orig, Celeste.Celeste self, GameTime gameTime) {
        orig(self, gameTime);

        // Unsafe check logic from CelesteTAS
        bool isUnsafe = false;
        if(Engine.Scene is not (Level or LevelLoader or LevelExit or Emulator or LevelEnter)) {
            isUnsafe = true;
        }
        if(Engine.Scene is Level level && level.Tracker.GetEntityTrackIfNeeded<TextMenu>() is { } menu) {
            var item = menu.Items.FirstOrDefault();

            if(item is TextMenu.Header { Title: { } title }
                && (title == Dialog.Clean("OPTIONS_TITLE") || title == Dialog.Clean("MENU_VARIANT_TITLE")
                    || Dialog.Has("MODOPTIONS_EXTENDEDVARIANTS_PAUSEMENU_BUTTON") && title == Dialog.Clean("MODOPTIONS_EXTENDEDVARIANTS_PAUSEMENU_BUTTON").ToUpperInvariant())
                || item is TextMenuExt.HeaderImage { Image: "menu/everest" }
            ) {
                isUnsafe = true;
            }
        }

        if(isUnsafe != CurrentlyUnsafe) {
            if(isUnsafe) {
                "Now in unsafe menu".Log();
                SocketConnection.SendSetControlledChapter(new SocketConnection.SetControlledChapterEvent(
                    null, "unsafe"
                ));
            } else {
                "Back in safe menu".Log();
                if(self.scene is Level level2) {
                    SocketConnection.SendSetControlledChapter(new SocketConnection.SetControlledChapterEvent(
                        ChangeRoom.GetChapterName(level2.Session.Area), "safe"
                    ));
                } else {
                    SocketConnection.SendSetControlledChapter(new SocketConnection.SetControlledChapterEvent(
                        null, "safe"
                    ));
                }
            }
        }

        CurrentlyUnsafe = isUnsafe;
    }
}