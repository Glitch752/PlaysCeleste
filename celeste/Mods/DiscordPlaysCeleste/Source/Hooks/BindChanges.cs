using System.Collections.Generic;
using System.Linq;
using Celeste;
using Celeste.Mod.mod;
using Microsoft.Xna.Framework.Input;
using Monocle;

public static class BindChanges {
    [Load]
    private static void Load() {
        // Maybe there's a better way to detect any binding changes? I couldn't find one.
        // This doesn't handle controller or mouse bind changes, but we don't care about those anyway
        On.Celeste.KeyboardConfigUI.Clear += KeyboardConfigClear;
        On.Celeste.KeyboardConfigUI.AddRemap_Keys += KeyboardConfigAddRemap;
        On.Celeste.Input.Initialize += InputInitialize; // Called in a few key change circumstances
    }

    [Unload]
    private static void Unload() {
        On.Celeste.KeyboardConfigUI.Clear -= KeyboardConfigClear;
        On.Celeste.KeyboardConfigUI.AddRemap_Keys -= KeyboardConfigAddRemap;
        On.Celeste.Input.Initialize -= InputInitialize;
    }
    
    private static void KeyboardConfigClear(
        On.Celeste.KeyboardConfigUI.orig_Clear orig,
        KeyboardConfigUI config,
        Binding binding
    ) {
        orig(config, binding);
        
        CheckForBindChange();
    }
    
    private static void KeyboardConfigAddRemap(
        On.Celeste.KeyboardConfigUI.orig_AddRemap_Keys orig,
        KeyboardConfigUI config,
        Keys keys
    ) {
        orig(config, keys);
        
        CheckForBindChange();
    }
    
    private static void InputInitialize(
        On.Celeste.Input.orig_Initialize orig
    ) {
        orig();
        
        CheckForBindChange();
    }
    
    private static string[] GetBinds(Binding binding) {
        List<string> keys = new();
        if(binding == null || binding.Keyboard == null) {
            return keys.ToArray();
        }
        
        foreach(Keys key in binding.Keyboard) {
            if(key != Keys.None) {
                keys.Add(key.ToString());   
            }
        }
        
        // This doesn't handle mouse or controller, but it doesn't need to ;)
        return keys.ToArray();
    }
    
    private static Dictionary<string, string[]> latestBinds = [];
    
    public static void CheckForBindChange(bool onlyIfChanged = true) {
        var binds = new Dictionary<string, string[]>();
        
        var s = Settings.Instance;
        binds.Add("Left",          GetBinds(s.Left));
        binds.Add("Right",         GetBinds(s.Right));
        binds.Add("Down",          GetBinds(s.Down));
        binds.Add("Up",            GetBinds(s.Up));
        binds.Add("MenuLeft",      GetBinds(s.MenuLeft));
        binds.Add("MenuRight",     GetBinds(s.MenuRight));
        binds.Add("MenuDown",      GetBinds(s.MenuDown));
        binds.Add("MenuUp",        GetBinds(s.MenuUp));
        binds.Add("Grab",          GetBinds(s.Grab));
        binds.Add("Jump",          GetBinds(s.Jump));
        binds.Add("Dash",          GetBinds(s.Dash));
        binds.Add("Talk",          GetBinds(s.Talk));
        binds.Add("Pause",         GetBinds(s.Pause));
        binds.Add("Confirm",       GetBinds(s.Confirm));
        binds.Add("Cancel",        GetBinds(s.Cancel));
        binds.Add("Journal",       GetBinds(s.Journal));
        binds.Add("QuickRestart",  GetBinds(s.QuickRestart));
        binds.Add("DemoDash",      GetBinds(s.DemoDash));
        binds.Add("LeftMoveOnly",  GetBinds(s.LeftMoveOnly));
        binds.Add("RightMoveOnly", GetBinds(s.RightMoveOnly));
        binds.Add("DownMoveOnly",  GetBinds(s.DownMoveOnly));
        binds.Add("UpMoveOnly",    GetBinds(s.UpMoveOnly));
        binds.Add("LeftDashOnly",  GetBinds(s.LeftDashOnly));
        binds.Add("RightDashOnly", GetBinds(s.RightDashOnly));
        binds.Add("DownDashOnly",  GetBinds(s.DownDashOnly));
        binds.Add("UpDashOnly",    GetBinds(s.UpDashOnly));
 
        bool changed = false;
        foreach(var kv in binds) {
            if(!latestBinds.TryGetValue(kv.Key, out var oldBinds) ||
                oldBinds.Length != kv.Value.Length ||
                !Enumerable.SequenceEqual(oldBinds, kv.Value)
            ) {
                changed = true;
                break;
            }
        }

        if(onlyIfChanged && !changed) return;

        latestBinds = new(binds);
 
        SocketConnection.SendBindsChanged(new SocketConnection.BindsChangedEvent(
            binds
        ));
    }
}