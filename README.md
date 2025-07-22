# Discord Plays Celeste

(From [the Discord server](https://discord.gg/vNq6rRWM))

## What is this?
Welcome to Discord Plays Celeste! This is a little project to allow distributed gameplay of [Celeste](https://www.celestegame.com/) through a Discord bot that presents the game with interactive controls, one screenshot at a time.

This is made of two components:
- The Discord bot backend itself in Typescript that interfaces with the game.
- A mod for [Everest](https://everestapi.github.io/) to interface closely with the game (manage when frames are advanced, overwrite what keys are pressed, readback the output, etc). It's only tested on Everest version 5635, and some of the code is admittedly hacky enough that I wouldn't be surprised if it breaks on other versions.

The bot is meant to run headless on a Linux server with software Vulkan rendering, but it isn't tied to a specific renderer.

## How to play
The gameplay loop is as follows:
- The bot sends a message with a screenshot of the game
- Users react with emojis that have different purposes (see below)
- Once there is a valid reaction state, a certain number of users have reacted to at least one action, and it's been a few seconds since the latest reaction, the game will advance and repeat.

Valid reactions:
- Regional indicators (e.g. :regional_indicator_c:) cause their corresponding key to be held down
  - :regional_indicator_c: jumps
  - :regional_indicator_x: dashes
  - :regional_indicator_z: grabs
arrows: move
- :leftwards_arrow_with_hook: holds enter
- :arrow_right_hook: holds tab
- :arrow_up:, :arrow_down:, :arrow_left:, and :arrow_right: hold the corresponding arrow keys
- :x: holds escape
- Numbers (e.g. :one:) progress the game the corresponding number of frames
- :fast_forward: multiplies the frame count by 6 (effectively turning it from frames to tenths of a second)
- Clocks (e.g. :clock1:) progress the game the corresponding number of seconds
  - Half-hour increments correspond to half-seconds, e.g. :clock330: is 3.5 seconds.

Keys are only held until the next loop, so they must be repeated every time they're still needed. Progress intervals stack.

## Please work toward a shared goal!
Feel free to communicate live; it makes it much more fun! The initial goal, of course, is to beat the game, but I'm not sure how feasible that is :upside_down:
If someone is intentionally trying to stall progress, I don't currently have a mechanism in place for revoking permissions, but I plan to mute users if needed. Feel free to mess around if it's not harmful, though, of course!


## TODO
- Track hearts