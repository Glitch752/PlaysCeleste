using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using Celeste.Mod;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Input;
using Monocle;


/// <summary>
/// Manages global state associated with running the game.
/// </summary>
public class GameState {
    public static GameState Instance { get; private set; }
    
    /// <summary>
    /// The simulated game time.
    /// </summary>
    public GameTime simulatedGameTime = new GameTime();
    /// <summary>
    /// The simulated total elapsed time in 100ns "ticks".
    /// </summary>
    private long SimulatedTimeTicks = 0;
    /// <summary>
    /// If we should take a screenshot and send it back to the JS process at the end of this frame.
    /// </summary>
    public bool shouldScreenshot = false;
    
    /// <summary>
    /// The number of frames we need to still advance.
    /// </summary>
    public int framesToAdvanceRemaining = 0;
    
    /// <summary>
    /// The keys that are currently held down.
    /// </summary>
    public List<Keys> heldKeys = new List<Keys>();
    
    /// <summary>
    /// State that is synchronized only from the server.
    /// </summary>
    public class SyncedState {
        /// <summary>
        /// Whether the game is currently being controlled by Discord.  
        /// If false, the game is being manually controlled instead.
        /// </summary>
        public bool ControlledByDiscord { get; set; } = true;
        
        public override string ToString() {
            return $"ControlledByDiscord: {ControlledByDiscord}";
        }
    }
    
    /// <summary>
    /// The state that is synchronized from the server.  
    /// Access syncedState instead for thread safety.
    /// </summary>
    private SyncedState _syncedState = new SyncedState();
    /// <summary>
    /// The state that is synchronized from the server.
    /// </summary>
    public SyncedState syncedState {
        get {
            lock(_syncedState) {
                return _syncedState;
            }
        }
        set {
            lock(_syncedState) {
                _syncedState = value;
            }
        }
    }
    
    public GameState() {
        Instance = this;
    }
    
    public void Reset() {
        shouldScreenshot = false;
        framesToAdvanceRemaining = 0;
        heldKeys.Clear();
    }
    
    private void UpdateManualControl(GameTime gameTime) {
        SimulatedTimeTicks += gameTime.ElapsedGameTime.Ticks;
        simulatedGameTime = new GameTime(new TimeSpan(SimulatedTimeTicks), gameTime.ElapsedGameTime, false);
        Reset();
    }
    
    public void Update(GameTime gameTime) {
        while(framesToAdvanceRemaining <= 0) {
            if(!syncedState.ControlledByDiscord) {
                UpdateManualControl(gameTime);
                return;
            }
            
            // If we shouldn't run another frame, wait until the server tells us to
            SocketConnection.FrameAdvanceData data = SocketConnection.BlockUntilFrameAdvance();
            
            if(data.FramesToAdvance == 0) {
                // Immediately send back a screenshot
                $"Received frame advance request with 0 frames to advance, sending screenshot.".Log(LogLevel.Verbose);
                ScreenshotFrame.SendScreenshotToServer(Engine.Instance.GraphicsDevice);
                continue;
            }
            
            framesToAdvanceRemaining = data.FramesToAdvance;
            $"Advancing {framesToAdvanceRemaining} frames with keys held: {data.KeysHeld.Aggregate("", (s, key) => s + $"{key}, ")}".Log(LogLevel.Verbose);
        
            heldKeys.Clear();
            foreach(string key in data.KeysHeld) {
                if(Enum.TryParse(key, out Keys parsedKey)) {
                    heldKeys.Add(parsedKey);
                } else {
                    $"Failed to parse key: {key}".Log(LogLevel.Error);
                }
            }
        }
        
        UpdateMInputState();
        
        framesToAdvanceRemaining -= 1;
        
        // If this is the last frame to advance, screenshot it
        shouldScreenshot = framesToAdvanceRemaining == 0;
        
        TimeSpan delta = new TimeSpan(166667); // 60 FPS
        SimulatedTimeTicks += delta.Ticks;
        simulatedGameTime = new GameTime(new TimeSpan(SimulatedTimeTicks), delta, false);
    }
    
    private void UpdateMInputState() {
        MInput.Keyboard.PreviousState = MInput.Keyboard.CurrentState;
        
        KeyboardState state = new KeyboardState(Instance.heldKeys.ToArray());
        MInput.Keyboard.CurrentState = state;
        
        MInput.UpdateVirtualInputs();
        
        $"{MInput.Keyboard.Check(Keys.Right)}".Log();
    }
}