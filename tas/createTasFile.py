# /// script
# requires-python = ">=3.13"
# dependencies = []
# ///

import json

CHAPTER = "Forsaken City"
START_LOCATION = "1 6c"

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

console load {START_LOCATION}
   1

#Start
  88
""")
    
        # Stream events.jsonl line-by-line
        with open("events.jsonl", "r") as file:
            for line in file:
                # Parse the json
                event = line.strip()
                if not event or event.startswith("//"):
                    continue
                event_data = json.loads(event)
                
                if event_data["type"] == "message":
                    tas_file.write(f"  # {event_data['content']}\n")
                    
                if event_data["type"] == "death":
                    tas_file.write(f"  # Madeline dies here")
                
                if event_data["type"] == "inputHistory":
                    keys = event_data["keysHeld"]
                    mapped_keys = []
                    for key in keys:
                        if key in BIND_MAP:
                            mapped_keys.append(BIND_MAP[key])
                            if key == "Escape":
                                print(f"Probably a pause event; this will require manual intervention in the TAS file.")
                        else:
                            print(f"Warning: Key '{key}' not found in bind map.")
                    
                    if len(mapped_keys) == 0:
                        tas_file.write(f"  {event_data['frames']}\n")
                    else:
                        tas_file.write(f"  {event_data['frames']},{",".join(mapped_keys)}\n")
                
                if event_data["type"] == "completeChapter" and event_data["chapterName"] != CHAPTER:
                    break
        
        # Footer
        tas_file.write(f"""
#lvl_1""")
                

if __name__ == "__main__":
    main()
