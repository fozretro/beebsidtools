\ SIDPELK (Electron) — BeebAsm port of Dominic Beesley's SIDPLAY (sidpl.s,
\ sidplay-build / Stardot), adapted for the Electron.
\ Link order: player + mul
\ Load/exec $4800; image padded to $1000

ORG &4800
.start_img



zPTR            = $60                  ; general pointer
zPTR2           = $62                  ; general pointer
zA_TMP          = $64
zTMP0           = $65
zTMP1           = $66
zTMP2           = $67
zTMP3           = $68
zMSGTMPA        = $69
zMSGIX          = $6A
zMSGCOL         = $6B
zMSGFG          = $6C                  ; foreground colour bitmask
zMSGPTR		= $6D
zMSGPTR2	= $6F
zMSGTMP0	= $71
zMSGTMP1	= $72
zCURTUNE	= $73

EVENTV          = $220

OSBYTE          = $FFF4
OSASCI          = $FFE3
OSFILE          = $FFDD
OSCLI           = $FFF7
OSWRCH          = $FFEE
OSNEWL          = $FFE7

TUNE_INIT       = $19F8
TUNE_PLAY       = $19FA
TUNE_NUM        = $19FC
TUNE_BRKTAB     = $19FE
TUNE_CODE       = $1A00

SID_COPY_BASE   = $720
SID_BASE        = $FC20


.start
                ; detect if a master and replace get char vector if necessary

                ; detect if a master and replace get char vector if necessary

{
                lda     #0
                ldx     #1
                jsr     OSBYTE
                cpx     #3
                bcc     sk1

                ; its a master setup char bit get vector
                lda     #LO(get_ch_bits_MA)
                sta     vec_getchbits
                lda     #HI(get_ch_bits_MA)
                sta     vec_getchbits + 1

.sk1
                jmp main



}
.field_ctr
{
        EQUD 0
}
.old_field_ctr
{
        EQUB 0
}
.old_eventv
{
        EQUW 0
}
._osfile_blk
{
        SKIP 18
}
._osfile_menu_m
{
        EQUB "M.MENU", 13

}
.menu_sel
{
        EQUB 0
}
.menu_off
{
        EQUB 0
}
.menu_run
{
        EQUB 0

}
.vec_getchbits
{
        EQUW get_ch_bits_BBC

}
.get_ch_bits
{
        jmp     (vec_getchbits)

}
.get_ch_bits_BBC
{
        lda     (zMSGPTR), y
                rts
}
.get_ch_bits_MA
{
        php
		sei
                lda     $F4
                pha
                ora     #$80
                sta     $FE30
                lda     zMSGPTR + 1
                pha
                sec
                sbc     #$C0 - $89
                sta     zMSGPTR + 1
                lda     (zMSGPTR), Y
                sta     zMSGTMPA
                pla
                sta     zMSGPTR + 1;                lda     $FE30
		pla
                sta     $FE30
                lda     zMSGTMPA
                plp
                rts



}
.str_coff
{
        EQUB 23,0,10,32,0,0,0,0,0,0,$FF

}
.coff
{
        ldx     #0
.l1
        lda     str_coff,X
                bmi     s1
                jsr     OSWRCH
                inx
                bne     l1
.s1
        rts


}
.main
{
        ; mode 6
		lda	#22
		jsr	OSWRCH
		lda	#6
		jsr	OSWRCH

		jsr	coff

.s1
        ; cursor editing off
                lda     #4
                ldx     #1
                jsr     OSBYTE

                ; load menu data
                ldy     #0
                ldx     #18
                lda     #LO(_osfile_blk)
                sta     zPTR
                lda     #HI(_osfile_blk)
                sta     zPTR + 1
                lda     #0
                jsr     clr_blk

                lda     #LO(_osfile_menu_m)
                sta     _osfile_blk
                lda     #HI(_osfile_menu_m)
                sta     _osfile_blk + 1
                lda     #LO(menu)
                sta     _osfile_blk + 2
                lda     #HI(menu)
                sta     _osfile_blk + 3
                lda     #$FF
                ldx     #LO(_osfile_blk)
                ldy     #HI(_osfile_blk)
                jsr     OSFILE


}
.init_menu
{
                lda     #0
                sta     menu_sel
                sta     menu_off
}
.menu_loop
{
        jsr     show_men
}
.menu_loop_nowt
{
                lda     #$81
                ldx     #0
                ldy     #0
                jsr     OSBYTE
                cpy     #$1b
                beq     men_esc
                cpx     #$8b
                beq     men_up
                cpx     #$8a
                beq     men_dn
                cpx     #13
                beq     men_sel
                jmp     menu_loop_nowt



.men_esc
        lda     #126
                jsr     OSBYTE          ;acknowledge esc
                rts

.men_up
        dec     menu_sel
                bmi     men_up_sk1
                jmp     menu_loop
.men_up_sk1
        lda     #0
                sta     menu_sel
                dec     menu_off
                bmi     men_up_sk2
                jmp     menu_loop
.men_up_sk2
        sta     menu_off
                jmp     menu_loop

.men_dn
        inc     menu_sel
                lda     #9              ;entries on screen
                cmp     menu_sel
                bcc     men_dn_sk1
                jmp     menu_loop
.men_dn_sk1
        sta     menu_sel
                lda     menu
                clc
                sbc     #9
                inc     menu_off
                cmp     menu_off
                bcc     men_dn_sk2
                jmp     menu_loop
.men_dn_sk2
        sta     menu_off
                jmp     menu_loop

.men_sel
        clc
                lda     menu_sel
                adc     menu_off
                sta     menu_run        ; tune to play
                tax
                ldy     #42
                jsr     mulxy           ; menu_run *42
                sec                     ; add 1 to skip length byte
                txa
                adc     #LO(menu)          ; add menu offset
                sta     zPTR
                tya
                adc     #HI(menu)
                sta     zPTR + 1

                lda     #0              ; copy file name to start of screen
                sta     zPTR2
                lda     #$7C
                sta     zPTR2 + 1
                ldx     #10
                ldy     #0
.ll1
        lda     (zPTR),y
                sta     (zPTR2),y
                iny
                dex
                bne     ll1
                lda     #13
                sta     $7c0a

                ; copy filename in zPTR to zPTR2

                ; clear osfile blk
                ldy     #0
                ldx     #18
                lda     #LO(_osfile_blk)
                sta     zPTR
                lda     #HI(_osfile_blk)
                sta     zPTR + 1
                lda     #0
                jsr     clr_blk

                lda     #0
                sta     _osfile_blk
                lda     #$7c
                sta     _osfile_blk + 1
                lda     #$F8
                sta     _osfile_blk + 2
                lda     #$19
                sta     _osfile_blk + 3
                lda     #$FF
                ldx     #LO(_osfile_blk)
                ldy     #HI(_osfile_blk)
                jsr     OSFILE

                lda	$19FD				; default song
                jmp     start_tune


}
.clr_blk
{
        sta     (zPTR), y
                iny
                dex
                bne     clr_blk
                rts

}
SCROLL_START    =      $7100
SCROLL_END      =      $7600

.scroll
{
                ldx     #LO(SCROLL_START)
                stx     scroll_sta+1
                stx     scroll_sta+5
                stx     scroll_sta+9
                stx     scroll_sta+13
                ldx     #HI(SCROLL_START)
                stx     scroll_sta+2
                stx     scroll_sta+6
                stx     scroll_sta+10
                stx     scroll_sta+14

                ldx     #LO(SCROLL_START+8)
                stx     scroll_lda+1
                ldx     #HI(SCROLL_START+8)
                stx     scroll_lda+2

                ldx	#0

}
.scroll_lp
.scroll_lda
{
        lda	$FFFF,x
}
.scroll_sta
{
        sta	$FFFF,x
		inx
		sta	$FFFF,x
		inx
		sta	$FFFF,x
		inx
		sta	$FFFF,x
		inx
		bne	scroll_lp


		ldy	scroll_sta+2
		iny
		sty	scroll_sta+2
                sty     scroll_sta+6
                sty     scroll_sta+10
                sty     scroll_sta+14

		inc	scroll_lda+2
		lda	scroll_sta+2
		cpy	#HI(SCROLL_END)
		bne	scroll_lp
		rts


}
SCROLL_RIGHT    =      SCROLL_START + $138

{
        ALIGN 256
}
.hex_sprites
{
        INCBIN "resources/hexdigs.bin"


}
.show_message
{
                jsr     scroll
                jsr	message1
}
.message1

{
                ldy     zMSGIX
                lda     $19FE
                sta     zMSGPTR2
                lda     $19FF
                sta     zMSGPTR2 + 1
.aa
        lda     (zMSGPTR2),y
                beq     end
                bmi     code

.dochar
                ; get pointer to char (based on $C000)
                sec                                     ; make into index into C000 rom char table
                sbc     #32
                ldx     #0
                stx     zMSGPTR + 1

                asl     A
                rol     zMSGPTR + 1
                asl     A
                rol     zMSGPTR + 1
                asl     A
                rol     zMSGPTR + 1

                sta     zMSGPTR

                lda     #$C0
                clc
                adc     zMSGPTR + 1
                sta     zMSGPTR + 1

                lda     #LO(SCROLL_RIGHT)
                sta     zMSGPTR2
                lda     #HI(SCROLL_RIGHT)
                sta     zMSGPTR2+1
                ldy     #0
                sty     zMSGTMP0                           ; row counter 0..7 in src bitmap
.bmp_loop
        jsr     get_ch_bits
                and     zMSGCOL                         ; and with mask
                beq     s1
                lda     zMSGFG
.s1
        sta     zMSGTMP1                           ; current pixels
                ldy     #3
                lda     (zMSGPTR2),Y
                asl	a
                asl	a
                and	#$CC
                ora     zMSGTMP1
.l1
        sta     (zMSGPTR2),Y
                dey
                bpl     l1

                lda	zMSGTMP0
                and	#1
                bne	odd_row_done
                lda	zMSGPTR2
                ora	#4
                sta	zMSGPTR2
                bne	s2
.odd_row_done
                clc
                lda     zMSGPTR2
                adc     #LO($140-4)
                sta     zMSGPTR2
                lda     zMSGPTR2+1
                adc     #HI($140-4)
                sta     zMSGPTR2+1
.s2
                inc     zMSGTMP0
                ldy     zMSGTMP0
                cpy     #8
                bne     bmp_loop

                ; move to next col / char
                lsr     zMSGCOL
                bcc     skdone
                lda     #$80
                sta     zMSGCOL
                inc     zMSGIX

.skdone
        rts


.end
        jsr     message_reset
                jmp     aa

.code
        pha
		and	#$3
		sta	zMSGFG
		pla
		and	#$6
		asl	a
		asl	a
		asl	a
		ora	zMSGFG
		sta	zMSGFG

		lda	#' '
		jmp	dochar

}
.message_reset
{
                ldy     #0
                sty     zMSGIX
                lda     #$80
                sta     zMSGCOL
                lda     #$33
                sta     zMSGFG
                rts

}
.show_men
                ; set zPTR to first menu screen position
{
                lda     #31
                jsr     OSWRCH
                lda     #0
                jsr     OSWRCH
                jsr     OSWRCH

                lda     #0
                sta     zTMP0
.lp1
        lda     menu_sel
                cmp     zTMP0
                beq     sk_colour
                lda     #' '
                bne     sk_colour2
.sk_colour
        lda     #'>'
.sk_colour2
        jsr     OSWRCH
                clc             ; check to see if we're past end of menu
                lda     zTMP0
                adc     menu_off
                cmp     menu
                bcs     sk1



                tax
                ldy     #42     ; size of menu entry
                jsr     mulxy
                stx     zPTR2
                sty     zPTR2 + 1
                clc
                lda     #LO(menu + 10)     ; note l0 to skip filename
                adc     zPTR2
                sta     zPTR2
                lda     #HI(menu + 10)
                adc     zPTR2 + 1
                sta     zPTR2 + 1
                ldy     #1              ; skip colour / length byte
                ldx     #32
.lp2
        lda     (zPTR2), y
                cmp     #' '
                bcc     s1
                jsr     OSWRCH
.s1
        iny
                dex
                bne     lp2
                jmp     sk2


.sk1
        ldx     #38

.l1
        lda     #' '
                jsr     OSWRCH
                dex
                bne     l1

.sk2
        ; move to next screen line
                jsr     OSNEWL

                inc     zTMP0
                lda     #19
                cmp     zTMP0
                bcs     lp1
                rts


}
REGS_LINE_0	=	$5800
REGS_LINE_1	=	REGS_LINE_0 + 960
REGS_LINE_2	=	REGS_LINE_1 + 960
REGS_LINE_3	=	REGS_LINE_2 + 960
REGS_LINE_4	=	REGS_LINE_3 + 960
REGS_LINE_5	=	REGS_LINE_4 + 960
REGS_LINE_6	=	REGS_LINE_5 + 960

.REGS_LO_TBL
{
        EQUB LO(REGS_LINE_0), LO(REGS_LINE_1), LO(REGS_LINE_2)
        EQUB LO(REGS_LINE_3), LO(REGS_LINE_4), LO(REGS_LINE_5)
}
.REGS_HI_TBL
{
        EQUB HI(REGS_LINE_0), HI(REGS_LINE_1), HI(REGS_LINE_2)
        EQUB HI(REGS_LINE_3), HI(REGS_LINE_4), HI(REGS_LINE_5)

}
.show_sid_regs

{
		lda	#0
		sta	zTMP0				; voice counter
		ldx	#0				; register index
}
.show_sid_regs_voice_lp
{
		jsr	show_sid_start_line

		; freq
		jsr	show_sid_16

		; pulse width
		jsr	show_sid_16

		; ctl
		lda	SID_COPY_BASE,X
		sta	zTMP2
		jsr	show_sid_8

		; atack dur, decay dur
		jsr	show_sid_2_nyb

		; sus level, rel dur
		jsr	show_sid_2_nyb

		inc	zTMP0
		ldy	zTMP0
		jsr	show_sid_start_line


		; ctl icons
		ldy	#7
.iconlp
        rol	zTMP2
		bcc	noicon
		tya
		adc	#$0F
		bne	nexticon
.noicon
        lda	#24
.nexticon
        jsr	big_hex_nyb
		dey
		bpl	iconlp


		inc	zTMP0
		lda	zTMP0
		cmp	#6
		bne	show_sid_regs_voice_lp

		rts

}
.show_sid_start_line
{
		ldy	zTMP0
		lda	REGS_LO_TBL,Y
		sta	zPTR
		lda	REGS_HI_TBL,Y
		sta	zPTR+1
		rts

}
.show_sid_16
{
		lda	SID_COPY_BASE+1,X
		jsr	big_hex_A
		lda	SID_COPY_BASE,X
		jsr	big_hex_A
		inx
		inx
		jsr	big_hex_space
		rts

}
.show_sid_8
{
		lda	SID_COPY_BASE,X
		jsr	big_hex_A
		inx
		jsr	big_hex_space
		rts

}
.show_sid_2_nyb
{
		lda	SID_COPY_BASE,X
		pha
		lsr	a
		lsr	a
		lsr	a
		lsr	a
		jsr	big_hex_nyb
		jsr	big_hex_space
		pla
		and	#$0F
		jsr	big_hex_nyb
		jsr	big_hex_space
		inx
		rts


}
.big_hex_A
{
        pha
		lsr	a
		lsr	a
		lsr	a
		lsr	a
		jsr	big_hex_nyb
		pla
		pha
		and	#$0F
		jsr	big_hex_nyb
		pla
		rts

}
.big_hex_nyb
{
        sta	zPTR2
		pha
		txa
		pha
		tya
		pha

		lda	#0
		asl	zPTR2
		rol	a
		asl	zPTR2
		rol	a
		asl	zPTR2
		rol	a
		asl	zPTR2
		rol	a
		asl	zPTR2
		rol	a
		adc	#HI(hex_sprites)
		sta	zPTR2+1

		ldy	#0
		jsr	big_hex_nyb_row
		clc
		lda	zPTR
		pha
		adc	#LO(320-16)
		sta	zPTR
		lda	zPTR+1
		pha
		adc	#HI(320-16)
		sta	zPTR+1
		jsr	big_hex_nyb_row
		pla
		sta	zPTR+1
		pla
		adc	#16
		sta	zPTR
		bcc	s1
		inc	zPTR+1
.s1
		pla
		tay
		pla
		tax
		pla
		rts

}
.big_hex_nyb_row
{
		ldx	#16
.l1
        lda	(zPTR2),Y
		sta	(zPTR),Y
		iny
		dex
		bne	l1
		rts


}
.big_hex_space
{
		pha
		clc
		lda	zPTR
		adc	#8
		sta	zPTR
		bcc	s1
		inc	zPTR+1
.s1
        pla
		rts


}
.start_tune
{
.sk1
                jsr     init_tune

                jsr     screen_play

                ; setup vectors
                sei                     ; disable interrupts while we mess with vectors
                ; Grab the EVENTV vector
                lda     EVENTV
                sta     old_eventv
                lda     EVENTV + 1
                sta     old_eventv + 1
                lda     #LO(eventv_trap)
                sta     EVENTV
                lda     #HI(eventv_trap)
                sta     EVENTV + 1

                cli

                ; enable the vsync event
                lda     #14
                ldx     #4
                jsr     OSBYTE

                ;jmp     tune_loop


}
.tune_loop
{
        lda     field_ctr
.lp
        cmp     field_ctr
                beq     lp             ; wait for vsync
                lda     field_ctr
                sta     old_field_ctr

;                jsr     play_tune


                jsr	show_sid_regs

                lda     #$81
                ldx     #0
                ldy     #0
                jsr     OSBYTE
                cpy     #$1b
                beq     tune_loop_esc
                bcs	sknokey
                cpx	#'<'
                beq	tune_loop_song_prev
                cpx	#','
                beq	tune_loop_song_prev
                cpx	#'>'
                beq	tune_loop_song_next
                cpx	#'.'
                beq	tune_loop_song_next

.sknokey


                jmp     tune_loop

}
.tune_loop_song_prev
{
		ldx	zCURTUNE
		cpx	#2
		bcc	tune_loop
		dex
		txa
		pha

		jsr	tune_stop

		pla
		jmp	start_tune

}
.tune_loop_song_next
{
		ldx	zCURTUNE
		cpx	$19FC
		bcs	tune_loop
		inx
		txa
		pha

		jsr	tune_stop

		pla
		jmp	start_tune


}
.tune_loop_esc
{
                lda     #126
                jsr     OSBYTE          ;acknowledge esc

                jsr	tune_stop

                jmp     main

}
.tune_stop
{
                php
                sei

                lda     old_eventv
                sta     EVENTV
                lda     old_eventv+1
                sta     EVENTV+1

                lda     #13
                ldx     #4
                jsr     OSBYTE

                plp

                jmp	shut_up



}
.play_tune
{
        jmp     (TUNE_PLAY)
}
.init_tune
{
        sta	zCURTUNE
		tax
		dex
		txa
                jmp     (TUNE_INIT)

}
.eventv_trap
{
                cmp     #4              ; vsync
                bne     sk
                inc     field_ctr       ; increment the field counter
                bne     sk2
                inc     field_ctr + 1
                bne     sk2
                inc     field_ctr + 2
                bne     sk2
                inc     field_ctr + 3

.sk2
		pha
		txa
		pha
		tya
		pha
		jsr     play_tune

                jsr     show_message
                pla
                tay
                pla
                tax
                pla
.sk

                jmp     (old_eventv)


}
.screen_play
{
        lda     #22
                jsr     OSWRCH
                lda     #5
                jsr     OSWRCH
                jsr     message_reset
                jsr	coff

                lda	#19
                jsr	OSWRCH
                lda	#2
                jsr	OSWRCH
                lda	#2
                jsr	OSWRCH
                jsr	three0

                lda	#19
                jsr	OSWRCH
                lda	#3
                jsr	OSWRCH
                lda	#4
                jsr	OSWRCH
                jsr	three0

		lda	#31
		jsr	OSWRCH
		lda	#0
		jsr	OSWRCH
		lda	#31
		jsr	OSWRCH

		ldx	zCURTUNE
		lda	#'<'
		cpx	#2
		bcs	sge
		lda	#' '
.sge
        jsr	OSWRCH
		ldx	zCURTUNE
.lp
        txa
		clc
		adc	#'0'
		jsr	OSWRCH
		lda	#'>'
		ldx	zCURTUNE
		cpx	$19FC
		bcc	slt2
		lda	#' '
.slt2
        jsr	OSWRCH

                rts

}
.three0
{
		lda	#0
		jsr	OSWRCH
		jsr	OSWRCH
		jmp	OSWRCH


}
.shut_up
{
        ldx	#23
		lda	#0
.L1
        sta	SID_BASE, X
		dex
		bpl	L1
		rts

}
.menu
{
        SKIP 1261      ; menu space 1 byte contains number of tunes followed by 10 chars of filename


}

INCLUDE "../../lib/mul.asm"

.end_code
SKIPTO start_img + &1000
.end_img

SAVE "sidpelk.o", start_img, end_img, start_img
