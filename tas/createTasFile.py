# /// script
# requires-python = ">=3.13"
# dependencies = []
# ///

import json
from typing import Generator

CHAPTER = "Old Site"
START_LOCATION = "2 start"

# TODO: Find starting strawberry count and reset appropriately


# https://github.com/EverestAPI/CelesteTAS-EverestInterop/wiki/Input-File#available-actions
TAS_NOTATION_COMMANDS = {
    'Up': ['U'],
    'Down': ['D'],
    'Left': ['L'],
    'Right': ['R'],
    'MenuUp': ['U'],
    'MenuDown': ['D'],
    'MenuLeft': ['L'],
    'MenuRight': ['R'],
    'UpDashOnly': ['AU'],
    'DownDashOnly': ['AD'],
    'LeftDashOnly': ['AL'],
    'RightDashOnly': ['AR'],
    'UpMoveOnly': ['MU'],
    'DownMoveOnly': ['MD'],
    'LeftMoveOnly': ['ML'],
    'RightMoveOnly': ['MR'],
    
    'Grab': ['G', 'H'],
    'Jump': ['J', 'K'],
    'Dash': ['X', 'C'],
    'DemoDash': ['Z', 'V'],
    'Talk': ['X', 'N'],
    
    'Journal': ['N'],
    
    'Confirm': ['O', 'J'],
    'QuickRestart': ['Q'],
    
    'Pause': ['S']
}
HARDCODED_BINDS = {
    'Escape': 'S' # Always pause
}

current_binds = {}

INSERTED_EVENTS = {
    0: """{"type":"bindsChanged","binds":{"Left":["Left"],"Right":["Right"],"Down":["Down"],"Up":["Up"],"MenuLeft":["Left"],"MenuRight":["Right"],"MenuDown":["Down"],"MenuUp":["Up"],"Grab":["Z","V","LeftShift"],"Jump":["C","D"],"Dash":["X","B"],"Talk":["X"],"Pause":["Enter"],"Confirm":["C"],"Cancel":["X","Back"],"Journal":["Tab"],"QuickRestart":["R"],"DemoDash":["S"],"LeftMoveOnly":[],"RightMoveOnly":[],"DownMoveOnly":[],"UpMoveOnly":[],"LeftDashOnly":[],"RightDashOnly":[],"DownDashOnly":[],"UpDashOnly":[]}"""
}

def events() -> Generator[tuple[int, str], None, None]:
    "Streams events.jsonl line-by-line while inserting extra events at predefined locations"
    with open("events.jsonl", "r") as file:
        for i, line in enumerate(file):
            if i in INSERTED_EVENTS:
                yield (i, INSERTED_EVENTS[i] + '\n')
            
            yield (i, line)

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
    
        for i, line in events():
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
            
            match event_data["type"]:
                case  "message":
                    tas_file.write(f"  # {event_data['content']}\n")
                case "death":
                    tas_file.write(f"  # Madeline dies here\n")
                case "completeChapter":
                    tas_file.write(f"  # Chapter {event_data['chapterName']} completed\n")
                case "changeRoom":
                    tas_file.write(f"  # Changed room from {event_data['fromRoomName']} to {event_data['toRoomName']}\n")
                case "collectStrawberry":
                    tas_file.write(f"  # Collected {event_data['roomName']} strawberry\n")
                case "collectHeart":
                    tas_file.write(f"  # Collected {event_data['roomName']} heart\n")
                case "collectCassette":
                    tas_file.write(f"  # Collected {event_data['roomName']} cassette\n")
                case "inputHistory":
                    keys = event_data["keysHeld"]
                    mapped_keys = []
                    for key in keys:
                        if key in current_binds:
                            mapped_keys.append(current_binds[key])
                        else:
                            print(f"Warning: Key '{key}' not found in bind map.")
                    
                    if len(mapped_keys) == 0:
                        tas_file.write(f"  {event_data['frames']}\n")
                    else:
                        tas_file.write(f"  {event_data['frames']},{",".join(mapped_keys)}\n")
                case "bindsChanged":
                    current_binds = {}
                    for key, action in HARDCODED_BINDS.items():
                        current_binds[key] = action
                    for action, keys in event_data["binds"].items():
                        if action in TAS_NOTATION_COMMANDS:
                            for i, key in enumerate(keys):
                                if i < len(TAS_NOTATION_COMMANDS[action]):
                                    current_binds[key] = TAS_NOTATION_COMMANDS[action][i]
                                else:
                                    print(f"Warning: Too many keys for action '{action}' in binds.")
                        else:
                            print(f"Warning: Action '{action}' not found in TAS_NOTATION_COMMANDS.")
        
        # Footer
        tas_file.write(f"""
#lvl_1""")
                

if __name__ == "__main__":
    main()
