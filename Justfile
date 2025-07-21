build:
    dotnet build ./celeste/Mods/DiscordPlaysCeleste/mod.sln /target:mod /property:GenerateFullPaths=true /consoleloggerparameters:NoSummary /p:Configuration=Debug /p:Platform="Any CPU"

run:
    ./celeste/Celeste --console

server:
    cd server && pnpm run dev