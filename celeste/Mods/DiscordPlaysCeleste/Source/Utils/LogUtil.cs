using System;
using Celeste.Mod;
using Celeste.Mod.mod;
using Microsoft.Xna.Framework;
using Monocle;

/// <summary>
/// Logging utilities. Taken from CelesteTAS.
/// Allows you to write statements like the following:
/// <code>
/// $"Test".Log();
/// $"String".Log(LogLevel.Error);
/// exception.LogException();
/// </code>
/// </summary>
internal static class LogUtil
{
    public const string Tag = nameof(DiscordPlaysCelesteModule);

#if DEBUG
    public static void DebugLog(this object text, LogLevel logLevel = LogLevel.Debug) => text.DebugLog(logLevel);
#endif

    public static void LogException(this Exception e) {
        Logger.LogDetailed(e, Tag);
    }

    public static void LogException(this Exception e, string header, LogLevel logLevel = LogLevel.Error) => e.LogException(header, string.Empty, logLevel);
    public static void LogException(this Exception e, string header, string category, LogLevel logLevel = LogLevel.Error) {
        header.Log(category, logLevel);
        Logger.LogDetailed(e, Tag);
    }

    public static void Log(this object text, LogLevel logLevel = LogLevel.Info) => text.Log(string.Empty, logLevel);
    public static void Log(this object text, string category, LogLevel logLevel = LogLevel.Info)
    {
        string tag = category == string.Empty
            ? Tag
            : $"{Tag}/{category}";

        string textStr = text?.ToString() ?? "null";
        Logger.Log(logLevel, tag, textStr);
    }
}