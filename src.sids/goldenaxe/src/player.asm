; Golden Axe player at runtime $9000 (Jeroen Tel / Maniacs of Noise).
; BeebDis listing of the 4K image init copies from file $10F0.
; Assembled with BeebAsm; do not hand-edit if you still need a
; byte-identical round-trip — change symbols/ctl and regenerate.
;
L001F   = $001F
L0020   = $0020
L0021   = $0021
SID     = $D400
SID_V1FREQHI = $D401
SID_V1PWLO = $D402
SID_V1PWHI = $D403
SID_V1CTRL = $D404
SID_V1AD = $D405
SID_V1SR = $D406
LD416   = $D416
LD417   = $D417
SID_MODEVOL = $D418
CIA1_TALO = $DC04
CIA1_TAHI = $DC05

        org     $9000
.BeebDisStartAddr
.player_init
        JMP     jmp_900A

.player_play
        JMP     jmp_910F

.player_stop
        JMP     player_silence

.L9009
        EQUB    $00

.jmp_900A
        LDY     #$00
        STY     L9110
        STA     L9016
        ASL     A
        ASL     A
        ASL     A
.L9015
        ADC     #$01
L9016 = L9015+1
        STA     L90CD
        STA     L90CE
        STA     L90CF
        TAX
        LDA     L9949,X
        STA     L9066
        LDA     L994A,X
        STA     L9131
        LDA     L994B,X
        STA     L9195
        LDA     #$0F
        STA     L983D
        TYA
        LDX     #$27
.code_903B
        STA     L90CF,X
        DEX
        BNE     code_903B

        LDX     #$02
.code_9043
        STA     L001F,X
        DEX
        BPL     code_9043

        STA     L9009
        LDA     #$10
        STA     L983F
        LDA     #$F0
        STA     L9844
        LDA     #$00
        LDX     #$14
.code_9059
        STA     SID,X
        DEX
        BPL     code_9059

        STX     L9110
        RTS

.L9063
        EQUB    $00,$07,$0E

.L9066
        EQUB    $02

.L9067
        EQUB    $00

.L9068
        EQUB    $30

.L9069
        EQUB    $2F,$BB,$1C

.L906C
        EQUB    $0B,$03,$01

.L906F
        EQUB    $E0,$00,$80

.L9072
        EQUB    $03,$09,$0C

.L9075
        EQUB    $08,$06,$00

.L9078
        EQUB    $0C,$FD,$00

.L907B
        EQUB    $FE,$FE,$FF

.L907E
        EQUB    $B8,$A8,$60

.L9081
        EQUB    $3E,$3E,$FD

.L9084
        EQUB    $3E,$3E,$FD

.L9087
        EQUB    $F0

.L9088
        EQUB    $34

.L9089
        EQUB    $66

.L908A
        EQUB    $60

.L908B
        EQUB    $06,$0B,$05

.L908E
        EQUB    $00,$00,$00

.L9091
        EQUB    $04,$07,$03

.L9094
        EQUB    $03,$03,$00

.L9097
        EQUB    $01,$01,$00

.L909A
        EQUB    $00,$00,$00

.L909D
        EQUB    $04

.L909E
        EQUB    $00

.L909F
        EQUB    $04

.L90A0
        EQUB    $04,$06,$04

.L90A3
        EQUB    $00,$00,$00

.L90A6
        EQUB    $08,$20,$80

.L90A9
        EQUB    $A1,$A0,$A1

.L90AC
        EQUB    $00,$00,$01

.L90AF
        EQUB    $0B,$03,$01

.L90B2
        EQUB    $0B,$03,$11

.L90B5
        EQUB    $00,$00,$00

.L90B8
        EQUB    $38,$40,$0A

.L90BB
        EQUB    $00,$00,$00

.L90BE
        EQUB    $00,$00,$00

.L90C1
        EQUB    $C0,$00,$00

.L90C4
        EQUB    $00,$00,$00

.L90C7
        EQUB    $05,$05,$03

.L90CA
        EQUB    $01,$01,$01

.L90CD
        EQUB    $09

.L90CE
        EQUB    $09

.L90CF
        EQUB    $09

.L90D0
        EQUB    $01

.L90D1
        EQUB    $00

.L90D2
        EQUB    $41,$41,$00

.L90D5
        EQUB    $00

.L90D6
        EQUB    $01,$01,$00

.L90D9
        EQUB    $01,$01,$01

.L90DC
        EQUB    $09,$09,$09

.L90DF
        EQUB    $00,$00,$00

.L90E2
        EQUB    $00,$00,$00

.L90E5
        EQUB    $03,$05,$01

.L90E8
        EQUB    $17,$15,$00

.L90EB
        EQUB    $1F,$1F,$00

.L90EE
        EQUB    $0B,$0B,$03,$00,$00,$00

.L90F4
        EQUB    $28,$15,$00

.player_silence
        LDX     #$0E
.code_90F9
        LDA     #$00
        STA     L9110
        STA     SID_V1CTRL,X
        STA     SID,X
        STA     SID_V1FREQHI,X
        TXA
        SEC
        SBC     #$07
        TAX
        BPL     code_90F9

        RTS

.jmp_910F
        LDA     #$FF
L9110 = jmp_910F+1
        BMI     code_9114

        RTS

.code_9114
        LDA     L9009
        BEQ     code_9129

        DEC     L90D5
        BPL     code_9129

        STA     L90D5
        LDA     L983D
        BEQ     player_silence

        DEC     L983D
.code_9129
        LDX     #$02
        DEC     L90D1
        BPL     code_9137

.L9130
        LDA     #$00
L9131 = L9130+1
        STA     L90D1
        BNE     jmp_9142

.code_9137
        DEC     L90D0
        BPL     jmp_9142

        LDA     L9066
        STA     L90D0
.jmp_9142
        STX     L9067
        LDA     L9066
        CMP     L90D0
        BEQ     code_9150

        JMP     jmp_937E

.code_9150
        DEC     L90EE,X
        BMI     code_9158

        JMP     jmp_9353

.code_9158
        TXA
        ASL     A
        ADC     L90CD,X
        TAX
        LDA     L9943,X
        STA     L9171
        LDA     L9944,X
        STA     L9172
        LDX     L9067
.code_916D
        LDY     L90D9,X
.L9170
        LDA     L9C42,Y
L9171 = L9170+1
L9172 = L9170+2
        CMP     #$FE
        BEQ     player_silence

        CMP     #$FF
        BNE     code_9189

        LDA     #$00
        STA     L90EE,X
        STA     L90E5,X
        STA     L90D9,X
        JMP     code_9158

.code_9189
        CMP     #$6F
        BCC     code_91A9

        CMP     #$80
        BCC     code_919E

        SBC     #$80
        CLC
.L9194
        ADC     #$FD
L9195 = L9194+1
        STA     L90DC,X
        INC     L90D9,X
        BNE     code_916D

.code_919E
        SEC
        SBC     #$70
        STA     L90E2,X
        INC     L90D9,X
        BNE     code_916D

.code_91A9
        ASL     A
        TAY
        LDA     L9907,Y
        STA     L0020
        LDA     L9908,Y
        STA     L0021
.code_91B5
        LDA     #$00
        STA     L90BB,X
        STA     L90AC,X
        LDA     #$01
        STA     L90CA,X
        LDY     L90E5,X
        LDA     (L0020),Y
        STA     L9068
        CMP     #$60
        BCS     code_91D1

        JMP     jmp_92C1

.code_91D1
        CMP     #$FF
        BNE     code_91ED

        LDA     #$00
        STA     L90E5,X
        LDA     L90E2,X
        BEQ     code_91E4

        DEC     L90E2,X
        BPL     code_91EA

.code_91E4
        INC     L90D9,X
        JMP     code_916D

.code_91EA
        JMP     code_91B5

.code_91ED
        CMP     #$FE
        BNE     code_91FD

        INY
        LDA     (L0020),Y
        STA     L9844
        INY
        LDA     (L0020),Y
        STA     L9068
.code_91FD
        CMP     #$FD
        BNE     code_9225

.code_9201
        INY
        LDA     (L0020),Y
        AND     #$0F
        STA     L90BB,X
        LDA     (L0020),Y
        LSR     A
        LSR     A
        LSR     A
        LSR     A
        STA     L90BE,X
        INY
        LDA     (L0020),Y
        STA     L9068
        INY
        LDA     (L0020),Y
        CLC
        ADC     L90DC,X
        STA     L90B8,X
        JMP     jmp_92C1

.code_9225
        LDA     #$00
        STA     L90BB,X
        LDA     L9068
        CMP     #$FC
        BNE     code_923D

        INY
        LDA     (L0020),Y
        STA     L9009
        INY
        LDA     (L0020),Y
        STA     L9068
.code_923D
        CMP     #$FB
        BNE     code_924C

        LDA     #$00
        STA     L90CA,X
        INY
        LDA     (L0020),Y
        STA     L9068
.code_924C
        LDA     L9068
        CMP     #$E0
        BCC     code_9270

        SBC     #$E1
        STA     L90EE,X
        LDA     #$00
        STA     L90D2,X
        STA     L9075,X
        STA     L9078,X
        LDA     #$01
        STA     L90AC,X
        INY
        TYA
        STA     L90E5,X
        JMP     jmp_97F0

.code_9270
        LDA     L9068
        CMP     #$C0
        BCC     code_928D

        SBC     #$C0
        CLC
        ADC     L90DF,X
        STA     L90E8,X
        INY
        LDA     (L0020),Y
        CMP     #$FD
        BNE     code_928A

        JMP     code_9201

.code_928A
        STA     L9068
.code_928D
        CMP     #$80
        BCC     code_92B2

        SBC     #$81
        STA     L90EB,X
.code_9296
        INY
        LDA     (L0020),Y
        CMP     #$FD
        BNE     code_92A0

        JMP     code_9201

.code_92A0
        CMP     #$80
        BCC     code_92AF

        SBC     #$80
        CLC
        ADC     L90EB,X
        STA     L90EB,X
        BNE     code_9296

.code_92AF
        STA     L9068
.code_92B2
        CMP     #$60
        BCC     jmp_92C1

        SBC     #$60
        STA     L908B,X
        INY
        LDA     (L0020),Y
        STA     L9068
.jmp_92C1
        LDA     L90EB,X
        STA     L90EE,X
        LDA     #$00
        STA     L9081,X
        STA     L9094,X
        STA     L9097,X
        STA     L909A,X
        INY
        TYA
        STA     L90E5,X
        LDA     L9068
        CLC
        ADC     L90DC,X
        STA     L90F4,X
        TAY
        LDA     L9849,Y
        STA     L9069,X
        LDA     L98A8,Y
        STA     L906C,X
        STA     L90AF,X
        STA     L90B2,X
        INC     L9081,X
        LDA     #$FF
        STA     L907B,X
        LDA     L90E8,X
        ASL     A
        ASL     A
        ASL     A
        STA     L907E,X
        TAY
        LDA     L9AC7,Y
        STA     L9075,X
        LDA     L9AC8,Y
        STA     L9078,X
        LDA     L90CA,X
        BEQ     code_932F

        LDA     L90D6,X
        BMI     code_932F

        LDA     L9AC5,Y
        AND     #$0F
        STA     L9072,X
        LDA     L9AC5,Y
        AND     #$F0
        STA     L906F,X
.code_932F
        LDA     L9AC9,Y
        AND     #$08
        BNE     code_934A

        LDA     L90CA,X
        BEQ     code_934A

        LDA     L9ACC,Y
        AND     #$F0
        BEQ     code_934A

        LDA     #$01
        STA     L90D2,X
        JMP     jmp_97F0

.code_934A
        LDA     L9AC6,Y
        STA     L90D2,X
        JMP     jmp_97F0

.jmp_9353
        LDA     L90EE,X
        BEQ     code_9374

        CMP     L90EB,X
        BEQ     code_9370

        LDY     L907E,X
        LDA     L9AC9,Y
        LSR     A
        LSR     A
        LSR     A
        LSR     A
        CMP     #$0F
        BEQ     code_9374

        CMP     L90EE,X
        BCS     code_9374

.code_9370
        LDA     #$FF
        BNE     code_937B

.code_9374
        LDA     L90CA,X
        BEQ     jmp_937E

        LDA     #$FE
.code_937B
        STA     L907B,X
.jmp_937E
        LDA     L90AC,X
        BEQ     code_9386

        JMP     jmp_97F0

.code_9386
        INC     L9081,X
        LDA     L9081,X
        CMP     #$03
        BCS     code_9392

        LDA     #$00
.code_9392
        STA     L9084,X
        LDY     L907E,X
        LDA     L9AC9,Y
        STA     L9087
        LDA     L9ACA,Y
        STA     L9088
        LDA     L9ACB,Y
        STA     L9089
        LDA     L9ACC,Y
        STA     L908A
        AND     #$08
        BEQ     code_93C8

        LDA     L90EE,X
        BNE     code_93C8

        LDA     L90CA,X
        BEQ     code_93C8

        LDA     L90D0
        CMP     #$01
        BNE     code_93C8

        STA     L9078,X
.code_93C8
        LDA     L90BB,X
        BNE     code_93D0

        JMP     jmp_946B

.code_93D0
        LDA     L9066
        CMP     L90D0
        BNE     code_93E0

        LDA     L90BE,X
        BEQ     code_93E0

        DEC     L90BE,X
.code_93E0
        LDA     L90BE,X
        BEQ     code_93E8

        JMP     jmp_946B

.code_93E8
        LDY     L90B8,X
        LDA     L9849,Y
        STA     L0020
        LDA     L98A8,Y
        STA     L0021
        LDA     #$00
        STA     L9068
        LDA     #$07
        LDY     L90BB,X
        DEY
.jmp_9400
        DEY
        BMI     code_940A

        ASL     A
        ROL     L9068
        JMP     jmp_9400

.code_940A
        STA     L90C1
        LDA     L90F4,X
        CMP     L90B8,X
        BCC     code_9449

        LDA     L9069,X
        SBC     L90C1
        STA     L9069,X
        LDA     L906C,X
        SBC     L9068
        STA     L906C,X
        LDA     L9069,X
        SEC
        SBC     L0020
        LDA     L906C,X
        SBC     L0021
        BCS     jmp_946B

.code_9434
        LDA     #$00
        STA     L90BB,X
        LDA     L0020
        STA     L9069,X
        LDA     L0021
        STA     L906C,X
        STA     L90AF,X
        JMP     jmp_946B

.code_9449
        LDA     L9069,X
        ADC     L90C1
        STA     L9069,X
        LDA     L906C,X
        ADC     L9068
        STA     L906C,X
        LDA     L0020
        SEC
        SBC     L9069,X
        LDA     L0021
        SBC     L906C,X
        BCS     jmp_946B

        JMP     code_9434

.jmp_946B
        LDA     L9087
        AND     #$08
        BEQ     code_9484

        LDA     L908A
        LSR     A
        LSR     A
        LSR     A
        LSR     A
        TAY
        DEY
        LDA     L9BAE,Y
        CLC
        ADC     #$1C
        TAY
        BNE     code_948E

.code_9484
        LDA     L908A
        AND     #$04
        BEQ     code_9507

        LDY     L908B,X
.code_948E
        LDA     L996B,Y
        STA     L0020
        LDA     L998B,Y
        STA     L0021
        LDA     L9084,X
        BNE     code_94A3

        STA     L9091,X
        STA     L908E,X
.code_94A3
        LDY     #$00
        LDA     (L0020),Y
        STA     L9068
        DEC     L908E,X
        BPL     code_9507

        LSR     A
        LSR     A
        LSR     A
        LSR     A
        AND     #$07
        STA     L908E,X
.code_94B8
        INC     L9091,X
        LDY     L9091,X
        LDA     (L0020),Y
        CMP     #$FF
        BNE     code_94D0

        LDY     #$00
        LDA     (L0020),Y
        AND     #$0F
        STA     L9091,X
        JMP     code_94B8

.code_94D0
        CMP     #$FE
        BNE     code_94DA

        DEC     L9091,X
        JMP     code_9507

.code_94DA
        LDY     L90BB,X
        BNE     code_9507

        BIT     L9068
        BPL     code_94ED

        STA     L906C,X
        STA     L9069,X
        JMP     code_9504

.code_94ED
        CMP     #$00
        BMI     code_94F5

        CLC
        ADC     L90F4,X
.code_94F5
        AND     #$7F
        TAY
        LDA     L9849,Y
        STA     L9069,X
        LDA     L98A8,Y
        STA     L906C,X
.code_9504
        STA     L90AF,X
.code_9507
        LDA     L9088
        BNE     code_950F

.code_950C
        JMP     jmp_95DA

.code_950F
        LDA     L9084,X
        BNE     code_952D

        LDA     #$00
        STA     L9097,X
        STA     L9094,X
        STA     L90C4,X
        LDA     L9088
        AND     #$07
        LSR     A
        ADC     #$00
        STA     L909A,X
        JMP     jmp_95DA

.code_952D
        LDA     L90BB,X
        BNE     code_950C

        LDY     L90F4,X
        LDA     L9849,Y
        SEC
        SBC     L9848,Y
        STA     L0020
        LDA     L98A8,Y
        SBC     L98A7,Y
        STA     L0021
        LDA     L9088
        AND     #$70
        LSR     A
        LSR     A
        LSR     A
        LSR     A
        TAY
.jmp_9550
        DEY
        BMI     code_955A

        LSR     L0021
        ROR     L0020
        JMP     jmp_9550

.code_955A
        LDA     L9088
        BPL     code_957B

        LDA     L9081,X
        CMP     #$2C
        BCS     code_9569

        INC     L90C4,X
.code_9569
        LDY     #$01
.code_956B
        LDA     L0020
        ADC     L90C4,X
        STA     L0020
        LDA     L0021
        ADC     #$00
        STA     L0021
        DEY
        BPL     code_956B

.code_957B
        LDA     L9089
        LSR     A
        LSR     A
        LSR     A
        LSR     A
        STA     L958D
        LDA     L90EB,X
        SEC
        SBC     L90EE,X
.L958C
        CMP     #$06
L958D = L958C+1
        BCC     jmp_95DA

        DEC     L909A,X
        BPL     code_95B2

        INC     L909A,X
        DEC     L9094,X
        BPL     code_95AD

        LDA     L9088
        AND     #$07
        STA     L9094,X
        LDA     L9097,X
        EOR     #$01
        STA     L9097,X
.code_95AD
        LDA     L9097,X
        BNE     code_95C6

.code_95B2
        LDA     L9069,X
        CLC
        ADC     L0020
        STA     L9069,X
        LDA     L90AF,X
        ADC     L0021
        STA     L906C,X
        JMP     jmp_95D7

.code_95C6
        LDA     L9069,X
        SEC
        SBC     L0020
        STA     L9069,X
        LDA     L90AF,X
        SBC     L0021
        STA     L906C,X
.jmp_95D7
        STA     L90AF,X
.jmp_95DA
        LDX     L9067
        LDA     L9087
        AND     #$07
        BNE     code_95E7

        JMP     jmp_9657

.code_95E7
        STX     L9658
        TAY
        DEY
        LDA     L9961,Y
        STA     L0020
        LDA     L9966,Y
        STA     L0021
        LDA     L9084,X
        BNE     code_9620

        LDY     #$00
        STY     L9621
        LDA     (L0020),Y
        STA     L9068
        AND     #$F0
        STA     L983F
        LDA     L9068
        AND     #$0F
        STA     L9636
        LDA     #$02
        STA     L909F
        INY
        STY     L909E
        LDA     (L0020),Y
        JMP     jmp_9665

.code_9620
        LDA     #$FF
L9621 = code_9620+1
        BMI     code_966B

        DEC     L909E
        BNE     code_964E

.code_9629
        LDY     L909F
        LDA     (L0020),Y
        CMP     #$FF
        BNE     code_9641

        STA     L9621
.L9635
        LDA     #$00
L9636 = L9635+1
        BEQ     code_966B

        STA     L9621
        STA     L909F
        BNE     code_9629

.code_9641
        STA     L909E
        INY
        LDA     (L0020),Y
        STA     L9653
        INY
        STY     L909F
.code_964E
        LDA     L909D
        CLC
.L9652
        ADC     #$FF
L9653 = L9652+1
        JMP     jmp_9665

.jmp_9657
        LDA     #$01
L9658 = jmp_9657+1
        CMP     L9067
        BNE     code_966B

        LDA     #$10
        STA     L983F
        LDA     #$FF
.jmp_9665
        STA     L909D
        STA     LD416
.code_966B
        LDX     L9067
        LDA     L9089
        AND     #$0F
        BNE     code_9678

        JMP     jmp_972D

.code_9678
        TAY
        DEY
        LDA     L9955,Y
        STA     L0020
        LDA     L995B,Y
        STA     L0021
        LDY     #$00
        LDA     (L0020),Y
        AND     #$0F
        STA     L970B
        LDA     (L0020),Y
        LSR     A
        LSR     A
        LSR     A
        LSR     A
        STA     L9727
        LDA     L9084,X
        BNE     code_96B7

        INY
        LDA     (L0020),Y
        STA     L90D6,X
        BMI     code_96AA

        LDA     (L0020),Y
        AND     #$7F
        STA     L90A9,X
.code_96AA
        LDA     #$02
        STA     L90A0,X
        LDA     #$01
        STA     L90A3,X
        JMP     jmp_972D

.code_96B7
        LDA     L90A9,X
        BMI     jmp_96F2

        DEC     L90A3,X
        BNE     jmp_96F2

        LDY     L90A0,X
        LDA     (L0020),Y
        CMP     #$FF
        BNE     code_96D5

        LDA     L90A9,X
        EOR     #$A0
        STA     L90A9,X
        JMP     jmp_96F2

.code_96D5
        CMP     #$FE
        BNE     code_96E4

        LDA     #$0C
        STA     L9072,X
        STA     L906F,X
        INY
        LDA     (L0020),Y
.code_96E4
        STA     L90A3,X
        INY
        LDA     (L0020),Y
        STA     L90A6,X
        INY
        TYA
        STA     L90A0,X
.jmp_96F2
        LDA     L90A9,X
        LSR     A
        BCC     code_9714

        LDA     L906F,X
        CLC
        ADC     L90A6,X
        STA     L906F,X
        LDA     L9072,X
        ADC     #$00
        STA     L9072,X
.L970A
        CMP     #$0A
L970B = L970A+1
        BCC     jmp_972D

        DEC     L90A9,X
        JMP     jmp_972D

.code_9714
        LDA     L906F,X
        SEC
        SBC     L90A6,X
        STA     L906F,X
        LDA     L9072,X
        SBC     #$00
        STA     L9072,X
.L9726
        CMP     #$06
L9727 = L9726+1
        BCS     jmp_972D

        INC     L90A9,X
.jmp_972D
        LDA     L908A
        AND     #$02
        BEQ     code_9759

        LDA     L90EB,X
        CMP     #$00
        BCC     code_9753

        LDA     L90EE,X
        CMP     #$05
        BCS     code_9753

        LDA     L9081,X
        AND     #$01
        BEQ     code_9753

        LDA     L90B2,X
        BEQ     code_9759

        DEC     L90B2,X
        BNE     code_9756

.code_9753
        LDA     L90AF,X
.code_9756
        STA     L906C,X
.code_9759
        LDA     L9087
        AND     #$08
        BNE     code_97A5

        LDA     L90CA,X
        BEQ     code_97A5

        LDA     L908A
        AND     #$F0
        BEQ     code_97A5

        LSR     A
        LSR     A
        LSR     A
        LSR     A
        TAY
        DEY
        LDA     L9BA5,Y
        CMP     L9081,X
        BCC     code_978E

        LDA     #$01
        STA     L90B5,X
        LDA     L9BAE,Y
        BPL     code_978B

        LDA     #$48
        STA     L906C,X
        LDA     #$81
.code_978B
        JMP     jmp_97A2

.code_978E
        LDA     L90B5,X
        BEQ     code_97A5

        DEC     L90B5,X
        LDA     L90AF,X
        STA     L906C,X
        LDY     L907E,X
        LDA     L9AC6,Y
.jmp_97A2
        STA     L90D2,X
.code_97A5
        LDA     L9087
        AND     #$08
        BEQ     jmp_97F0

        LDA     L908A
        LSR     A
        LSR     A
        LSR     A
        LSR     A
        TAY
        DEY
        LDA     L9BA5,Y
        TAY
        LDA     L99AB,Y
        STA     L0020
        LDA     L99AF,Y
        STA     L0021
        LDA     L9084,X
        BNE     code_97CB

        STA     L90C7,X
.code_97CB
        INC     L90C7,X
        LDY     L90C7,X
        LDA     (L0020),Y
        CMP     #$FF
        BNE     code_97E3

        LDY     #$00
        LDA     (L0020),Y
        AND     #$0F
        STA     L90C7,X
        JMP     code_97CB

.code_97E3
        CMP     #$FE
        BNE     code_97ED

        DEC     L90C7,X
        JMP     jmp_97F0

.code_97ED
        STA     L90D2,X
.jmp_97F0
        LDX     L9067
        LDY     L9063,X
        LDA     L9078,X
        STA     SID_V1SR,Y
        LDA     L9075,X
        STA     SID_V1AD,Y
        LDA     L90D2,X
        AND     L907B,X
        STA     SID_V1CTRL,Y
        LDA     L9072,X
        STA     SID_V1PWHI,Y
        LDA     L906F,X
        STA     SID_V1PWLO,Y
        LDA     L908A
        AND     #$01
        BEQ     code_9827

        LDA     L9069,X
        CLC
        ADC     #$FF
        JMP     code_982B

.code_9827
        LDA     L9069,X
        CLC
.code_982B
        STA     SID,Y
        LDA     L906C,X
        ADC     #$00
        STA     SID_V1FREQHI,Y
        DEX
        BMI     code_983C

        JMP     jmp_9142

.code_983C
        LDA     #$0F
L983D = code_983C+1
.L983E
        ORA     #$30
L983F = L983E+1
        STA     SID_MODEVOL
.L9843
        LDA     #$F2
L9844 = L9843+1
        STA     LD417
.L9848
        RTS

.L9849
        EQUB    $1C,$FF,$3F,$52,$66,$7B,$92,$AA
        EQUB    $C3,$DE,$FA,$18,$38,$5A,$7E,$A3
        EQUB    $CC,$F6,$23,$53,$86,$BB,$F4,$30
        EQUB    $70,$B4,$FB,$47,$97,$EC,$47,$A6
        EQUB    $0B,$77,$E8,$60,$E0,$67,$F6,$8E
        EQUB    $2F,$D9,$8D,$4C,$17,$ED,$D0,$C1
        EQUB    $C0,$CE,$EC,$1C,$5D,$B2,$1A,$98
        EQUB    $2D,$DA,$A0,$82,$80,$9C,$D9,$38
        EQUB    $BA,$63,$34,$31,$5A,$B4,$41,$04
        EQUB    $00,$39,$B2,$6F,$74,$C6,$69,$81
        EQUB    $B5,$68,$82,$08,$00,$72,$64,$DE
        EQUB    $E9,$8C,$D1,$C2,$69,$D1

.L98A7
        EQUB    $04

.L98A8
        EQUB    $01,$FC,$01,$01,$01,$01,$01,$01
        EQUB    $01,$01,$01,$02,$02,$02,$02,$02
        EQUB    $02,$02,$03,$03,$03,$03,$03,$04
        EQUB    $04,$04,$04,$05,$05,$05,$06,$06
        EQUB    $07,$07,$07,$08,$08,$09,$09,$0A
        EQUB    $0B,$0B,$0C,$0D,$0E,$0E,$0F,$10
        EQUB    $11,$12,$13,$15,$16,$17,$19,$1A
        EQUB    $1C,$1D,$1F,$21,$23,$25,$27,$2A
        EQUB    $2C,$2F,$32,$35,$38,$3B,$3F,$43
        EQUB    $47,$4B,$4F,$54,$59,$5E,$64,$6A
        EQUB    $70,$77,$7E,$86,$8E,$96,$9F,$A8
        EQUB    $B2,$BD,$C8,$D4,$E1,$EE,$FD

.L9907
        EQUB    $EB

.L9908
        EQUB    $9F,$CB,$9B,$FB,$9B,$DC,$9B,$06
        EQUB    $9C,$0B,$9C,$17,$9C,$29,$9C,$B3
        EQUB    $9C,$80,$9D,$CC,$9D,$DF,$9D,$EE
        EQUB    $9D,$F7,$9D,$ED,$9C,$52,$9E,$9A
        EQUB    $9E,$BD,$9E,$D3,$9E,$EE,$9E,$F2
        EQUB    $9E,$08,$9F,$50,$9F,$6E,$9F,$91
        EQUB    $9F,$A6,$9F,$C1,$9F,$D2,$9F,$A5
        EQUB    $9E,$B0,$9E

.L9943
        EQUB    $B7

.L9944
        EQUB    $9B,$BE,$9B,$C2,$9B

.L9949
        EQUB    $02

.L994A
        EQUB    $06

.L994B
        EQUB    $FD,$42,$9C,$61,$9C,$7F,$9C,$02
        EQUB    $00,$FD

.L9955
        EQUB    $02,$09,$0E,$13,$1A,$1F

.L995B
        EQUB    $9A,$9A,$9A,$9A,$9A,$9A

.L9961
        EQUB    $F5,$FA,$FF,$02,$02

.L9966
        EQUB    $99,$99,$99,$9A,$9A

.L996B
        EQUB    $24,$29,$2E,$33,$38,$3D,$42,$49
        EQUB    $4D,$53,$5A,$5E,$6F,$74,$79,$7E
        EQUB    $83,$88,$8C,$90,$95,$9B,$A1,$A7
        EQUB    $AD,$B3,$B9,$BF,$C4,$DC,$E7,$F5

.L998B
        EQUB    $9A,$9A,$9A,$9A,$9A,$9A,$9A,$9A
        EQUB    $9A,$9A,$9A,$9A,$9A,$9A,$9A,$9A
        EQUB    $9A,$9A,$9A,$9A,$9A,$9A,$9A,$9A
        EQUB    $9A,$9A,$9A,$9A,$99,$99,$99,$99

.L99AB
        EQUB    $B3,$D5,$E2,$F5

.L99AF
        EQUB    $99,$99,$99,$99,$83,$81,$41,$40
        EQUB    $20,$20,$20,$10,$10,$10,$80,$10
        EQUB    $10,$40,$40,$40,$FF,$03,$DE,$18
        EQUB    $0C,$0C,$0C,$0C,$0C,$0C,$0C,$DE
        EQUB    $18,$0C,$0C,$0C,$0C,$FF,$80,$81
        EQUB    $41,$41,$81,$80,$FE,$83,$38,$0D
        EQUB    $0B,$38,$FE,$80,$81,$41,$40,$FE
        EQUB    $00,$D0,$05,$08,$06,$04,$03,$02
        EQUB    $02,$01,$01,$01,$00,$FE,$30,$08
        EQUB    $04,$FF,$FF,$10,$80,$40,$FF,$FF
        EQUB    $10,$98,$FF,$4C,$01,$04,$40,$01
        EQUB    $20,$FF,$79,$01,$01,$28,$FF,$38
        EQUB    $01,$01,$60,$FF,$DF,$01,$0C,$80
        EQUB    $01,$08,$FF,$CE,$01,$01,$80,$FF
        EQUB    $6A,$01,$01,$08,$FF,$10,$07,$03
        EQUB    $00,$FF,$10,$07,$04,$00,$FF,$10
        EQUB    $08,$05,$00,$FF,$10,$09,$05,$00
        EQUB    $FF,$10,$08,$03,$00,$FF,$10,$09
        EQUB    $04,$00,$FF,$00,$A0,$9C,$98,$94
        EQUB    $00,$FE,$20,$00,$01,$FF,$20,$2F
        EQUB    $30,$0C,$00,$FF,$01,$C8,$0C,$0C
        EQUB    $00,$00,$FF,$50,$0C,$00,$FF,$04
        EQUB    $A4,$A0,$9C,$0C,$0C,$0C,$00,$00
        EQUB    $00,$00,$00,$00,$0C,$0C,$0C,$FF
        EQUB    $10,$07,$05,$00,$FF,$10,$0A,$05
        EQUB    $00,$FF,$10,$0B,$05,$00,$FF,$10
        EQUB    $0B,$04,$00,$FF,$10,$0A,$03,$00
        EQUB    $FF,$20,$0C,$00,$FF,$30,$0C,$00
        EQUB    $FF,$50,$0C,$00,$00,$FF,$30,$00
        EQUB    $02,$03,$05,$FF,$30,$02,$00,$02
        EQUB    $04,$FF,$30,$01,$00,$01,$03,$FF
        EQUB    $30,$02,$03,$02,$00,$FF,$00,$00
        EQUB    $03,$07,$0C,$FF,$00,$00,$05,$08
        EQUB    $0C,$FF,$00,$00,$05,$09,$0C,$FF
        EQUB    $00,$00,$03,$08,$0C,$FF

.L9AC5
        EQUB    $00

.L9AC6
        EQUB    $00

.L9AC7
        EQUB    $00

.L9AC8
        EQUB    $00

.L9AC9
        EQUB    $00

.L9ACA
        EQUB    $00

.L9ACB
        EQUB    $00

.L9ACC
        EQUB    $00,$08,$51,$06,$8C,$F8,$00,$00
        EQUB    $10,$08,$11,$08,$E9,$F8,$00,$00
        EQUB    $20,$03,$41,$06,$DB,$F1,$34,$61
        EQUB    $50,$07,$41,$06,$DB,$F1,$34,$61
        EQUB    $54,$07,$51,$06,$6A,$00,$00,$03
        EQUB    $04,$04,$41,$06,$8D,$F0,$33,$42
        EQUB    $00,$07,$41,$06,$89,$10,$00,$02
        EQUB    $64,$07,$41,$06,$89,$10,$00,$02
        EQUB    $74,$01,$41,$06,$8A,$60,$34,$44
        EQUB    $02,$07,$51,$06,$8D,$F0,$00,$03
        EQUB    $04,$0A,$41,$06,$8B,$F0,$00,$04
        EQUB    $64,$07,$21,$06,$A9,$22,$00,$05
        EQUB    $84,$07,$41,$06,$AB,$F0,$34,$61
        EQUB    $54,$07,$41,$06,$AB,$F0,$34,$61
        EQUB    $54,$08,$11,$06,$A9,$FB,$00,$00
        EQUB    $30,$08,$43,$00,$AF,$F0,$00,$00
        EQUB    $00,$0B,$41,$06,$CA,$32,$00,$05
        EQUB    $64,$08,$41,$06,$AA,$80,$44,$02
        EQUB    $00,$08,$21,$06,$A9,$12,$34,$80
        EQUB    $60,$08,$41,$06,$6A,$10,$00,$05
        EQUB    $6C,$07,$41,$06,$FD,$F1,$34,$61
        EQUB    $00,$02,$41,$08,$0D,$F0,$34,$02
        EQUB    $60,$02,$41,$08,$0C,$F0,$34,$66
        EQUB    $60,$08,$41,$00,$6D,$F0,$00,$06
        EQUB    $64,$08,$43,$00,$6F,$F0,$00,$00
        EQUB    $00,$04,$21,$08,$A8,$02,$00,$83
        EQUB    $94,$01,$17,$08,$A9,$00,$00,$00
        EQUB    $00

.L9BA5
        EQUB    $00,$01,$02,$03,$02,$02,$02,$28
        EQUB    $08

.L9BAE
        EQUB    $00,$01,$02,$03,$81,$11,$15,$41
        EQUB    $51,$8C,$01,$72,$03,$77,$03,$FF
        EQUB    $8C,$02,$07,$FF,$8C,$04,$05,$05
        EQUB    $06,$06,$7F,$06,$FF,$FE,$F1,$C4
        EQUB    $8C,$66,$00,$C3,$84,$00,$C4,$8C
        EQUB    $00,$C3,$82,$07,$0A,$FF,$FE,$F1
        EQUB    $C4,$84,$66,$00,$C3,$82,$0C,$0C
        EQUB    $C4,$0A,$C3,$84,$0C,$82,$0A,$C4
        EQUB    $84,$0C,$C3,$82,$0A,$0C,$C4,$0C
        EQUB    $C3,$0A,$84,$0F,$FF,$E8,$C5,$88
        EQUB    $67,$3B,$B0,$47,$A0,$A0,$47,$FF
        EQUB    $C6,$A0,$0C,$0C,$FF,$C7,$82,$69
        EQUB    $16,$18,$22,$21,$1D,$1F,$1B,$1D
        EQUB    $FF,$C8,$82,$16,$C7,$18,$C8,$22
        EQUB    $C7,$21,$C8,$1D,$C7,$1F,$C8,$1B
        EQUB    $C7,$1D,$FF,$C9,$9C,$30,$A0,$FD
        EQUB    $1A,$36,$37,$36,$C9,$A4,$FD,$1A
        EQUB    $36,$37,$CA,$A0,$68,$0C,$FC,$16
        EQUB    $0C,$0C,$0C,$FF

.L9C42
        EQUB    $8C,$19,$98,$73,$08,$8C,$0E,$0E
        EQUB    $98,$73,$08,$8C,$7F,$11,$73,$11
        EQUB    $98,$73,$08,$8C,$0E,$0E,$15,$15
        EQUB    $98,$08,$08,$9A,$08,$08,$FF,$8C
        EQUB    $1A,$73,$09,$09,$0F,$09,$0F,$73
        EQUB    $09,$1C,$77,$10,$1C,$77,$10,$73
        EQUB    $09,$09,$0F,$09,$0F,$73,$17,$09
        EQUB    $09,$8E,$09,$09,$FF,$8C,$1B,$0A
        EQUB    $0B,$0A,$0C,$0A,$0B,$0A,$0C,$0D
        EQUB    $0D,$0A,$0B,$0A,$0C,$0A,$0B,$0A
        EQUB    $0C,$1D,$87,$12,$13,$8C,$1D,$93
        EQUB    $12,$14,$8C,$0A,$0B,$0A,$0C,$0A
        EQUB    $0B,$0A,$0C,$0D,$0D,$16,$16,$0A
        EQUB    $0B,$0A,$0C,$8E,$18,$0B,$0A,$0C
        EQUB    $FF,$C1,$86,$18,$82,$1A,$C2,$84
        EQUB    $00,$C1,$8C,$1B,$C2,$88,$00,$C1
        EQUB    $86,$18,$82,$1A,$C2,$84,$00,$C1
        EQUB    $8C,$1B,$C2,$88,$00,$C1,$86,$1A
        EQUB    $82,$1B,$C2,$84,$00,$C1,$8C,$1D
        EQUB    $C2,$84,$00,$C1,$16,$86,$1B,$82
        EQUB    $1A,$C2,$84,$00,$C1,$8C,$18,$C2
        EQUB    $88,$00,$FF,$C1,$82,$24,$27,$2B
        EQUB    $30,$C2,$84,$00,$C1,$82,$24,$27
        EQUB    $2B,$86,$30,$C2,$88,$00,$C1,$82
        EQUB    $24,$27,$2C,$30,$C2,$84,$00,$C1
        EQUB    $82,$24,$27,$2C,$86,$30,$C2,$88
        EQUB    $00,$C1,$82,$22,$26,$29,$2E,$C2
        EQUB    $84,$00,$C1,$82,$22,$26,$29,$86
        EQUB    $2E,$C2,$88,$00,$C1,$82,$24,$27
        EQUB    $2B,$30,$C2,$84,$00,$C1,$82,$24
        EQUB    $27,$2B,$86,$30,$C2,$88,$00,$C1
        EQUB    $86,$22,$82,$26,$C2,$84,$00,$C1
        EQUB    $84,$27,$88,$29,$C2,$88,$00,$C1
        EQUB    $86,$22,$82,$26,$C2,$84,$00,$C1
        EQUB    $27,$86,$29,$82,$27,$C2,$84,$00
        EQUB    $C1,$26,$C1,$86,$24,$82,$26,$C2
        EQUB    $84,$00,$C1,$84,$27,$88,$2B,$C2
        EQUB    $00,$C1,$86,$24,$82,$1F,$C2,$84
        EQUB    $00,$C1,$18,$C2,$00,$82,$00,$00
        EQUB    $84,$00,$82,$00,$00,$FF,$CE,$88
        EQUB    $6B,$0C,$84,$18,$CD,$6A,$0C,$CE
        EQUB    $86,$6B,$0C,$CD,$6A,$0E,$84,$0F
        EQUB    $CE,$88,$6B,$08,$84,$14,$CD,$6A
        EQUB    $03,$CE,$86,$6B,$08,$CD,$6A,$03
        EQUB    $84,$08,$CE,$88,$6B,$0A,$84,$16
        EQUB    $CD,$6A,$0A,$CE,$86,$6B,$0F,$CD
        EQUB    $6A,$0E,$84,$0A,$CE,$86,$6B,$0C
        EQUB    $CD,$6A,$0C,$84,$0A,$CE,$6B,$0C
        EQUB    $CD,$6A,$07,$CE,$6B,$05,$CD,$6A
        EQUB    $03,$FF,$FE,$F4,$CC,$98,$65,$27
        EQUB    $82,$62,$2B,$6C,$2B,$62,$2B,$6D
        EQUB    $2B,$A0,$60,$30,$FF,$98,$61,$2E
        EQUB    $88,$64,$26,$82,$62,$2B,$6C,$2B
        EQUB    $9C,$65,$27,$FF,$90,$61,$2E,$64
        EQUB    $32,$A0,$65,$33,$FF,$FE,$F4,$DB
        EQUB    $84,$3C,$D1,$62,$2B,$6C,$2B,$6D
        EQUB    $2B,$62,$2B,$6C,$2B,$65,$27,$64
        EQUB    $26,$63,$27,$86,$6E,$27,$E2,$94
        EQUB    $61,$2C,$DB,$84,$3C,$D1,$6D,$29
        EQUB    $63,$29,$61,$2E,$6D,$29,$63,$29
        EQUB    $70,$26,$64,$26,$65,$27,$86,$6F
        EQUB    $27,$E2,$94,$65,$27,$B0,$63,$29
        EQUB    $88,$29,$84,$64,$26,$A4,$65,$27
        EQUB    $CF,$82,$20,$84,$20,$82,$1D,$84
        EQUB    $1D,$82,$1A,$84,$1A,$82,$18,$84
        EQUB    $16,$D0,$88,$FD,$04,$24,$01,$FF
        EQUB    $CE,$88,$6B,$0A,$84,$0A,$CD,$6A
        EQUB    $05,$CE,$86,$6B,$0A,$CD,$6A,$0C
        EQUB    $84,$0E,$CE,$88,$6B,$0A,$84,$16
        EQUB    $CD,$6A,$05,$CE,$86,$6B,$0A,$CD
        EQUB    $6A,$0C,$84,$0E,$CE,$88,$6B,$0C
        EQUB    $84,$0C,$CD,$6A,$0C,$CE,$86,$6B
        EQUB    $0F,$CD,$6A,$0E,$84,$0A,$CE,$86
        EQUB    $6B,$0C,$CD,$24,$CE,$84,$18,$CD
        EQUB    $13,$CE,$16,$CD,$11,$CE,$13,$FF
        EQUB    $D2,$84,$1F,$1D,$1F,$20,$22,$20
        EQUB    $1F,$1D,$FF,$D2,$88,$1F,$1F,$22
        EQUB    $1F,$1F,$1F,$22,$1F,$FF,$E4,$D2
        EQUB    $88,$1D,$20,$20,$1D,$1D,$20,$20
        EQUB    $84,$1D,$FF,$CE,$88,$6B,$07,$C2
        EQUB    $84,$00,$CD,$82,$6A,$07,$07,$CE
        EQUB    $84,$6B,$07,$07,$C2,$00,$CE,$07
        EQUB    $FF,$FE,$F4,$D3,$98,$2B,$84,$29
        EQUB    $2B,$A0,$27,$8C,$26,$22,$A0,$24
        EQUB    $88,$2B,$98,$2E,$88,$30,$8C,$2D
        EQUB    $29,$88,$2D,$FF,$A0,$A0,$2B,$FF
        EQUB    $A0,$2B,$CF,$82,$18,$84,$18,$82
        EQUB    $18,$84,$18,$82,$18,$84,$18,$82
        EQUB    $15,$84,$12,$10,$0E,$FF,$CE,$86
        EQUB    $6B,$08,$CD,$6A,$08,$84,$6B,$08
        EQUB    $CE,$88,$6A,$0A,$CD,$6A,$07,$CE
        EQUB    $86,$6B,$0C,$CD,$6A,$0C,$84,$6B
        EQUB    $0E,$CE,$6A,$0F,$CD,$0E,$6B,$0C
        EQUB    $6A,$07,$CE,$86,$6B,$08,$CD,$6A
        EQUB    $08,$84,$08,$CE,$88,$6B,$0A,$CD
        EQUB    $6A,$07,$CE,$86,$0C,$CD,$6B,$0F
        EQUB    $84,$6A,$0E,$CE,$86,$6B,$0C,$CD
        EQUB    $6A,$0A,$84,$6B,$07,$FF,$FE,$F4
        EQUB    $D3,$86,$61,$3C,$3C,$84,$3C,$88
        EQUB    $3E,$3A,$86,$3E,$9A,$3C,$86,$3C
        EQUB    $3C,$84,$3F,$88,$3E,$41,$A0,$FD
        EQUB    $1A,$41,$43,$FF,$CB,$88,$62,$2B
        EQUB    $C2,$84,$00,$CB,$62,$2B,$88,$63
        EQUB    $29,$C2,$84,$00,$CB,$88,$29,$84
        EQUB    $65,$27,$C2,$00,$CB,$27,$88,$27
        EQUB    $C2,$84,$00,$CB,$63,$29,$FF,$FE
        EQUB    $F4,$CC,$98,$65,$27,$82,$62,$2B
        EQUB    $6C,$2B,$62,$2B,$6D,$2B,$FC,$28
        EQUB    $A0,$60,$30,$FF,$D7,$A0,$1F,$90
        EQUB    $29,$29,$A0,$24,$FD,$85,$24,$23
        EQUB    $1F,$90,$29,$29,$A0,$30,$FD,$87
        EQUB    $30,$2F,$D6,$A0,$A0,$2B,$FF,$FE
        EQUB    $F2,$D5,$A0,$0C,$0A,$08,$07,$0C
        EQUB    $0A,$08,$07,$D6,$A0,$A0,$1B,$FF
        EQUB    $F8,$D7,$90,$29,$27,$A0,$2B,$98
        EQUB    $26,$A8,$23,$90,$29,$27,$A0,$2B
        EQUB    $98,$32,$90,$2F,$D6,$A0,$A0,$0C
        EQUB    $FF,$F0,$F0,$FF,$00,$00,$FF,$4C
        EQUB    $0A,$A1,$4C,$93,$A1,$4C,$7B,$A1
        EQUB    $00,$A0,$00,$8C,$94,$A1

.BeebDisEndAddr
SAVE "../out/player.bin",BeebDisStartAddr,BeebDisEndAddr

