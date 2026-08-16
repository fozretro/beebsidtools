; RoboCop 3 PSID payload at $1FC0:
;   stub ($1FC0–$214F) + song 0 player + remaining packed songs.
        org     $1FC0
.Start
        INCBIN  "stub.bin"
        INCBIN  "../out/player.bin"
        INCBIN  "tail.bin"
.End
        SAVE    "../out/payload.bin",Start,End
