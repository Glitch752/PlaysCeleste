using System;
using Celeste.Mod;
using Microsoft.Xna.Framework;


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
    
    public GameState() {
        Instance = this;
    }
    
    public void Update() {
        if(framesToAdvanceRemaining <= 0) {
            // If we shouldn't run another frame, wait until the server tells us to
            SocketConnection.FrameAdvanceData data = SocketConnection.WaitForFrameAdvance();
            if(data == null) {
                "Failed to deserialize frame data.".Log(LogLevel.Error);
                return;
            }
            
            if(data.FramesToAdvance == 0) {
                "Cannot advance 0 frames.".Log(LogLevel.Error);
                return;
            }
            
            framesToAdvanceRemaining = data.FramesToAdvance;
            $"Advancing {framesToAdvanceRemaining} frames".Log();
            
            // TODO: Apply the keys held
        }
        
        framesToAdvanceRemaining -= 1;
        
        // If this is the last frame to advance, screenshot it
        shouldScreenshot = framesToAdvanceRemaining == 0;
        
        TimeSpan delta = new TimeSpan(166667); // 60 FPS
        SimulatedTimeTicks += delta.Ticks;
        simulatedGameTime = new GameTime(new TimeSpan(SimulatedTimeTicks), delta, false);
    }
}