using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Celeste.Mod;
using Celeste.Mod.Helpers;
using Celeste.Mod.mod;

/// Base class for priority-ordered events
/// Taken from CelesteTAS
[AttributeUsage(AttributeTargets.Method)]
public class EventAttribute(int priority) : Attribute {
    internal readonly int Priority = priority;
}

/// Utility methods for attribute-based events.
/// Taken from CelesteTAS
public static class AttributeUtils
{
    private static readonly Dictionary<Type, MethodInfo[]> attributeMethods = new();

    /// Gathers all static methods with attribute T
    /// Only searches through this project.
    public static void CollectMethods<T>(params Type[] parameterTypes) where T : Attribute
    {
        attributeMethods[typeof(T)] = typeof(DiscordPlaysCelesteModule).Assembly
            .GetTypesSafe()
            .SelectMany(type => type.Collect<T>(parameterTypes))
            // Invoke higher priorities later in the chain (i.e. on top of everything else)
            .OrderBy(info =>
            {
                if (info.GetCustomAttribute<T>() is EventAttribute eventAttr)
                {
                    return eventAttr.Priority;
                }
                return 0;
            })
            .ToArray();
    }

    /// Invokes all previously gathered methods for attribute T
    public static void Invoke<T>(params object[] parameters) where T : Attribute
    {
        if (!attributeMethods.TryGetValue(typeof(T), out var methods))
        {
            return;
        }

        foreach (var method in methods)
        {
            method.Invoke(null, parameters);
        }
    }

    private static IEnumerable<MethodInfo> Collect<T>(this Type type, Type[] parameterTypes) where T : Attribute => type
        .GetMethods(BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic)
        .Where(info =>
        {
            if (info.GetCustomAttribute<T>() == null)
            {
                return false;
            }

            if (!info.GetParameters().Select(param => param.ParameterType).SequenceEqual(parameterTypes))
            {
                $"Method '{info}' on type '{info.DeclaringType}' has attribute '{typeof(T)}' without matching parameter signature '({string.Join<Type>(", ", parameterTypes)})'".Log(LogLevel.Error);
                return false;
            }

            return true;
        });
}