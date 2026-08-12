; taken from http://codebase64.org/doku.php?id=base:8bit_multiplication_16bit_product



;------------------------
; 8bit * 8bit = 16bit multiply
; Multiplies "num1" by "num2" and stores result in .A (low byte, also in .X) and .Y (high byte)
; uses extra zp var "num1Hi"

; .X and .Y get clobbered.  Change the tax/txa and tay/tya to stack or zp storage if this is an issue.
;  idea to store 16-bit accumulator in .X and .Y instead of zp from bogax

; In this version, both inputs must be unsigned
; Remove the noted line to turn this into a 16bit(either) * 8bit(unsigned) = 16bit multiply.

.mulxy
{
        pha
          stx       zTMP1
          sty       zTMP2
          lda #$00
          tay
          sty       zTMP3
          beq       entloop

.doAdd
        clc
          adc zTMP1
          tax

          tya
          adc zTMP3
          tay
          txa

.loop
        asl zTMP1
          rol zTMP3
.entloop
        ; accumulating multiply entry point (enter with .A=lo, .Y=hi)
          lsr zTMP2
          bcs doAdd
          bne loop
          pla
          rts

}
