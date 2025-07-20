using System;
using Monocle;

namespace Celeste.Mod.mod;

public class modModule : EverestModule
{
    public static modModule Instance { get; private set; }

    // See https://github.com/EverestAPI/Resources/wiki/Code-Mod-Setup#mod-settings-session-and-save-data
    public override Type SettingsType => typeof(modModuleSettings);
    public static modModuleSettings Settings => (modModuleSettings)Instance._Settings;

    public override Type SessionType => typeof(modModuleSession);
    public static modModuleSession Session => (modModuleSession)Instance._Session;

    public override Type SaveDataType => typeof(modModuleSaveData);
    public static modModuleSaveData SaveData => (modModuleSaveData)Instance._SaveData;

    public modModule()
    {
        Instance = this;
#if DEBUG
        // debug builds use verbose logging
        Logger.SetLogLevel(nameof(modModule), LogLevel.Verbose);
#else
        // release builds use info logging to reduce spam in log files
        Logger.SetLogLevel(nameof(modModule), LogLevel.Info);
#endif
    }

    // Set up any hooks, event handlers and your mod in general here.
    // Load runs before Celeste itself has initialized properly.
    public override void Load()
    {
        On.Monocle.Engine.RenderCore += RenderCore;
    }

    protected virtual void RenderCore(On.Monocle.Engine.orig_RenderCore orig, Engine self)
    {
        // Log to the console
        Logger.Log(nameof(modModule), "RenderCore called");

        orig(self);
    }

    // Optional, initialize anything after Celeste has initialized itself properly.
    public override void Initialize()
    {
    }

    // Optional, do anything requiring either the Celeste or mod content here.
    public override void LoadContent(bool firstLoad)
    {
    }

    // Unload the entirety of your mod's content. Free up any native resources.
    public override void Unload()
    {
        On.Monocle.Engine.RenderCore -= RenderCore;
    }
}