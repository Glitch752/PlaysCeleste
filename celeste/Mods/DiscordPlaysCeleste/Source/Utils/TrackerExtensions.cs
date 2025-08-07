using Monocle;

internal static class TrackerExtensions {
    #nullable enable
    public static T? GetEntityTrackIfNeeded<T>(this Tracker tracker) where T : Entity {
        var entities = tracker.GetEntitiesTrackIfNeeded<T>();
        return entities.Count == 0 ? null : entities[0] as T;
    }
}