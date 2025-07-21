using System;

namespace Celeste.Mod.mod;

public class DiscordPlaysCelesteModule : EverestModule {
    public static DiscordPlaysCelesteModule Instance { get; private set; }

    // See https://github.com/EverestAPI/Resources/wiki/Code-Mod-Setup#mod-settings-session-and-save-data
    public override Type SettingsType => typeof(DiscordPlaysCelesteSettings);
    public static DiscordPlaysCelesteSettings Settings => (DiscordPlaysCelesteSettings)Instance._Settings;

    public override Type SessionType => typeof(DiscordPlaysCelesteSession);
    public static DiscordPlaysCelesteSession Session => (DiscordPlaysCelesteSession)Instance._Session;

    public override Type SaveDataType => typeof(DiscordPlaysCelesteSaveData);
    public static DiscordPlaysCelesteSaveData SaveData => (DiscordPlaysCelesteSaveData)Instance._SaveData;

    public static GameState GameState = new GameState();

    public DiscordPlaysCelesteModule() {
        Instance = this;

        AttributeUtils.CollectMethods<LoadAttribute>();
        AttributeUtils.CollectMethods<LoadContentAttribute>();
        AttributeUtils.CollectMethods<UnloadAttribute>();
        AttributeUtils.CollectMethods<InitializeAttribute>();
    }

    // Set up any hooks, event handlers and your mod in general here.
    // Load runs before Celeste itself has initialized properly.
    public override void Load() {
        #if DEBUG
        // debug builds use verbose logging
        Logger.SetLogLevel(nameof(DiscordPlaysCelesteModule), LogLevel.Verbose);
        #else
        // release builds use info logging to reduce spam in log files
        Logger.SetLogLevel(nameof(modModule), LogLevel.Info);
        #endif
        
        AttributeUtils.Invoke<LoadAttribute>();
    }

    public override void Initialize() {
        AttributeUtils.Invoke<InitializeAttribute>();
    }

    public override void LoadContent(bool firstLoad) {
        AttributeUtils.Invoke<LoadContentAttribute>();
    }

    // Unload the entirety of your mod's content. Free up any native resources.
    public override void Unload() {
        AttributeUtils.Invoke<UnloadAttribute>();
    }
}

/// Invokes the target method when the module is loaded
[AttributeUsage(AttributeTargets.Method)]
internal class LoadAttribute(int priority = 0) : EventAttribute(priority);

/// Invokes the target method when the module's content is loaded
[AttributeUsage(AttributeTargets.Method)]
internal class LoadContentAttribute : Attribute;

/// Invokes the target method when the module is unloaded
[AttributeUsage(AttributeTargets.Method)]
internal class UnloadAttribute(int priority = 0) : EventAttribute(priority);

/// Invokes the target method when the module is initialized
[AttributeUsage(AttributeTargets.Method)]
internal class InitializeAttribute(int priority = 0) : EventAttribute(priority);