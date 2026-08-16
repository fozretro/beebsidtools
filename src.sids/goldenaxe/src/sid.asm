; Golden Axe PSID payload at $1000:
;   stub ($1000–$10EF) + player image + remaining packed songs.
        org     $1000
.Start
        INCBIN  "stub.bin"
        INCBIN  "../out/player.bin"
        INCBIN  "tail.bin"
.End
        SAVE    "../out/payload.bin",Start,End
