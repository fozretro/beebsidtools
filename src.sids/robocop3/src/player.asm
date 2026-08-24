; RoboCop 3 player at runtime $B000 (song 0 image, file $2150, $1900 bytes).
; BeebDis listing. Do not hand-edit if you still need a byte-identical
; round-trip — change known.symbols / the generator and regenerate.
;
L00E0   = $00E0
L00E1   = $00E1
L00E2   = $00E2
L00E5   = $00E5
L00E8   = $00E8
L00EB   = $00EB
L00EE   = $00EE
L00F1   = $00F1
L00F4   = $00F4
L00F7   = $00F7
L00FA   = $00FA
L00FB   = $00FB
L00FE   = $00FE
L00FF   = $00FF
SID     = $D400
SID_V1FREQHI = $D401
SID_V1PWLO = $D402
SID_V1PWHI = $D403
SID_V1CTRL = $D404
SID_V1AD = $D405
SID_V1SR = $D406
LD40B   = $D40B
LD412   = $D412
LD416   = $D416
LD417   = $D417
SID_MODEVOL = $D418
CIA1_TALO = $DC04
CIA1_TAHI = $DC05

        org     $B000
.BeebDisStartAddr
.player_init
        JMP     player_init_body

.player_play
        JMP     player_play_body

.LB006
        EQUB    $00

.LB007
        EQUB    $00

.LB008
        EQUB    $00,$00,$00

.LB00B
        EQUB    $00,$00,$00

.LB00E
        EQUB    $00,$00,$00

.LB011
        EQUB    $00,$00,$00

.LB014
        EQUB    $00,$00,$00

.LB017
        EQUB    $00,$00,$00

.LB01A
        EQUB    $00,$00,$00

.LB01D
        EQUB    $00,$00,$00

.LB020
        EQUB    $00,$00,$00

.LB023
        EQUB    $00,$00,$00

.LB026
        EQUB    $00,$00,$00

.LB029
        EQUB    $00,$00,$00

.LB02C
        EQUB    $00,$00,$00

.LB02F
        EQUB    $00,$00,$00

.LB032
        EQUB    $00,$00,$00

.LB035
        EQUB    $00,$00,$00

.LB038
        EQUB    $00,$00,$00

.LB03B
        EQUB    $00,$00,$00

.LB03E
        EQUB    $00,$00,$00

.LB041
        EQUB    $00,$00,$00

.LB044
        EQUB    $00,$00,$00

.LB047
        EQUB    $00,$00,$00

.LB04A
        EQUB    $00,$00,$00

.LB04D
        EQUB    $00,$00,$00

.LB050
        EQUB    $00,$00,$00

.LB053
        EQUB    $00,$00,$00

.LB056
        EQUB    $00,$00,$00

.LB059
        EQUB    $00,$00,$00

.LB05C
        EQUB    $00

.LB05D
        EQUB    $00,$07,$0E

.player_init_body
        LDX     #$02
.code_B062
        LDA     #$00
        STA     L00FB,X
        STA     L00EB,X
        LDA     #$03
        STA     L00EE,X
        LDA     #$01
        STA     L00F7,X
        STA     L00E5,X
        STA     LB00B,X
        DEX
        BPL     code_B062

        STA     L00FA
        LDA     #$00
        STA     L00FE
        LDA     #$FF
        STA     LD417
        LDA     #$0F
        STA     LB05C
        LDA     #$08
        STA     LD416
        RTS

.player_play_body
        LDA     L00FA
        BNE     code_B093

        RTS

.code_B093
        LDY     LB006
        BEQ     code_B0B6

        DEC     LB007
        BPL     code_B0B6

        STY     LB007
        DEC     LB05C
        BPL     code_B0B6

        LDA     #$00
        STA     SID_V1CTRL
        STA     LD40B
        STA     LD412
        STA     L00FA
        STA     LB006
        RTS

.code_B0B6
        LDA     #$FF
        STA     L00FF
        DEC     L00FE
        BPL     code_B0C4

        INC     L00FF
        LDA     #$02
        STA     L00FE
.code_B0C4
        LDA     LB05C
        ORA     #$50
        STA     SID_MODEVOL
        LDX     #$02
.code_B0CE
        LDY     LB05D,X
        LDA     L00F1,X
        STA     SID,Y
        LDA     L00F4,X
        STA     SID_V1FREQHI,Y
        LDA     LB017,X
        STA     SID_V1PWHI,Y
        LDA     LB014,X
        STA     SID_V1PWLO,Y
        LDA     LB059,X
        STA     SID_V1SR,Y
        LDA     LB056,X
        STA     SID_V1AD,Y
        LDA     LB04D,X
        AND     LB050,X
        STA     SID_V1CTRL,Y
        DEX
        BPL     code_B0CE

        LDX     #$02
.code_B101
        LDA     L00F7,X
        BEQ     jmp_B110

        LDA     L00FF
        BMI     code_B10D

        DEC     L00E5,X
        BEQ     jmp_B114

.code_B10D
        JMP     jmp_B244

.jmp_B110
        DEX
        BPL     code_B101

        RTS

.jmp_B114
        LDY     L00EB,X
        LDA     LB571,Y
        STA     L00E0
        LDA     LB588,Y
        STA     L00E1
.code_B120
        LDA     #$00
        STA     LB00E,X
        STA     L00E8,X
        LDY     L00EE,X
        LDA     (L00E0),Y
        CMP     #$FF
        BNE     code_B13B

        LDA     #$00
        STA     L00EE,X
        DEC     LB00B,X
        BNE     code_B120

        JMP     jmp_B1E9

.code_B13B
        CMP     #$FD
        BCC     code_B15A

        INY
        LDA     (L00E0),Y
        STA     L00E8,X
        INY
        LDA     (L00E0),Y
        CLC
        ADC     LB008,X
        STA     L00E2,X
        INY
        LDA     (L00E0),Y
        CLC
        ADC     LB008,X
        STA     LB02F,X
        JMP     jmp_B19C

.code_B15A
        CMP     #$C0
        BCC     code_B172

        AND     #$3F
        CLC
        ADC     LB044,X
        STA     LB041,X
        INY
        LDA     (L00E0),Y
        CMP     #$FD
        BEQ     code_B13B

        CMP     #$C0
        BCS     code_B19D

.code_B172
        CMP     #$80
        BCC     code_B186

        AND     #$3F
        STA     LB047,X
        INY
        LDA     (L00E0),Y
        CMP     #$FD
        BEQ     code_B13B

        CMP     #$80
        BCS     code_B19D

.code_B186
        CMP     #$60
        BCC     code_B196

        AND     #$1F
        STA     LB04A,X
        INY
        LDA     (L00E0),Y
        CMP     #$60
        BCS     code_B19D

.code_B196
        CLC
        ADC     LB008,X
        STA     L00E2,X
.jmp_B19C
        INY
.code_B19D
        TYA
        STA     L00EE,X
        LDY     LB041,X
        LDA     LB6DF,Y
        AND     #$80
        BNE     code_B1BF

        LDA     LB6DF,Y
        AND     #$0F
        STA     LB017,X
        LDA     LB6DF,Y
        AND     #$70
        STA     LB014,X
        LDA     #$00
        STA     LB011,X
.code_B1BF
        LDA     #$FF
        STA     LB050,X
        LDA     LB6F4,Y
        STA     LB04D,X
        LDA     LB709,Y
        STA     LB056,X
        LDA     LB71E,Y
        STA     LB059,X
        LDA     LB772,Y
        STA     LB03E,X
        BPL     code_B1E3

        LDA     #$09
        STA     LB04D,X
.code_B1E3
        JSR     jsr_B49C

        JMP     jmp_B110

.jmp_B1E9
        TXA
        ASL     A
        TAY
        LDA     LB569,Y
        STA     L00E0
        LDA     LB56A,Y
        STA     L00E1
        LDY     L00FB,X
        LDA     (L00E0),Y
        CMP     #$FF
        BNE     code_B204

        INY
        LDA     (L00E0),Y
        TAY
        LDA     (L00E0),Y
.code_B204
        CMP     #$FE
        BNE     code_B211

        LDA     #$00
        STA     L00F1,X
        STA     L00F4,X
        STA     L00F7,X
        RTS

.code_B211
        CMP     #$80
        BCC     code_B220

        AND     #$7F
        CLC
        ADC     #$01
        STA     LB008,X
        INY
        LDA     (L00E0),Y
.code_B220
        CMP     #$70
        BCC     code_B22C

        AND     #$0F
        STA     LB044,X
        INY
        LDA     (L00E0),Y
.code_B22C
        CMP     #$60
        BCC     code_B238

        AND     #$0F
        STA     LB00B,X
        INY
        LDA     (L00E0),Y
.code_B238
        STA     L00EB,X
        INY
        TYA
        STA     L00FB,X
        INC     LB00B,X
        JMP     jmp_B114

.jmp_B244
        LDA     LB00E,X
        BNE     code_B287

        LDA     LB047,X
        STA     L00E5,X
        LDY     LB041,X
        LDA     LB733,Y
        LSR     A
        LSR     A
        LSR     A
        STA     LB053,X
        LDA     LB047,X
        SEC
        SBC     LB053,X
        BCS     code_B269

        LDA     LB047,X
        STA     LB053,X
.code_B269
        LDA     LB748,Y
        STA     LB038,X
        LDA     LB75D,Y
        STA     LB03B,X
        AND     #$0F
        STA     LB01D,X
        LDA     #$00
        STA     LB032,X
        STA     LB035,X
        LDA     #$01
        STA     LB00E,X
.code_B287
        LDA     L00E5,X
        CMP     LB053,X
        BCS     code_B293

        LDA     #$FE
        STA     LB050,X
.code_B293
        LDA     LB00E,X
        CMP     #$02
        BEQ     code_B2A2

        BCS     code_B2DF

        INC     LB00E,X
        JMP     jmp_B3DC

.code_B2A2
        LDA     L00E8,X
        AND     #$0F
        STA     LB029,X
        LDA     L00E8,X
        AND     #$F0
        STA     L00E8,X
        LDA     LB047,X
        SEC
        SBC     LB029,X
        STA     LB029,X
        LDA     LB02F,X
        SEC
        SBC     L00E2,X
        STA     LB02C,X
        LDA     LB047,X
        SEC
        SBC     LB01D,X
        STA     LB01D,X
        LDA     LB047,X
        CMP     LB01D,X
        BCS     code_B2D9

        LDA     #$00
        STA     LB038,X
.code_B2D9
        INC     LB00E,X
        JMP     jmp_B3DC

.code_B2DF
        LDA     L00E8,X
        BEQ     code_B352

        LDA     LB029,X
        CMP     L00E5,X
        BCC     code_B34F

        LDA     L00E8,X
        CMP     #$F0
        BEQ     code_B2FC

        ASL     A
        STA     L00E0
        LDA     #$00
        ADC     #$00
        STA     L00E1
        JMP     jmp_B304

.code_B2FC
        LDA     #$04
        STA     L00E1
        LDA     #$00
        STA     L00E0
.jmp_B304
        LDY     LB02F,X
        LDA     LB02C,X
        BMI     code_B329

        LDA     L00F1,X
        CLC
        ADC     L00E0
        STA     L00F1,X
        LDA     L00F4,X
        ADC     L00E1
        STA     L00F4,X
        LDA     L00F1,X
        SEC
        SBC     LB4A9,Y
        LDA     L00F4,X
        SBC     LB509,Y
        BCC     code_B34F

        JMP     jmp_B343

.code_B329
        LDA     L00F1,X
        SEC
        SBC     L00E0
        STA     L00F1,X
        LDA     L00F4,X
        SBC     L00E1
        STA     L00F4,X
        LDA     L00F1,X
        SEC
        SBC     LB4A9,Y
        LDA     L00F4,X
        SBC     LB509,Y
        BCS     code_B34F

.jmp_B343
        LDA     LB02F,X
        STA     L00E2,X
        JSR     jsr_B49C

        LDA     #$00
        STA     L00E8,X
.code_B34F
        JMP     jmp_B3DC

.code_B352
        LDA     LB038,X
        BNE     code_B35A

.code_B357
        JMP     jmp_B3DC

.code_B35A
        LDA     LB047,X
        CMP     #$08
        BCC     code_B357

        LDA     LB00E,X
        CMP     #$04
        BCS     code_B3A4

        INC     LB00E,X
        LDA     #$00
        STA     LB01A,X
        LDA     LB038,X
        AND     #$0F
        LSR     A
        ADC     #$00
        STA     LB026,X
        LDY     L00E2,X
        LDA     LB4A9,Y
        SEC
        SBC     LB4A8,Y
        STA     LB020,X
        LDA     LB509,Y
        SBC     LB508,Y
        STA     LB023,X
        LDA     LB038,X
        LSR     A
        LSR     A
        LSR     A
        LSR     A
        TAY
.jmp_B398
        DEY
        BMI     jmp_B3DC

        LSR     LB023,X
        ROR     LB020,X
        JMP     jmp_B398

.code_B3A4
        DEC     LB026,X
        BPL     code_B3B4

        LDA     LB038,X
        AND     #$0F
        STA     LB026,X
        INC     LB01A,X
.code_B3B4
        LDA     LB01A,X
        AND     #$01
        BNE     code_B3CD

        LDA     L00F1,X
        CLC
        ADC     LB020,X
        STA     L00F1,X
        LDA     L00F4,X
        ADC     LB023,X
        STA     L00F4,X
        JMP     jmp_B3DC

.code_B3CD
        LDA     L00F1,X
        SEC
        SBC     LB020,X
        STA     L00F1,X
        LDA     L00F4,X
        SBC     LB023,X
        STA     L00F4,X
.jmp_B3DC
        LDA     LB03E,X
        BPL     code_B409

        AND     #$0F
        TAY
        LDA     LB59F,Y
        STA     L00E0
        LDA     LB5AF,Y
        STA     L00E1
        LDY     LB032,X
        LDA     (L00E0),Y
        CMP     #$FE
        BEQ     code_B409

        CMP     #$FF
        BNE     code_B401

        INY
        LDA     (L00E0),Y
        TAY
        LDA     (L00E0),Y
.code_B401
        STA     LB04D,X
        INY
        TYA
        STA     LB032,X
.code_B409
        LDA     LB03E,X
        TAY
        AND     #$C0
        BEQ     code_B454

        TYA
        CMP     #$C0
        BCS     code_B41A

        AND     #$8F
        BNE     code_B423

.code_B41A
        LDA     LB04A,X
        CLC
        ADC     #$10
        JMP     code_B425

.code_B423
        AND     #$0F
.code_B425
        TAY
        LDA     LB5BF,Y
        STA     L00E0
        LDA     LB5EF,Y
        STA     L00E1
        LDY     LB035,X
        LDA     (L00E0),Y
        CMP     #$FE
        BEQ     code_B454

        CMP     #$FF
        BNE     code_B446

        INY
        LDA     (L00E0),Y
        STA     LB035,X
        TAY
        LDA     (L00E0),Y
.code_B446
        BMI     code_B44B

        CLC
        ADC     L00E2,X
.code_B44B
        AND     #$7F
        TAY
        JSR     code_B49E

        INC     LB035,X
.code_B454
        LDA     LB03B,X
        AND     #$F0
        BEQ     code_B498

        LSR     A
        STA     LB469
        LDA     LB011,X
        BNE     code_B47F

        LDA     LB014,X
        CLC
.LB468
        ADC     #$00
LB469 = LB468+1
        STA     LB014,X
        LDA     LB017,X
        ADC     #$00
        STA     LB017,X
        CMP     #$0F
        BCC     code_B498

        INC     LB011,X
        JMP     code_B498

.code_B47F
        LDA     LB014,X
        SEC
        SBC     LB469
        STA     LB014,X
        LDA     LB017,X
        SBC     #$00
        STA     LB017,X
        CMP     #$01
        BCS     code_B498

        DEC     LB011,X
.code_B498
        JMP     jmp_B110

        EQUB    $60

.jsr_B49C
        LDY     L00E2,X
.code_B49E
        LDA     LB4A9,Y
        STA     L00F1,X
        LDA     LB509,Y
        STA     L00F4,X
.LB4A8
        RTS

.LB4A9
        EQUB    $0C,$1C,$2D,$3E,$51,$66,$7B,$91
        EQUB    $A9,$C3,$DD,$FA,$18,$38,$5A,$7D
        EQUB    $A3,$CC,$F6,$23,$53,$86,$BB,$F4
        EQUB    $30,$70,$B4,$FB,$47,$98,$ED,$47
        EQUB    $A7,$0C,$77,$E9,$61,$E1,$68,$F7
        EQUB    $8F,$30,$DA,$8F,$4E,$18,$EF,$D2
        EQUB    $C3,$C3,$D1,$EF,$1F,$60,$B5,$1E
        EQUB    $9C,$31,$DF,$A5,$87,$86,$A2,$DF
        EQUB    $3E,$C1,$6B,$3C,$39,$63,$BE,$4B
        EQUB    $0F,$0C,$45,$BF,$7D,$83,$D6,$79
        EQUB    $73,$C7,$7C,$97,$1E,$18,$8B,$7E
        EQUB    $FA,$06,$AC,$F3,$E6,$8F,$F8

.LB508
        EQUB    $2E

.LB509
        EQUB    $01,$01,$01,$01,$01,$01,$01,$01
        EQUB    $01,$01,$01,$01,$02,$02,$02,$02
        EQUB    $02,$02,$02,$03,$03,$03,$03,$03
        EQUB    $04,$04,$04,$04,$05,$05,$05,$06
        EQUB    $06,$07,$07,$07,$08,$08,$09,$09
        EQUB    $0A,$0B,$0B,$0C,$0D,$0E,$0E,$0F
        EQUB    $10,$11,$12,$13,$15,$16,$17,$19
        EQUB    $1A,$1C,$1D,$1F,$21,$23,$25,$27
        EQUB    $2A,$2C,$2F,$32,$35,$38,$3B,$3F
        EQUB    $43,$47,$4B,$4F,$54,$59,$5E,$64
        EQUB    $6A,$70,$77,$7E,$86,$8E,$96,$9F
        EQUB    $A8,$B3,$BD,$C8,$D4,$E1,$EE,$FD

.LB569
        EQUB    $87

.LB56A
        EQUB    $B7,$FC,$B7,$32,$B8,$02,$02

.LB571
        EQUB    $98,$62,$15,$19,$08,$11,$1D,$40
        EQUB    $5E,$89,$B7,$C2,$8C,$27,$4B,$75
        EQUB    $81,$0B,$9A,$10,$33,$61,$8F

.LB588
        EQUB    $BD,$B8,$B9,$B9,$B9,$B9,$B9,$B9
        EQUB    $B9,$B9,$B9,$B9,$BA,$BB,$BB,$BB
        EQUB    $BB,$BC,$BC,$BD,$BD,$BD,$BD

.LB59F
        EQUB    $1F,$25,$2A,$32,$46,$48,$50,$50
        EQUB    $50,$50,$50,$50,$50,$50,$50,$50

.LB5AF
        EQUB    $B6,$B6,$B6,$B6,$B6,$B6,$B6,$B6
        EQUB    $B6,$B6,$B6,$B6,$B6,$B6,$B6,$B6

.LB5BF
        EQUB    $22,$29,$2D,$3C,$47,$4C,$50,$50
        EQUB    $50,$50,$50,$50,$50,$50,$50,$50
        EQUB    $50,$55,$5A,$5F,$64,$69,$6E,$73
        EQUB    $78,$82,$8A,$92,$9A,$A2,$AA,$B2
        EQUB    $BA,$C9,$BF,$D3,$DF,$DF,$DF,$DF
        EQUB    $DF,$DF,$DF,$DF,$DF,$DF,$DF,$DF

.LB5EF
        EQUB    $B6,$B6,$B6,$B6,$B6,$B6,$B6,$B6
        EQUB    $B6,$B6,$B6,$B6,$B6,$B6,$B6,$B6
        EQUB    $B6,$B6,$B6,$B6,$B6,$B6,$B6,$B6
        EQUB    $B6,$B6,$B6,$B6,$B6,$B6,$B6,$B6
        EQUB    $B6,$B6,$B6,$B6,$B6,$B6,$B6,$B6
        EQUB    $B6,$B6,$B6,$B6,$B6,$B6,$B6,$B6
        EQUB    $81,$41,$FE,$DF,$00,$FE,$11,$41
        EQUB    $21,$41,$FE,$81,$41,$FE,$DF,$A8
        EQUB    $98,$00,$FE,$81,$41,$41,$81,$81
        EQUB    $81,$81,$81,$11,$FE,$DF,$AC,$AA
        EQUB    $DF,$CF,$DF,$CF,$DF,$AC,$FE,$41
        EQUB    $FE,$81,$15,$81,$FE,$00,$C6,$00
        EQUB    $FE,$00,$03,$07,$FF,$00,$00,$04
        EQUB    $07,$FF,$00,$00,$05,$08,$FF,$00
        EQUB    $00,$05,$09,$FF,$00,$00,$03,$08
        EQUB    $FF,$00,$00,$04,$09,$FF,$00,$00
        EQUB    $05,$07,$FF,$00,$00,$02,$07,$FF
        EQUB    $00,$0C,$0C,$07,$07,$02,$02,$00
        EQUB    $00,$FF,$00,$05,$05,$05,$00,$00
        EQUB    $00,$FF,$00,$06,$06,$06,$00,$00
        EQUB    $00,$FF,$00,$07,$07,$07,$00,$00
        EQUB    $00,$FF,$00,$08,$08,$08,$00,$00
        EQUB    $00,$FF,$00,$09,$09,$09,$00,$00
        EQUB    $00,$FF,$00,$03,$03,$03,$00,$00
        EQUB    $00,$FF,$00,$04,$04,$04,$00,$00
        EQUB    $00,$FF,$00,$00,$03,$06,$FF,$00
        EQUB    $0C,$0C,$08,$08,$05,$05,$00,$00
        EQUB    $FF,$00,$0C,$0C,$07,$07,$04,$04
        EQUB    $00,$00,$FF,$00,$00,$00,$02,$02
        EQUB    $07,$07,$0C,$0C,$0E,$0E,$FF,$00

.LB6DF
        EQUB    $00,$02,$08,$08,$83,$83,$08,$08
        EQUB    $81,$81,$81,$81,$00,$00,$00,$00
        EQUB    $03,$03,$03,$03,$00

.LB6F4
        EQUB    $00,$41,$41,$41,$41,$41,$41,$41
        EQUB    $41,$41,$41,$41,$81,$81,$81,$81
        EQUB    $41,$41,$41,$41,$13

.LB709
        EQUB    $00,$08,$08,$0F,$08,$00,$00,$00
        EQUB    $00,$00,$00,$00,$0F,$03,$0F,$03
        EQUB    $09,$00,$08,$00,$00

.LB71E
        EQUB    $00,$89,$89,$D9,$79,$39,$59,$19
        EQUB    $59,$19,$59,$19,$DA,$D3,$D9,$D3
        EQUB    $99,$69,$89,$59,$69

.LB733
        EQUB    $F0,$10,$10,$F0,$10,$10,$00,$00
        EQUB    $00,$00,$F0,$F0,$F0,$F0,$F0,$F0
        EQUB    $10,$10,$10,$10,$10

.LB748
        EQUB    $00,$34,$34,$00,$00,$00,$24,$24
        EQUB    $24,$24,$24,$24,$00,$00,$00,$00
        EQUB    $33,$33,$00,$00,$00

.LB75D
        EQUB    $00,$24,$24,$00,$F0,$F0,$08,$08
        EQUB    $18,$18,$18,$18,$00,$00,$00,$00
        EQUB    $F6,$F6,$F0,$F0,$00

.LB772
        EQUB    $00,$80,$82,$83,$C4,$C4,$00,$00
        EQUB    $00,$00,$00,$00,$85,$85,$85,$85
        EQUB    $81,$81,$C1,$C1,$00,$91,$01,$04
        EQUB    $91,$06,$8F,$06,$8D,$06,$8F,$06
        EQUB    $91,$06,$8F,$06,$8D,$06,$8F,$06
        EQUB    $91,$06,$8F,$06,$8D,$06,$8F,$06
        EQUB    $91,$06,$8F,$06,$8D,$06,$8F,$06
        EQUB    $91,$06,$8F,$06,$8D,$06,$8F,$06
        EQUB    $91,$06,$8F,$06,$8D,$06,$8C,$0D
        EQUB    $91,$06,$8F,$06,$8D,$06,$8F,$06
        EQUB    $91,$06,$8F,$06,$8D,$06,$8F,$06
        EQUB    $91,$06,$8F,$06,$8D,$06,$8F,$06
        EQUB    $91,$06,$8F,$06,$8D,$06,$8F,$06
        EQUB    $91,$06,$8F,$06,$8D,$06,$8C,$0D
        EQUB    $91,$06,$8F,$06,$8D,$06,$8C,$0D
        EQUB    $91,$13,$8F,$13,$8D,$13,$8F,$13
        EQUB    $91,$13,$8F,$13,$8D,$13,$8F,$13
        EQUB    $FF,$03,$91,$02,$71,$01,$05,$85
        EQUB    $70,$07,$07,$85,$67,$09,$85,$09
        EQUB    $14,$15,$14,$85,$09,$14,$15,$0E
        EQUB    $85,$63,$09,$85,$09,$14,$15,$0E
        EQUB    $85,$09,$14,$15,$14,$85,$09,$14
        EQUB    $15,$14,$85,$62,$09,$0E,$85,$09
        EQUB    $14,$15,$0E,$85,$67,$09,$FF,$05
        EQUB    $91,$03,$67,$00,$16,$80,$08,$08
        EQUB    $80,$0F,$66,$0A,$0F,$66,$0A,$91
        EQUB    $0B,$0C,$80,$0F,$66,$0A,$0F,$66
        EQUB    $0A,$85,$10,$11,$12,$12,$91,$06
        EQUB    $8F,$06,$8D,$06,$8F,$06,$91,$06
        EQUB    $8F,$06,$8D,$06,$8F,$06,$FF,$05
        EQUB    $C6,$82,$4B,$4A,$46,$43,$4A,$46
        EQUB    $43,$41,$46,$43,$41,$3F,$43,$3F
        EQUB    $3E,$3A,$3F,$3E,$3A,$37,$3E,$3A
        EQUB    $37,$35,$3A,$37,$35,$33,$37,$35
        EQUB    $33,$32,$33,$2E,$2B,$33,$2E,$2B
        EQUB    $35,$32,$33,$30,$2B,$33,$30,$2B
        EQUB    $32,$33,$35,$2E,$29,$33,$2E,$29
        EQUB    $35,$2E,$32,$2E,$29,$32,$33,$32
        EQUB    $30,$2E,$83,$30,$2C,$27,$32,$2C
        EQUB    $27,$33,$2C,$27,$33,$2C,$27,$32
        EQUB    $2C,$30,$2C,$84,$2F,$2B,$26,$30
        EQUB    $2B,$26,$32,$2F,$2B,$33,$30,$2B
        EQUB    $85,$35,$32,$38,$37,$A8,$FD,$80
        EQUB    $3A,$3C,$C8,$81,$3F,$3C,$3A,$37
        EQUB    $36,$35,$33,$30,$3C,$3A,$37,$36
        EQUB    $35,$33,$30,$2E,$37,$36,$35,$33
        EQUB    $30,$2E,$2B,$2A,$35,$33,$30,$2E
        EQUB    $2B,$2A,$29,$27,$33,$30,$2E,$2B
        EQUB    $2A,$29,$27,$24,$30,$2E,$2B,$2A
        EQUB    $29,$27,$24,$22,$2E,$2B,$2A,$29
        EQUB    $27,$24,$22,$1F,$2B,$FF,$2A,$29
        EQUB    $27,$24,$22,$CA,$82,$1F,$FF,$CA
        EQUB    $82,$2A,$FF,$C0,$85,$00,$FF,$C0
        EQUB    $9C,$00,$FF,$C4,$82,$68,$24,$C4
        EQUB    $C4,$84,$C4,$C5,$82,$C4,$84,$C5
        EQUB    $82,$C4,$84,$C5,$C4,$C4,$82,$C4
        EQUB    $C4,$84,$C4,$C5,$82,$C4,$84,$C5
        EQUB    $82,$C4,$84,$C5,$C4,$FF,$C2,$89
        EQUB    $0C,$C0,$B1,$C2,$86,$0A,$89,$0C
        EQUB    $C0,$B1,$C2,$86,$0F,$89,$0C,$C0
        EQUB    $B1,$C2,$86,$0A,$89,$0C,$C0,$AF
        EQUB    $C2,$88,$0F,$FF,$CC,$A0,$5E,$D4
        EQUB    $9A,$FD,$10,$30,$01,$CC,$86,$5E
        EQUB    $A0,$D4,$9A,$FD,$20,$18,$5F,$CC
        EQUB    $86,$5E,$A0,$D4,$9A,$FD,$10,$30
        EQUB    $01,$CC,$86,$5E,$A0,$D4,$98,$FD
        EQUB    $20,$18,$5F,$CC,$88,$5E,$FF,$C2
        EQUB    $84,$0C,$C1,$82,$C1,$18,$C3,$C1
        EQUB    $C1,$84,$0C,$C2,$16,$C1,$18,$C3
        EQUB    $C1,$82,$0A,$0B,$C2,$84,$0C,$C1
        EQUB    $82,$C1,$18,$C3,$C1,$C1,$84,$0C
        EQUB    $C2,$88,$FD,$44,$18,$01,$C3,$84
        EQUB    $C1,$82,$11,$0F,$FF,$CD,$84,$5E
        EQUB    $5E,$5E,$5E,$5E,$5E,$5E,$5E,$FF
        EQUB    $D0,$84,$33,$D1,$30,$D0,$30,$8C
        EQUB    $FD,$F1,$2E,$30,$82,$2B,$D1,$30
        EQUB    $D0,$88,$2E,$84,$30,$D1,$2E,$2B
        EQUB    $24,$D0,$82,$2B,$D1,$24,$D0,$84
        EQUB    $2E,$82,$30,$D1,$2E,$D0,$84,$FD
        EQUB    $F1,$33,$35,$D1,$33,$D0,$D1,$35
        EQUB    $D0,$88,$FD,$F1,$30,$32,$82,$33
        EQUB    $D1,$32,$D0,$98,$FD,$F1,$30,$32
        EQUB    $82,$2B,$D1,$32,$D0,$84,$2E,$82
        EQUB    $30,$D1,$2E,$D0,$84,$33,$D1,$30
        EQUB    $D0,$82,$2E,$D1,$30,$D0,$88,$FD
        EQUB    $F1,$2E,$30,$82,$2B,$D1,$32,$D0
        EQUB    $84,$2E,$82,$30,$D1,$2E,$D0,$88
        EQUB    $FD,$F1,$35,$37,$82,$3A,$D1,$37
        EQUB    $D0,$88,$FD,$F1,$36,$35,$82,$33
        EQUB    $D1,$35,$D0,$84,$FD,$F1,$33,$35
        EQUB    $82,$33,$D1,$35,$D0,$84,$FD,$F1
        EQUB    $35,$37,$82,$30,$D1,$37,$D0,$88
        EQUB    $FD,$F1,$2E,$30,$84,$FD,$F1,$2E
        EQUB    $30,$82,$33,$D1,$30,$D0,$84,$FD
        EQUB    $F1,$33,$35,$82,$36,$D1,$35,$D0
        EQUB    $84,$FD,$F1,$36,$37,$82,$30,$D1
        EQUB    $37,$D0,$84,$FD,$F1,$2E,$30,$82
        EQUB    $2E,$D1,$30,$D0,$88,$FD,$F1,$2E
        EQUB    $30,$D2,$84,$69,$2E,$82,$2B,$D3
        EQUB    $2E,$FF,$D2,$8C,$69,$2E,$88,$2B
        EQUB    $D3,$84,$D2,$2E,$82,$2B,$D3,$2E
        EQUB    $D2,$8C,$88,$2B,$D3,$84,$D2,$84
        EQUB    $2E,$82,$2B,$D3,$2E,$D2,$88,$6D
        EQUB    $82,$6B,$2E,$D3,$6D,$D2,$88,$6D
        EQUB    $82,$6B,$D3,$6D,$D2,$88,$82,$6B
        EQUB    $D3,$6D,$D2,$84,$69,$6B,$82,$69
        EQUB    $D3,$6B,$D2,$84,$6C,$6B,$69,$82
        EQUB    $29,$D3,$2E,$D2,$84,$6F,$2C,$82
        EQUB    $D3,$D2,$D3,$D2,$D2,$86,$6E,$2B
        EQUB    $82,$6F,$2C,$D3,$6E,$2B,$D2,$84
        EQUB    $30,$82,$32,$D3,$30,$84,$82,$6F
        EQUB    $2C,$D3,$6E,$30,$D2,$84,$6F,$2C
        EQUB    $82,$6E,$2B,$86,$6F,$2C,$82,$2E
        EQUB    $D3,$2C,$D2,$84,$6E,$30,$82,$32
        EQUB    $D3,$30,$D2,$84,$60,$30,$82,$64
        EQUB    $D3,$60,$D2,$84,$82,$64,$D3,$60
        EQUB    $D2,$84,$82,$64,$D3,$60,$D2,$84
        EQUB    $82,$64,$D3,$60,$D2,$88,$64,$2F
        EQUB    $70,$62,$2B,$61,$FF,$C4,$82,$72
        EQUB    $24,$C4,$C4,$84,$C4,$C5,$82,$C4
        EQUB    $84,$C5,$82,$C4,$84,$C5,$C4,$C4
        EQUB    $82,$71,$C4,$C4,$84,$C4,$C5,$82
        EQUB    $C4,$84,$C5,$82,$C4,$84,$C5,$C4
        EQUB    $FF,$C2,$84,$07,$C1,$82,$C1,$13
        EQUB    $C3,$C1,$C1,$84,$07,$C2,$11,$C1
        EQUB    $13,$C3,$C1,$82,$05,$06,$C2,$84
        EQUB    $07,$C1,$82,$C1,$13,$C3,$C1,$C1
        EQUB    $84,$07,$C2,$13,$C3,$C3,$82,$C3
        EQUB    $C3,$84,$FF,$CC,$88,$5F,$CD,$84
        EQUB    $5F,$5F,$5F,$5F,$5F,$5F,$FF,$D0
        EQUB    $88,$FD,$F1,$2E,$30,$D1,$84,$FD
        EQUB    $F1,$2E,$30,$D0,$94,$FD,$F1,$2E
        EQUB    $30,$D1,$84,$FD,$F1,$2E,$30,$D0
        EQUB    $2E,$30,$33,$D0,$FD,$F1,$33,$35
        EQUB    $D0,$D0,$33,$30,$88,$FD,$F1,$35
        EQUB    $36,$84,$35,$33,$88,$FD,$F1,$33
        EQUB    $35,$82,$37,$D1,$35,$D0,$88,$33
        EQUB    $D0,$84,$30,$88,$FD,$F1,$2E,$30
        EQUB    $84,$FD,$F1,$2E,$30,$37,$3A,$37
        EQUB    $88,$FD,$F1,$3A,$3C,$86,$FD,$F1
        EQUB    $3A,$3C,$FD,$F2,$36,$35,$84,$33
        EQUB    $30,$8C,$FD,$F1,$3A,$3C,$86,$FD
        EQUB    $F1,$3A,$3C,$FD,$F2,$36,$35,$84
        EQUB    $33,$35,$36,$88,$FD,$F1,$36,$37
        EQUB    $82,$3A,$D1,$37,$D0,$88,$FD,$F1
        EQUB    $36,$35,$84,$33,$30,$2E,$30,$D1
        EQUB    $37,$35,$33,$30,$D0,$3A,$3C,$3F
        EQUB    $FF,$D0,$88,$FD,$F1,$3F,$41,$FD
        EQUB    $F1,$42,$41,$84,$3F,$3A,$3C,$8C
        EQUB    $FD,$F1,$3F,$41,$88,$FD,$F1,$42
        EQUB    $41,$84,$3F,$3A,$3C,$8C,$FD,$F1
        EQUB    $46,$48,$88,$46,$FD,$F1,$42,$43
        EQUB    $84,$46,$42,$D1,$41,$D0,$D0,$82
        EQUB    $3F,$D1,$41,$D0,$88,$FD,$F1,$3F
        EQUB    $41,$84,$3C,$3F,$41,$FD,$F1,$41
        EQUB    $42,$82,$41,$D1,$42,$D0,$84,$3F
        EQUB    $FD,$F1,$41,$42,$82,$41,$D1,$42
        EQUB    $D0,$84,$3F,$41,$43,$FD,$F1,$3F
        EQUB    $41,$3F,$82,$3C,$D1,$3F,$D0,$88
        EQUB    $3A,$82,$3C,$D1,$3A,$D0,$84,$3F
        EQUB    $82,$41,$D1,$3F,$D0,$88,$FD,$F1
        EQUB    $42,$43,$86,$46,$82,$48,$84,$FD
        EQUB    $F1,$42,$41,$3F,$82,$3C,$D1,$3F
        EQUB    $D0,$98,$FD,$F1,$46,$48,$82,$41
        EQUB    $43,$84,$46,$82,$48,$D1,$46,$FF
        EQUB    $D0,$98,$FD,$F1,$4A,$4B,$84,$48
        EQUB    $4B,$48,$3C,$3F,$41,$D0,$84,$FD
        EQUB    $F1,$41,$42,$82,$41,$FD,$F1,$42
        EQUB    $41,$84,$3F,$3C,$98,$FD,$F1,$48
        EQUB    $4A,$84,$46,$4A,$46,$3C,$3F,$41
        EQUB    $FD,$F1,$41,$42,$82,$41,$FD,$F1
        EQUB    $42,$41,$84,$3F,$3C,$D0,$88,$FD
        EQUB    $F1,$46,$48,$84,$46,$44,$46,$44
        EQUB    $82,$43,$D1,$44,$D0,$88,$FD,$F1
        EQUB    $42,$41,$84,$3F,$82,$42,$D1,$3F
        EQUB    $D0,$88,$FD,$F1,$3F,$41,$84,$43
        EQUB    $46,$48,$88,$FD,$F1,$48,$4A,$84
        EQUB    $4B,$88,$FD,$F1,$48,$4A,$84,$48
        EQUB    $47,$44,$8C,$FD,$F1,$41,$43,$84
        EQUB    $37,$3B,$3C,$3E,$43,$FF,$C4,$82
        EQUB    $73,$24,$C4,$C4,$84,$C4,$C5,$82
        EQUB    $C4,$84,$C5,$82,$C4,$84,$C5,$C4
        EQUB    $C4,$82,$C4,$C4,$84,$C4,$C5,$82
        EQUB    $C4,$84,$C5,$82,$C4,$84,$C5,$C4
        EQUB    $FF,$C2,$84,$0A,$C1,$82,$C1,$16
        EQUB    $C3,$C1,$C1,$84,$0A,$C2,$14,$C1
        EQUB    $16,$C3,$C1,$82,$08,$09,$C2,$84
        EQUB    $0A,$C1,$82,$C1,$16,$C3,$C1,$C1
        EQUB    $84,$0A,$C2,$88,$FD,$44,$16,$01
        EQUB    $C3,$84,$C1,$82,$0C,$07,$FF,$C2
        EQUB    $84,$08,$C1,$82,$C1,$14,$C3,$C1
        EQUB    $C1,$84,$08,$C2,$13,$C1,$14,$C3
        EQUB    $C1,$82,$07,$03,$C2,$84,$08,$C1
        EQUB    $82,$C1,$14,$C3,$C1,$C1,$84,$08
        EQUB    $C2,$88,$FD,$44,$14,$01,$C3,$84
        EQUB    $C1,$82,$08,$09,$FF,$D4,$BF,$FD
        EQUB    $10,$01,$5F,$C0,$81,$FF,$C0,$A0
        EQUB    $00,$FF,$A2,$4F,$BD,$8F,$D6,$48
        EQUB    $CA,$10,$F9,$A9,$C0,$8D,$B0,$BD
        EQUB    $A0,$20,$E8,$8A,$9D,$00,$E0,$CA
        EQUB    $D0,$FA,$EE,$B0,$BD,$88,$D0,$F4
        EQUB    $A2,$A8,$BD,$FF,$64,$9D,$8F,$CB
        EQUB    $BD,$A7,$65,$9D,$CF,$CC,$BD,$4F
        EQUB    $66,$9D,$0F,$CE,$BD,$F7,$66,$9D
        EQUB    $4F,$CF,$BD,$9F,$67,$9D,$8F,$D0
        EQUB    $BD,$47,$68,$9D,$CF,$D1,$BD,$EF
        EQUB    $68,$9D,$0F,$D3,$CA,$D0,$D3,$A2
        EQUB    $4F,$68,$9D,$78,$D9,$CA,$10,$F9
        EQUB    $20,$AC,$09,$A9,$72,$85,$16,$85
        EQUB    $12,$A9,$E1,$85,$17,$A9,$D9,$85
        EQUB    $13,$A9,$07,$85,$2D,$A0,$00,$A2
        EQUB    $15,$B9,$98,$69,$91,$16,$B9,$2B
        EQUB    $6A,$91,$12,$A9,$05,$9D,$2E,$DB
        EQUB    $C8,$CA,$D0,$ED,$A5,$16,$18,$69
        EQUB    $13,$85,$16,$85,$12,$90,$04,$E6
        EQUB    $17,$E6,$13,$C6,$2D,$D0,$D8,$A9
        EQUB    $3B,$8D,$11,$D0,$A9,$18,$8D,$16
        EQUB    $D0,$A9,$81,$8D,$18,$D0,$20,$0F
        EQUB    $18,$E8,$D0,$FA,$60,$00,$00,$00
        EQUB    $00,$00,$00,$00,$00,$00,$4C,$71
        EQUB    $90,$4C,$99,$90,$4C,$B4,$90,$00
        EQUB    $00,$01,$02,$02,$02,$01,$01,$01
        EQUB    $00,$00,$00,$70,$70,$70,$08,$08
        EQUB    $08,$00,$03,$16,$FE,$FE,$FE,$00
        EQUB    $23,$BF,$00,$00,$00,$00,$00,$00
        EQUB    $02,$02,$02,$EE,$EE,$EC,$00,$00
        EQUB    $00,$02,$02,$02,$03,$03,$03,$10
        EQUB    $10,$10,$00,$00,$00,$14,$14,$14
        EQUB    $82,$82,$82,$05,$05,$05,$00,$00
        EQUB    $00,$02,$02,$02,$08,$08,$01,$00
        EQUB    $00,$00,$41,$41,$41,$FE,$FE,$FE
        EQUB    $02,$02,$02,$06,$06,$06,$69,$69
        EQUB    $69,$00,$00,$00,$01,$01,$01,$00
        EQUB    $00,$00,$00,$0F,$00,$07,$0E,$A9
        EQUB    $08,$8D,$04,$D4,$8D,$0B,$D4,$8D
        EQUB    $12,$D4,$A9,$00,$A2,$16,$9D,$00
        EQUB    $D4,$CA,$10,$FA,$8D,$09,$90,$A9
        EQUB    $F0,$8D,$17,$D4,$A9,$0F,$8D,$6D
        EQUB    $90,$A9,$01,$8D,$0B,$90,$60,$95
        EQUB    $E6,$A9,$01,$95,$F7,$95,$E0,$9D
        EQUB    $18,$90,$A9,$00,$9D,$0C,$90,$95
        EQUB    $EB,$95,$FA,$9D,$48,$90,$8D,$E1
        EQUB    $90,$60,$AD,$0B,$90,$F0,$23,$AC
        EQUB    $09,$90,$F0,$1F,$CE,$0A,$90,$10
        EQUB    $1A,$8C,$0A,$90,$CE,$6D,$90,$10
        EQUB    $12,$A9,$00,$8D,$04,$D4,$8D,$0B
        EQUB    $D4,$8D,$12,$D4,$8D,$0B,$90,$8D
        EQUB    $09,$90,$60,$AD,$6D,$90,$09,$00
        EQUB    $8D,$18,$D4,$AD,$6C,$90,$8D,$16
        EQUB    $D4,$A2,$02,$BC,$6E,$90,$B5,$F1
        EQUB    $99,$00,$D4,$B5,$F4,$99,$01,$D4
        EQUB    $BD,$18,$90,$99,$03,$D4,$BD,$15
        EQUB    $90,$99,$02,$D4,$BD,$60,$90,$99
        EQUB    $06,$D4,$BD,$5D,$90,$99,$05,$D4
        EQUB    $BD,$54,$90,$3D,$57,$90,$99,$04
        EQUB    $D4,$CA,$10,$CF,$AD,$0B,$90,$D0
        EQUB    $01,$60,$A2,$00,$20,$2E,$91,$E8
        EQUB    $20,$2E,$91,$E8,$B5,$F7,$F0,$11
        EQUB    $DE,$0C,$90,$10,$09,$A9,$02,$9D
        EQUB    $0C,$90,$D6,$E0,$F0,$04,$4C,$91
        EQUB    $92,$60,$A9,$00,$9D,$0F,$90,$95
        EQUB    $EE,$B4,$E6,$B9,$CE,$95,$85,$E9
        EQUB    $B9,$0E,$96,$85,$EA,$B4,$EB,$B1
        EQUB    $E9,$C9,$FF,$D0,$06,$C8,$B1,$E9
        EQUB    $A8,$B1,$E9,$C9,$FE,$D0,$09,$A9
        EQUB    $00,$95,$F1,$95,$F4,$95,$F7,$60
        EQUB    $C9,$FB,$D0,$08,$C8,$B1,$E9,$95
        EQUB    $FA,$C8,$B1,$E9,$C9,$FA,$D0,$09
        EQUB    $C8,$B1,$E9,$9D,$48,$90,$C8,$B1
        EQUB    $E9,$C9,$FC,$D0,$1A,$B5,$FA,$F0
        EQUB    $09,$D6,$FA,$A0,$02,$B1,$E9,$4C
        EQUB    $A9,$91,$C8,$B1,$E9,$95,$E6,$C8
        EQUB    $B1,$E9,$95,$EB,$4C,$4B,$91,$C9
        EQUB    $FD,$D0,$13,$C8,$B1,$E9,$95,$EE
        EQUB    $C8,$B1,$E9,$95,$E3,$C8,$B1,$E9
        EQUB    $9D,$30,$90,$4C,$FE,$91,$C9,$C0
        EQUB    $90,$14,$18,$7D,$48,$90,$29,$3F
        EQUB    $9D,$45,$90,$C8,$B1,$E9,$C9,$FD
        EQUB    $F0,$D5,$C9,$C0,$B0,$27,$C9,$80
        EQUB    $90,$10,$29,$3F,$9D,$4B,$90,$C8
        EQUB    $B1,$E9,$C9,$FD,$F0,$C1,$C9,$80
        EQUB    $B0,$13,$C9,$60,$90,$0C,$29,$1F
        EQUB    $9D,$4E,$90,$C8,$B1,$E9,$C9,$60
        EQUB    $B0,$03,$95,$E3,$C8,$94,$EB,$BC
        EQUB    $45,$90,$B9,$0C,$9A,$9D,$54,$90
        EQUB    $B9,$20,$9B,$9D,$42,$90,$10,$05
        EQUB    $A9,$09,$9D,$54,$90,$B9,$DE,$99
        EQUB    $29,$80,$D0,$15,$B9,$DE,$99,$29
        EQUB    $0F,$9D,$18,$90,$B9,$0C,$9A,$29
        EQUB    $70,$9D,$15,$90,$A9,$00,$9D,$12
        EQUB    $90,$A9,$FF,$9D,$57,$90,$B9,$3A
        EQUB    $9A,$9D,$5D,$90,$B9,$68,$9A,$9D
        EQUB    $60,$90,$B9,$C4,$9A,$9D,$3C,$90
        EQUB    $B9,$F2,$9A,$9D,$3F,$90,$29,$0F
        EQUB    $9D,$1E,$90,$BD,$4B,$90,$95,$E0
        EQUB    $20,$01,$95,$B5,$EE,$29,$0F,$9D
        EQUB    $2A,$90,$B5,$EE,$29,$F0,$95,$EE
        EQUB    $BD,$4B,$90,$38,$FD,$2A,$90,$9D
        EQUB    $2A,$90,$BD,$30,$90,$38,$F5,$E3
        EQUB    $9D,$2D,$90,$A9,$00,$9D,$33,$90
        EQUB    $9D,$36,$90,$9D,$63,$90,$9D,$51
        EQUB    $90,$A9,$01,$9D,$66,$90,$60,$BD
        EQUB    $0F,$90,$D0,$39,$BC,$45,$90,$B9
        EQUB    $96,$9A,$9D,$39,$90,$4A,$4A,$9D
        EQUB    $5A,$90,$BD,$4B,$90,$38,$FD,$5A
        EQUB    $90,$B0,$06,$BD,$4B,$90,$9D,$5A
        EQUB    $90,$BD,$4B,$90,$38,$FD,$1E,$90
        EQUB    $9D,$1E,$90,$BD,$4B,$90,$DD,$1E
        EQUB    $90,$B0,$05,$A9,$00,$9D,$3C,$90
        EQUB    $A9,$01,$9D,$0F,$90,$B5,$E0,$DD
        EQUB    $5A,$90,$B0,$05,$A9,$FE,$9D,$57
        EQUB    $90,$B5,$EE,$F0,$60,$BD,$2A,$90
        EQUB    $D5,$E0,$90,$56,$B5,$EE,$0A,$85
        EQUB    $E9,$A9,$00,$69,$00,$85,$EA,$BC
        EQUB    $30,$90,$BD,$2D,$90,$30,$1D,$B5
        EQUB    $F1,$18,$65,$E9,$95,$F1,$B5,$F4
        EQUB    $65,$EA,$95,$F4,$B5,$F1,$38,$F9
        EQUB    $0E,$95,$B5,$F4,$F9,$6E,$95,$90
        EQUB    $29,$4C,$30,$93,$B5,$F1,$38,$E5
        EQUB    $E9,$95,$F1,$B5,$F4,$E5,$EA,$95
        EQUB    $F4,$B5,$F1,$38,$F9,$0E,$95,$B5
        EQUB    $F4,$F9,$6E,$95,$B0,$0C,$BD,$30
        EQUB    $90,$95,$E3,$20,$01,$95,$A9,$00
        EQUB    $95,$EE,$4C,$C9,$93,$BD,$3C,$90
        EQUB    $D0,$03,$4C,$C9,$93,$BD,$1E,$90
        EQUB    $D5,$E0,$90,$7B,$BD,$0F,$90,$C9
        EQUB    $02,$B0,$3C,$FE,$0F,$90,$A9,$00
        EQUB    $9D,$1B,$90,$BD,$3C,$90,$29,$0F
        EQUB    $4A,$69,$00,$9D,$27,$90,$B4,$E3
        EQUB    $B9,$0E,$95,$38,$F9,$0D,$95,$9D
        EQUB    $21,$90,$B9,$6E,$95,$F9,$6D,$95
        EQUB    $9D,$24,$90,$BD,$3C,$90,$4A,$4A
        EQUB    $4A,$4A,$A8,$88,$30,$41,$5E,$24
        EQUB    $90,$7E,$21,$90,$4C,$85,$93,$DE
        EQUB    $27,$90,$10,$0B,$BD,$3C,$90,$29
        EQUB    $0F,$9D,$27,$90,$FE,$1B,$90,$BD
        EQUB    $1B,$90,$29,$01,$D0,$12,$B5,$F1
        EQUB    $18,$7D,$21,$90,$95,$F1,$B5,$F4
        EQUB    $7D,$24,$90,$95,$F4,$4C,$C9,$93
        EQUB    $B5,$F1,$38,$FD,$21,$90,$95,$F1
        EQUB    $B5,$F4,$FD,$24,$90,$95,$F4,$BD
        EQUB    $42,$90,$10,$28,$29,$1F,$A8,$B9
        EQUB    $66,$96,$85,$E9,$B9,$86,$96,$85
        EQUB    $EA,$BC,$33,$90,$B1,$E9,$C9,$FE
        EQUB    $F0,$12,$C9,$FF,$D0,$06,$C8,$B1
        EQUB    $E9,$A8,$B1,$E9,$9D,$54,$90,$C8
        EQUB    $98,$9D,$33,$90,$BD,$42,$90,$A8
        EQUB    $29,$C0,$F0,$43,$98,$C9,$C0,$B0
        EQUB    $04,$29,$9F,$D0,$09,$BD,$4E,$90
        EQUB    $18,$69,$20,$4C,$12,$94,$29,$1F
        EQUB    $A8,$B9,$A6,$96,$85,$E9,$B9,$E6
        EQUB    $96,$85,$EA,$BC,$36,$90,$B1,$E9
        EQUB    $C9,$FE,$F0,$1B,$C9,$FF,$D0,$09
        EQUB    $C8,$B1,$E9,$9D,$36,$90,$A8,$B1
        EQUB    $E9,$30,$03,$18,$75,$E3,$29,$7F
        EQUB    $A8,$20,$03,$95,$FE,$36,$90,$BD
        EQUB    $42,$90,$29,$20,$F0,$22,$B5,$E0
        EQUB    $C9,$0B,$B0,$1C,$A9,$00,$8D,$64
        EQUB    $94,$B4,$E3,$BD,$51,$90,$4A,$90
        EQUB    $04,$4A,$8D,$64,$94,$B9,$6E,$95
        EQUB    $38,$E9,$00,$95,$F4,$FE,$51,$90
        EQUB    $BD,$3F,$90,$29,$F0,$F0,$3C,$8D
        EQUB    $7E,$94,$BD,$12,$90,$D0,$1B,$BD
        EQUB    $15,$90,$18,$69,$10,$9D,$15,$90
        EQUB    $BD,$18,$90,$69,$00,$9D,$18,$90
        EQUB    $C9,$0F,$90,$1F,$FE,$12,$90,$4C
        EQUB    $AD,$94,$BD,$15,$90,$38,$ED,$7E
        EQUB    $94,$9D,$15,$90,$BD,$18,$90,$E9
        EQUB    $00,$9D,$18,$90,$C9,$01,$B0,$03
        EQUB    $DE,$12,$90,$BD,$39,$90,$29,$0F
        EQUB    $F0,$4C,$A8,$B9,$4D,$96,$85,$E9
        EQUB    $B9,$59,$96,$85,$EA,$BC,$63,$90
        EQUB    $D0,$0C,$B1,$E9,$8D,$E1,$90,$C8
        EQUB    $B1,$E9,$8D,$6C,$90,$C8,$BD,$66
        EQUB    $90,$D0,$1E,$B1,$E9,$C9,$FE,$F0
        EQUB    $25,$C9,$FF,$D0,$04,$C8,$B1,$E9
        EQUB    $A8,$B1,$E9,$9D,$66,$90,$C8,$B1
        EQUB    $E9,$9D,$69,$90,$C8,$98,$9D,$63
        EQUB    $90,$AD,$6C,$90,$18,$7D,$69,$90
        EQUB    $8D,$6C,$90,$DE,$66,$90,$60,$B4
        EQUB    $E3,$B9,$0E,$95,$95,$F1,$B9,$6E
        EQUB    $95,$95,$F4,$60,$0C,$1C,$2D,$3E
        EQUB    $51,$66,$7B,$91,$A9,$C3,$DD,$FA
        EQUB    $18,$38,$5A,$7D,$A3,$CC,$F6,$23
        EQUB    $53,$86,$BB,$F4,$30,$70,$B4,$FB
        EQUB    $47,$98,$ED,$47,$A7,$0C,$77,$E9
        EQUB    $61,$E1,$68,$F7,$8F,$30,$DA,$8F
        EQUB    $4E,$18,$EF,$D2,$C3,$C3,$D1,$EF
        EQUB    $1F,$60,$B5,$1E,$9C,$31,$DF,$A5
        EQUB    $87,$86,$A2,$DF,$3E,$C1,$6B,$3C
        EQUB    $39,$63,$BE,$4B,$0F,$0C,$45,$BF
        EQUB    $7D,$83,$D6,$79,$73,$C7,$7C,$97
        EQUB    $1E,$18,$8B,$7E,$FA,$06,$AC,$F3
        EQUB    $E6,$8F,$F8,$2E,$01,$01,$01,$01
        EQUB    $01,$01,$01,$01,$01,$01,$01,$01
        EQUB    $02,$02,$02,$02,$02,$02,$02,$03
        EQUB    $03,$03,$03,$03,$04,$04,$04,$04
        EQUB    $05,$05,$05,$06,$06,$07,$07,$07
        EQUB    $08,$08,$09,$09,$0A,$0B,$0B,$0C
        EQUB    $0D,$0E,$0E,$0F,$10,$11,$12,$13
        EQUB    $15,$16,$17,$19,$1A,$1C,$1D,$1F
        EQUB    $21,$23,$25,$27,$2A,$2C,$2F,$32
        EQUB    $35,$38,$3B,$3F,$43,$47,$4B,$4F
        EQUB    $54,$59,$5E,$64,$6A,$70,$77,$7E
        EQUB    $86,$8E,$96,$9F,$A8,$B3,$BD,$C8
        EQUB    $D4,$E1,$EE,$FD,$44,$4E,$05,$CE
        EQUB    $69,$17,$9C,$39,$D7,$29,$AC,$2F
        EQUB    $A0,$39,$8C,$0E,$63,$6C,$3B,$40
        EQUB    $81,$AA,$AE,$B3,$B8,$BC,$C0,$C5
        EQUB    $D2,$D9,$DE,$E3,$E7,$EB,$EF,$F3
        EQUB    $FB,$FF,$07,$0B,$12,$16,$1A,$1E
        EQUB    $23,$27,$2B,$2E,$32,$36,$3B,$3F
        EQUB    $44,$44,$44,$44,$44,$44,$44,$44
        EQUB    $44,$44,$44,$44,$A7,$9B,$9C,$9C
        EQUB    $9D,$9E,$9E,$9F,$9F,$A0,$A0,$A1
        EQUB    $A1,$A2,$A2,$A3,$A4,$A5,$A6,$A6
        EQUB    $A6,$A6,$A6,$A6,$A6,$A6,$A6,$A6
        EQUB    $A6,$A6,$A6,$A6,$A6,$A6,$A6,$A6
        EQUB    $A6,$A6,$A7,$A7,$A7,$A7,$A7,$A7
        EQUB    $A7,$A7,$A7,$A7,$A7,$A7,$A7,$A7
        EQUB    $A7,$A7,$A7,$A7,$A7,$A7,$A7,$A7
        EQUB    $A7,$A7,$A7,$A7,$D5,$DE,$DE,$DE
        EQUB    $DE,$DE,$DE,$DE,$DE,$DE,$DE,$DE
        EQUB    $99,$99,$99,$99,$99,$99,$99,$99
        EQUB    $99,$99,$99,$99,$26,$2C,$2F,$37
        EQUB    $43,$46,$58,$5E,$60,$90,$92,$CA
        EQUB    $CC,$CE,$D0,$D2,$EA,$F4,$05,$0A
        EQUB    $1D,$1D,$1D,$1D,$1D,$1D,$1D,$1D
        EQUB    $1D,$1D,$1D,$1D,$97,$97,$97,$97
        EQUB    $97,$97,$97,$97,$97,$97,$97,$97
        EQUB    $97,$97,$97,$97,$97,$97,$98,$98
        EQUB    $98,$98,$98,$98,$98,$98,$98,$98
        EQUB    $98,$98,$98,$98,$29,$2E,$32,$3D
        EQUB    $45,$4F,$5B,$5F,$66,$91,$9C,$CB
        EQUB    $CD,$CF,$D1,$D8,$EF,$F7,$09,$1C
        EQUB    $1D,$1D,$1D,$1D,$1D,$1D,$1D,$1D
        EQUB    $1D,$1D,$1D,$1D,$1D,$27,$31,$3B
        EQUB    $45,$4F,$59,$63,$70,$7D,$87,$91
        EQUB    $9B,$A6,$B1,$BB,$C5,$CF,$D9,$E3
        EQUB    $ED,$0D,$48,$5C,$7E,$90,$A2,$D5
        EQUB    $D5,$D5,$D5,$D5,$97,$97,$97,$97
        EQUB    $97,$97,$97,$97,$97,$97,$97,$97
        EQUB    $97,$97,$97,$97,$97,$97,$98,$98
        EQUB    $98,$98,$98,$98,$98,$98,$98,$98
        EQUB    $98,$98,$98,$98,$98,$98,$98,$98
        EQUB    $98,$98,$98,$98,$98,$98,$98,$98
        EQUB    $98,$98,$98,$98,$98,$98,$98,$98
        EQUB    $98,$99,$99,$99,$99,$99,$99,$99
        EQUB    $99,$99,$99,$99,$81,$41,$FE,$DE
        EQUB    $00,$FE,$11,$41,$FE,$81,$41,$FE
        EQUB    $DE,$A4,$9C,$00,$FE,$81,$41,$41
        EQUB    $81,$41,$FE,$DE,$AD,$AB,$DE,$00
        EQUB    $FE,$11,$21,$FE,$81,$41,$41,$81
        EQUB    $81,$81,$81,$11,$FE,$DE,$AD,$AB
        EQUB    $DE,$CE,$DE,$DE,$AC,$FE,$81,$11
        EQUB    $FE,$DF,$00,$FE,$41,$FE,$81,$41
        EQUB    $41,$81,$41,$FE,$C0,$A8,$A4,$C0
        EQUB    $A2,$9F,$A0,$9D,$9E,$9B,$9C,$99
        EQUB    $9A,$97,$98,$95,$96,$93,$95,$92
        EQUB    $94,$91,$93,$90,$92,$8F,$91,$8E
        EQUB    $90,$8D,$8F,$8C,$8E,$8B,$8D,$8A
        EQUB    $8C,$89,$8B,$88,$FF,$1C,$81,$FE
        EQUB    $81,$41,$41,$81,$41,$41,$41,$81
        EQUB    $FF,$06,$CF,$2A,$27,$A4,$27,$25
        EQUB    $23,$A4,$21,$A4,$1F,$A4,$1D,$A4
        EQUB    $1B,$A4,$19,$A4,$17,$A4,$15,$A4
        EQUB    $13,$A4,$12,$A4,$11,$A4,$10,$A4
        EQUB    $0F,$A4,$0E,$A4,$0D,$A4,$0C,$A4
        EQUB    $0B,$A4,$0A,$A4,$0A,$A4,$FF,$1C
        EQUB    $81,$FE,$47,$FE,$11,$FE,$15,$FE
        EQUB    $81,$81,$11,$11,$FF,$00,$88,$CF
        EQUB    $AC,$A6,$88,$CF,$AD,$A5,$88,$CF
        EQUB    $AE,$A4,$88,$CF,$AD,$A5,$FF,$00
        EQUB    $41,$11,$41,$FF,$00,$9D,$A4,$9E
        EQUB    $FF,$00,$81,$41,$FE,$B0,$25,$21
        EQUB    $1E,$1C,$1A,$19,$18,$17,$16,$15
        EQUB    $16,$FF,$08,$51,$09,$00,$09,$FE
        EQUB    $11,$09,$11,$09,$11,$09,$09,$11
        EQUB    $09,$09,$09,$11,$09,$09,$09,$09
        EQUB    $11,$09,$FE,$00,$03,$07,$00,$00
        EQUB    $03,$03,$07,$FF,$02,$00,$04,$07
        EQUB    $00,$00,$04,$04,$07,$FF,$02,$00
        EQUB    $05,$08,$00,$00,$05,$05,$08,$FF
        EQUB    $02,$00,$05,$09,$00,$00,$05,$05
        EQUB    $09,$FF,$02,$00,$03,$08,$00,$00
        EQUB    $03,$03,$08,$FF,$02,$00,$04,$09
        EQUB    $00,$00,$04,$04,$09,$FF,$02,$00
        EQUB    $02,$07,$00,$00,$02,$02,$07,$FF
        EQUB    $02,$08,$05,$03,$00,$08,$08,$05
        EQUB    $05,$03,$03,$00,$FF,$03,$09,$07
        EQUB    $05,$00,$09,$09,$07,$07,$05,$05
        EQUB    $00,$FF,$03,$07,$05,$00,$07,$07
        EQUB    $05,$05,$00,$FF,$02,$0A,$03,$00
        EQUB    $0A,$0A,$03,$03,$00,$FF,$02,$09
        EQUB    $03,$00,$09,$09,$03,$03,$00,$FF
        EQUB    $02,$16,$11,$0C,$0A,$0A,$03,$03
        EQUB    $00,$00,$FF,$03,$15,$11,$0C,$09
        EQUB    $09,$03,$03,$00,$00,$FF,$03,$09
        EQUB    $04,$00,$09,$09,$04,$04,$00,$FF
        EQUB    $02,$05,$03,$00,$05,$05,$03,$03
        EQUB    $00,$FF,$02,$07,$02,$00,$07,$07
        EQUB    $02,$02,$00,$FF,$02,$05,$02,$00
        EQUB    $05,$05,$02,$02,$00,$FF,$02,$00
        EQUB    $05,$07,$00,$00,$05,$05,$07,$FF
        EQUB    $02,$00,$05,$0A,$00,$00,$05,$05
        EQUB    $0A,$FF,$02,$00,$02,$05,$0A,$10
        EQUB    $15,$18,$19,$17,$1B,$16,$1C,$15
        EQUB    $1D,$14,$1B,$16,$1A,$15,$18,$1E
        EQUB    $19,$1D,$15,$1C,$16,$1B,$17,$1A
        EQUB    $19,$FF,$0F,$00,$04,$08,$0C,$10
        EQUB    $14,$18,$1C,$1D,$1E,$1C,$1D,$1B
        EQUB    $1C,$1A,$1B,$19,$1A,$18,$19,$17
        EQUB    $18,$16,$18,$16,$17,$15,$17,$15
        EQUB    $16,$14,$16,$14,$15,$13,$15,$13
        EQUB    $14,$12,$14,$12,$13,$11,$13,$11
        EQUB    $12,$10,$12,$10,$11,$0F,$11,$0F
        EQUB    $10,$0E,$10,$0E,$FF,$10,$00,$06
        EQUB    $04,$0A,$08,$0E,$0A,$10,$0C,$12
        EQUB    $0D,$13,$0E,$14,$0F,$15,$0E,$14
        EQUB    $FF,$0A,$0F,$15,$0E,$14,$0C,$12
        EQUB    $09,$10,$06,$0D,$05,$0C,$04,$0B
        EQUB    $03,$0A,$03,$0A,$02,$09,$02,$09
        EQUB    $01,$08,$01,$08,$01,$08,$00,$07
        EQUB    $00,$07,$FF,$13,$00,$00,$05,$05
        EQUB    $07,$07,$0C,$0C,$0A,$0A,$05,$05
        EQUB    $07,$07,$03,$03,$FF,$00,$14,$00
        EQUB    $1C,$0A,$18,$08,$11,$04,$15,$03
        EQUB    $1A,$0C,$13,$02,$16,$0E,$FF,$00
        EQUB    $D8,$20,$1C,$1D,$19,$1B,$17,$19
        EQUB    $15,$18,$14,$17,$13,$16,$12,$15
        EQUB    $11,$14,$10,$13,$0F,$13,$0F,$12
        EQUB    $0E,$12,$0E,$11,$0D,$11,$0D,$10
        EQUB    $0C,$10,$0C,$0F,$0B,$0F,$0B,$0E
        EQUB    $0A,$0E,$0A,$0D,$09,$0D,$09,$0C
        EQUB    $08,$FF,$2F,$10,$FF,$04,$E0,$07
        EQUB    $F0,$0B,$FF,$FE,$00,$01,$81,$81
        EQUB    $81,$08,$08,$81,$81,$81,$81,$81
        EQUB    $08,$01,$08,$01,$81,$08,$08,$08
        EQUB    $08,$08,$08,$08,$08,$08,$08,$08
        EQUB    $08,$01,$08,$08,$08,$08,$08,$08
        EQUB    $08,$08,$08,$08,$01,$00,$08,$08
        EQUB    $01,$01,$00,$41,$41,$41,$41,$41
        EQUB    $41,$21,$21,$21,$41,$41,$41,$41
        EQUB    $41,$41,$41,$11,$11,$41,$41,$41
        EQUB    $81,$81,$81,$81,$81,$81,$43,$41
        EQUB    $11,$15,$81,$81,$81,$81,$81,$81
        EQUB    $81,$81,$15,$51,$41,$11,$41,$41
        EQUB    $00,$06,$06,$00,$00,$06,$06,$06
        EQUB    $00,$00,$06,$06,$08,$08,$08,$08
        EQUB    $00,$00,$00,$00,$00,$08,$8A,$0F
        EQUB    $00,$00,$00,$00,$0D,$08,$00,$08
        EQUB    $B0,$00,$00,$B0,$00,$00,$88,$0D
        EQUB    $08,$08,$08,$00,$0F,$0D,$00,$69
        EQUB    $69,$39,$19,$69,$69,$69,$39,$19
        EQUB    $69,$69,$79,$69,$69,$69,$29,$89
        EQUB    $89,$69,$19,$A9,$A9,$DB,$7F,$79
        EQUB    $79,$79,$D9,$8A,$7A,$D8,$AF,$AF
        EQUB    $AA,$AF,$AF,$AA,$88,$D8,$D8,$D8
        EQUB    $69,$D9,$DF,$D9,$F0,$10,$10,$10
        EQUB    $10,$10,$10,$10,$10,$10,$10,$10
        EQUB    $F0,$10,$10,$10,$10,$10,$10,$10
        EQUB    $00,$F0,$30,$F0,$00,$F0

.BeebDisEndAddr
SAVE "../out/player.bin",BeebDisStartAddr,BeebDisEndAddr

