# /// script
# requires-python = ">=3.13"
# dependencies = []
# ///

import json

CHAPTER = "Old Site"
START_LOCATION = "2 start"

# TODO: Find starting strawberry count and reset appropriately

# https://github.com/EverestAPI/CelesteTAS-EverestInterop/wiki/Input-File#available-actions
BIND_MAP = {
    'Up': 'U',
    'Down': 'D',
    'Left': 'L',
    'Right': 'R',
    'C': 'J',
    'X': 'X',
    'Z': 'G',
    'V': 'H',
    'D': 'K', # Jump bind 2
    'B': 'C', # Dash bind 2
    'Escape': 'S', # pause
    'Enter': 'O', # confirm
    'R': 'Q', # quick restart
    'S': 'Z' # demodash
}

def main() -> None:
    # Create a new TAS file for the specified chapter
    with open(f"{CHAPTER}.tas", "w") as tas_file:
        tas_file.write(f"""RecordCount: 1

Set,ScreenShake,Off
Set,CrouchDashMode,Press
Set,GrabMode,Hold
Set,DisableFlashes,True
Set,SpeedrunClock,File

console wipedebug
console load {START_LOCATION}
   1

#Start
  88
""")
        
        current_controlled = ""
    
        # Stream events.jsonl line-by-line
        with open("events.jsonl", "r") as file:
            for i, line in enumerate(file):
                # Parse the json
                event = line.strip()
                if not event or event.startswith("//"):
                    continue
                event_data = json.loads(event)
                
                if event_data["type"] == "setControlledChapter":
                    if current_controlled == CHAPTER and event_data["chapter"] == None:
                        # Prompt the user if this should be included
                        print(f"\nCurrently controlling {current_controlled}.")
                        print(f"Warning: Event with no chapter controlled found on line {i + 1}.")
                        print("Should the remaining events be included? (y/n)")
                        user_input = input().strip().lower()
                        if user_input == 'y':
                            current_controlled = CHAPTER
                        else:
                            current_controlled = None
                    else:
                        current_controlled = event_data["chapter"]
                
                if current_controlled != CHAPTER:
                    continue
                
                if event_data["type"] == "message":
                    tas_file.write(f"  # {event_data['content']}\n")
                    
                if event_data["type"] == "death":
                    tas_file.write(f"  # Madeline dies here\n")
                
                if event_data["type"] == "inputHistory":
                    keys = event_data["keysHeld"]
                    mapped_keys = []
                    for key in keys:
                        if key in BIND_MAP:
                            mapped_keys.append(BIND_MAP[key])
                        else:
                            print(f"Warning: Key '{key}' not found in bind map.")
                    
                    if len(mapped_keys) == 0:
                        tas_file.write(f"  {event_data['frames']}\n")
                    else:
                        tas_file.write(f"  {event_data['frames']},{",".join(mapped_keys)}\n")
        
        # Footer
        tas_file.write(f"""
#lvl_1""")
                

if __name__ == "__main__":
    main()
