\ SIDPLAY (BBC) — BeebAsm port of Dominic Beesley's sidpl.s
\ (sidplay-build / Stardot). Mode 7 screens from sidframe_mo7 / sidmenu_mo7.
\ Link order: player + play_screen + menu_screen + mul
\ Load/exec $6000; image padded to $1C00

ORG &6000
.start_img



; Below HOH C64 ZP ($73+). Do not use $70-$7A — the tune owns those.
zPTR            = $40                  ; general pointer
zPTR2           = $42                  ; general pointer
zA_TMP          = $44
zTMP0           = $45
zTMP1           = $46
zTMP2           = $47
zTMP3           = $48
zMSGTMPA        = $49
zCURTUNE        = $4A

zMOSBRKPTR      = $FD                  ; where MOS stores pointer to byte after brk

BRKV            = $202
IRQ1V           = $204

OSBYTE          = $FFF4
OSASCI          = $FFE3
OSFILE          = $FFDD
OSCLI           = $FFF7
OSWRCH          = $FFEE

TUNE_INIT       = $19F8
TUNE_PLAY       = $19FA
TUNE_NUM        = $19FC
TUNE_BRKTAB     = $19FE
TUNE_CODE       = $1A00

SID_COPY_BASE   = $0720
SID_BASE        = $FC20
; ripsid control-reg trampolines set these when gate is written 0 (mid-play pulse).
GATE_PULSE      = $0740

; HOH / -k tunes keep voice state in MOS ZP ($70-$FF).
TUNE_ZP_BASE    = $70
TUNE_ZP_LEN     = $90               ; $70-$FF

; check_key X = 256 - INKEY number (same as Gundroid / negative INKEY).
KEY_ESC         = 256 - 113
KEY_UP          = 256 - 58
KEY_DOWN        = 256 - 42
KEY_RETURN      = 256 - 74
KEY_COMMA       = 256 - 103         ; , / <  (song prev)
KEY_PERIOD      = 256 - 104         ; . / >  (song next)

; OSBYTE A= / service X=
OSBYTE_OS_VERSION       = 0         ; X=1 → host type in X
OSBYTE_CURSOR_EDIT      = 4         ; X=0/1 cursor editing
OSBYTE_SERVICE          = 143       ; sideways ROM service
SERVICE_RELEASE_NMI     = 11
SERVICE_CLAIM_NMI       = 12
NMI_OWNER_PRIVATE       = 255       ; Y on claim (non-filing-system)
RESET_VEC               = $FFFC
SHEILA_MISC_CTL         = $FEA0     ; BeebWiki reset hardware
TUBE_ULA                = $FEE0
TUBE_RESET_ASSERT       = $A0
TUBE_RESET_RELEASE      = $20
HW_RESET_PULSE          = $C0

; System VIA (SHEILA) / User VIA / NMI stub
SYSVIA_ORB      = $FE40
SYSVIA_DDRB     = $FE42
SYSVIA_DDRA     = $FE43
SYSVIA_T1C_L    = $FE44
SYSVIA_T1C_H    = $FE45
SYSVIA_ACR      = $FE4B
SYSVIA_IFR      = $FE4D
SYSVIA_IER      = $FE4E
SYSVIA_ORA_NH   = $FE4F            ; port A, no handshake (keyboard)
USERVIA_IER     = $FE6E
NMI_VECTOR      = $D00

VIA_IER_DISABLE_ALL = $7F
VIA_IFR_CLEAR_ALL   = $FF
VIA_IFR_CA1         = $02          ; VSync
VIA_IER_SET_MASK    = $80
OPCODE_RTI          = $40

; check_key VIA setup (Gundroid / Retrosoftware pattern)
KEY_DDRB        = $0F
KEY_ORB         = $03
KEY_DOWN_MASK   = $80


.start
                ; detect if a master and replace get char vector if necessary

{
                lda     #OSBYTE_OS_VERSION
                ldx     #1
                jsr     OSBYTE
                cpx     #0
                beq     elk
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
.elk
{
                ldx     #LO(str_elk)
                ldy     #HI(str_elk)
                jsr     OSCLI
}
.str_elk
{
        EQUB "SIDPELK",13,0
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
.attack_tab
{
        ; rough table of vsyncs until full attack acheived
                                ; todo make this 16 bit?
        EQUB 255
        EQUB 255
        EQUB 255
        EQUB 255
        EQUB 128
        EQUB 128
        EQUB 85
        EQUB 64
        EQUB 52
        EQUB 22
        EQUB 11
        EQUB 7
        EQUB 5
        EQUB 2
        EQUB 1
        EQUB 1

}
.decay_tab
{
        ; rough table of vsyncs until full attack acheived
                                ; todo make this 16 bit?
        EQUB 255
        EQUB 255
        EQUB 128
        EQUB 64
        EQUB 42
        EQUB 32
        EQUB 26
        EQUB 22
        EQUB 17
        EQUB 7
        EQUB 4
        EQUB 3
        EQUB 2
        EQUB 1
        EQUB 1
        EQUB 1


}
._scr_ptr
{
        EQUB 0
}
.key_prev_esc
{
        EQUB 0
}
.key_prev_prev
{
        EQUB 0
}
.key_prev_next
{
        EQUB 0
}
.key_prev_up
{
        EQUB 0
}
.key_prev_dn
{
        EQUB 0
}
.key_prev_ret
{
        EQUB 0
}
.mos_parked
{
        EQUB 0
}
.last_menu_run
{
        EQUB $FF            ; $FF = no tune loaded yet
}
.save_brkv_lo
{
        EQUB 0
}
.save_brkv_hi
{
        EQUB 0
}
.save_via_orb
{
        EQUB 0
}
.save_via_ddrb
{
        EQUB 0
}
.save_via_ddra
{
        EQUB 0
}
.save_via_acr
{
        EQUB 0
}
.save_via_t1lo
{
        EQUB 0
}
.save_via_t1hi
{
        EQUB 0
}
.save_via_ier
{
        EQUB 0
}
.save_user_ier
{
        EQUB 0
}
.save_irq1v_lo
{
        EQUB 0
}
.save_irq1v_hi
{
        EQUB 0
}
.save_nmi_d00
{
        EQUB 0
}
.save_nmi_y
{
        EQUB 0
}
.play_timer_on
{
        EQUB 0
}
._osfile_blk
{
        SKIP 18
}
._osfile_menu_m
{
        EQUB "M.MENU", 13
}
._osfile_name
{
        SKIP 11              ; DFS name + CR (not on the Mode 7 screen)

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
        lda     (zPTR), y
                rts
; Master font read. During play, tune owns $70-$FF so $F4 is stale —
; use the MOS snapshot byte instead.
}
.get_ch_bits_MA
{
        php
		sei
                lda     mos_zp_save + ($F4 - TUNE_ZP_BASE)
                pha
                ora     #$80
                sta     $FE30
                lda     zPTR + 1
                pha
                sec
                sbc     #$C0 - $89
                sta     zPTR + 1
                lda     (zPTR), Y
                sta     zMSGTMPA
                pla
                sta     zPTR + 1
		pla
                sta     $FE30
                lda     zMSGTMPA
                plp
                rts




}
.scrprt
{
        sta     zA_TMP          ; print a char
                txa
                pha
                ldx     _scr_ptr
                lda     zA_TMP
                sta     $7F20, x
                inx
                stx     _scr_ptr
                pla
                tax
                lda     zA_TMP
                rts

}
.printbyte
{
        pha
                lsr a
                lsr a
                lsr a
                lsr a
                jsr printnibble
                pla
}
.printnibble
{
        and     #$0F
                cmp     #$0A
                bcc     printb_num
                adc     #$06
}
.printb_num
{
        adc     #$30
                jmp     scrprt

}
.main
{
        ; mode 7
                lda     #22
                jsr     OSASCI
                lda     #7
                jsr     OSASCI

                ; cursor editing off
                lda     #OSBYTE_CURSOR_EDIT
                ldx     #1
                jsr     OSBYTE

                jsr     coff

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

                lda     #LO(menu_screen)
                sta     zPTR
                lda     #HI(menu_screen)
                sta     zPTR + 1
                jsr     unpack_screen

                lda     BRKV
                sta     save_brkv_lo
                lda     BRKV + 1
                sta     save_brkv_hi
                lda     #$FF
                sta     last_menu_run
                sei
                jsr     zp_save_mos
                jsr     mos_leave

}
.init_menu
{
                lda     #0
                sta     menu_sel
                sta     menu_off
                jsr     wait_menu_keys_up
                jsr     seed_menu_keys

}
.menu_loop
{
        jsr     wait_frame
                jsr     show_men

                ; Key-up edges.
                ldx     #KEY_ESC
                jsr     check_key
                cmp     key_prev_esc
                sta     key_prev_esc
                beq     mup
                cmp     #0
                beq     men_esc
.mup
        ldx     #KEY_UP
                jsr     check_key
                cmp     key_prev_up
                sta     key_prev_up
                beq     mdn
                cmp     #0
                beq     men_up
.mdn
        ldx     #KEY_DOWN
                jsr     check_key
                cmp     key_prev_dn
                sta     key_prev_dn
                beq     mret
                cmp     #0
                beq     men_dn
.mret
        ldx     #KEY_RETURN
                jsr     check_key
                cmp     key_prev_ret
                sta     key_prev_ret
                beq     menu_loop
                cmp     #0
                beq     men_sel
                jmp     menu_loop

.men_esc
        jsr     mos_enter
                jmp     machine_reset

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

                ; DFS filename → private buffer (not Mode 7 RAM).
                ldx     #10
                ldy     #0
.ll1
        lda     (zPTR),y
                sta     _osfile_name,y
                iny
                dex
                bne     ll1
                lda     #13
                sta     _osfile_name + 10

                ; clear osfile blk
                ldy     #0
                ldx     #18
                lda     #LO(_osfile_blk)
                sta     zPTR
                lda     #HI(_osfile_blk)
                sta     zPTR + 1
                lda     #0
                jsr     clr_blk

                lda     #LO(_osfile_name)
                sta     _osfile_blk
                lda     #HI(_osfile_name)
                sta     _osfile_blk + 1
                lda     #$F8
                sta     _osfile_blk + 2
                lda     #$19
                sta     _osfile_blk + 3

                ; Same menu entry already in RAM — skip DFS (no reload).
                lda     menu_run
                cmp     last_menu_run
                beq     loaded

                jsr     mos_enter               ; DFS needs MOS + NMI
                lda     #$FF
                ldx     #LO(_osfile_blk)
                ldy     #HI(_osfile_blk)
                jsr     OSFILE
                jsr     mos_leave
                lda     menu_run
                sta     last_menu_run

.loaded
        lda     $19FD                   ; default song
                jmp     start_tune

}
.show_men
                ; set zPTR to first menu screen position
                men_scr_start = $7C00 + 4 + 4 * 40
{
                lda     #LO(men_scr_start)
                sta     zPTR
                lda     #HI(men_scr_start)
                sta     zPTR + 1
                lda     #0
                sta     zTMP0
.lp1
        lda     menu_sel
                cmp     zTMP0
                beq     sk_colour
                lda     #130    ; alpha green
                bne     sk_colour2
.sk_colour
        lda     #129
.sk_colour2
        ldy     #0
                sta     (zPTR),y

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
                sta     (zPTR), y
                iny
                dex
                bne     lp2
                jmp     sk2


.sk1
        ldy     #0
                ldx     #33
                lda     #32
                jsr     clr_blk

.sk2
        ; move to next screen line
                clc
                lda     #40
                adc     zPTR
                sta     zPTR
                lda     #0
                adc     zPTR + 1
                sta     zPTR + 1

                inc     zTMP0
                lda     #19
                cmp     zTMP0
                bcs     lp1
                rts



}
.show_sid_regs
{
                ldx     #0                      ; print out SID registers to screen
                stx     _scr_ptr
.lp2
        lda     SID_COPY_BASE, X
                jsr     printbyte

                lda     #32
                jsr     scrprt

                cpx     #6
                beq     ss1
                cpx     #13
                beq     ss1
                cpx     #20
                beq     ss1
                cpx     #24
                beq     ss2
                bne     ss3
.ss1
        lda     _scr_ptr
                adc     #18
                sta     _scr_ptr
                jmp     ss3
.ss2
        lda     _scr_ptr
                adc     #27
                sta     _scr_ptr
                jmp     ss3
.ss3
        inx
                cpx     #25
                bne     lp2

.lp3
        lda     SID_BASE, X
                jsr     printbyte

                lda     #32
                jsr     scrprt
                inx
                cpx     #29
                bne     lp3
                rts

}
.show_freq_vol
{
                lda     #LO($7C00 + 5 + 1 * 40)      ; zPTR = line 1
                sta     zPTR
                lda     #HI($7C00 + 5 + 1 * 40)
                sta     zPTR + 1

                ldx     #0                     ; channel 0
                jsr     showfrq

                lda     #LO($7C00 + 5 + 4 * 40)      ; zPTR = line 4
                sta     zPTR
                lda     #HI($7C00 + 5 + 4 * 40)
                sta     zPTR + 1

                ldx     #7                     ; channel 1
                jsr     showfrq

                lda     #LO($7C00 + 5 + 7 * 40)      ; zPTR = line 7
                sta     zPTR
                lda     #HI($7C00 + 5 + 7 * 40)
                sta     zPTR + 1

                ldx     #14                      ; channel 2
                jsr     showfrq




                lda     #LO($7C00 + 7 + 11 * 40)      ; zPTR = 7x11
                sta     zPTR
                lda     #HI($7C00 + 7 + 11 * 40)
                sta     zPTR + 1

                ldx     #0                      ; channel 0
                jsr     showvol

                lda     #LO($7C00 + 19 + 11 * 40)      ; zPTR = 19x11
                sta     zPTR
                lda     #HI($7C00 + 19 + 11 * 40)
                sta     zPTR + 1

                ldx     #1                      ; channel 0
                jsr     showvol

                lda     #LO($7C00 + 31 + 11 * 40)      ; zPTR = 19x11
                sta     zPTR
                lda     #HI($7C00 + 31 + 11 * 40)
                sta     zPTR + 1

                ldx     #2                      ; channel 0
                jmp     showvol

; A = song number.
}
.start_tune
{
                pha
                jsr     zp_restore_mos          ; MOS baseline under tune init
                pla
                jsr     init_tune
                jsr     zp_save_tune            ; tune ZP stays live
                jsr     reset_vol_state
                jsr     screen_play
                jsr     wait_play_keys_up
                jsr     seed_play_keys
                jmp     tune_loop

; A = song number.
}
.restart_tune
{
                pha
                jsr     shut_up
                pla
                jsr     init_tune
                jsr     zp_save_tune
                jsr     reset_vol_state
                jsr     screen_play
                jsr     wait_play_keys_up
                jsr     seed_play_keys

}
.tune_loop
{
        jsr     wait_frame
                jsr     play_tune

                jsr     show_freq_vol
                jsr     show_message
                jsr     show_sid_regs

                ; Key-up edges.
                ldx     #KEY_ESC
                jsr     check_key
                cmp     key_prev_esc
                sta     key_prev_esc
                beq     kprev
                cmp     #0
                beq     tune_loop_esc
.kprev
        ldx     #KEY_COMMA
                jsr     check_key
                cmp     key_prev_prev
                sta     key_prev_prev
                beq     knext
                cmp     #0
                beq     tune_loop_song_prev
.knext
        ldx     #KEY_PERIOD
                jsr     check_key
                cmp     key_prev_next
                sta     key_prev_next
                beq     kdone
                cmp     #0
                beq     tune_loop_song_next
.kdone
        jmp     tune_loop

}
.tune_loop_song_prev
{
		ldx	zCURTUNE
		cpx	#2
		bcc	tune_loop
		dex
		txa
		jmp	restart_tune

}
.tune_loop_song_next
{
		ldx	zCURTUNE
		cpx	$19FC
		bcs	tune_loop
		inx
		txa
		jmp	restart_tune

}
.tune_loop_esc
{
                jsr     shut_up
                jsr     zp_restore_mos
                lda     #LO(menu_screen)
                sta     zPTR
                lda     #HI(menu_screen)
                sta     zPTR + 1
                jsr     unpack_screen
                jsr     wait_menu_keys_up
                jsr     seed_menu_keys
                jmp     menu_loop

}
.wait_play_keys_up
{
                ldx     #KEY_ESC
                jsr     check_key
                bne     wait_play_keys_up
                ldx     #KEY_COMMA
                jsr     check_key
                bne     wait_play_keys_up
                ldx     #KEY_PERIOD
                jsr     check_key
                bne     wait_play_keys_up
                rts

}
.seed_play_keys
{
                ldx     #KEY_ESC
                jsr     check_key
                sta     key_prev_esc
                ldx     #KEY_COMMA
                jsr     check_key
                sta     key_prev_prev
                ldx     #KEY_PERIOD
                jsr     check_key
                sta     key_prev_next
                rts

}
.wait_menu_keys_up
{
                ldx     #KEY_ESC
                jsr     check_key
                bne     wait_menu_keys_up
                ldx     #KEY_UP
                jsr     check_key
                bne     wait_menu_keys_up
                ldx     #KEY_DOWN
                jsr     check_key
                bne     wait_menu_keys_up
                ldx     #KEY_RETURN
                jsr     check_key
                bne     wait_menu_keys_up
                rts

}
.seed_menu_keys
{
                ldx     #KEY_ESC
                jsr     check_key
                sta     key_prev_esc
                ldx     #KEY_UP
                jsr     check_key
                sta     key_prev_up
                ldx     #KEY_DOWN
                jsr     check_key
                sta     key_prev_dn
                ldx     #KEY_RETURN
                jsr     check_key
                sta     key_prev_ret
                rts

; MOS on for DFS / clean exit; otherwise parked (SEI + poll VSync).
; mos_enter restores boot BRKV before OSFILE (tune may have redirected it).
}
.mos_enter
{
                lda     mos_parked
                beq     done
                sei
                jsr     deinit_play_poll
                jsr     zp_restore_mos
                jsr     unpark_mos_irqs
                lda     save_brkv_lo
                sta     BRKV
                lda     save_brkv_hi
                sta     BRKV + 1
                lda     #0
                sta     mos_parked
                cli
.done
        rts

}
.mos_leave
{
                lda     mos_parked
                bne     done
                sei
                jsr     zp_save_mos
                jsr     park_mos_irqs
                jsr     init_play_poll
                lda     #1
                sta     mos_parked
.done
        rts

; Power-on reset (Stardot / BeebWiki). SysVIA IER=$7F makes MOS treat
; JMP ($FFFC) as cold start and wipe RAM — not a soft BREAK.
}
.machine_reset
{
                lda     #OSBYTE_SERVICE
                ldx     #SERVICE_CLAIM_NMI
                ldy     #NMI_OWNER_PRIVATE
                jsr     OSBYTE
                lda     #OPCODE_RTI
                sta     NMI_VECTOR
                lda     #HW_RESET_PULSE
                sta     SHEILA_MISC_CTL
                lda     #TUBE_RESET_ASSERT
                sta     TUBE_ULA
                lda     #TUBE_RESET_RELEASE
                sta     TUBE_ULA
                lda     #VIA_IER_DISABLE_ALL
                sta     SYSVIA_IER
                jmp     (RESET_VEC)

}
.park_mos_irqs
{
                lda     #OSBYTE_SERVICE
                ldx     #SERVICE_CLAIM_NMI
                ldy     #NMI_OWNER_PRIVATE
                jsr     OSBYTE
                sty     save_nmi_y
                lda     NMI_VECTOR
                sta     save_nmi_d00
                lda     #OPCODE_RTI
                sta     NMI_VECTOR

                lda     USERVIA_IER
                sta     save_user_ier
                lda     #VIA_IER_DISABLE_ALL
                sta     USERVIA_IER

                lda     IRQ1V
                sta     save_irq1v_lo
                lda     IRQ1V + 1
                sta     save_irq1v_hi
                lda     #LO(irq_null)
                sta     IRQ1V
                lda     #HI(irq_null)
                sta     IRQ1V + 1
                rts

}
.unpark_mos_irqs
{
                lda     save_irq1v_lo
                sta     IRQ1V
                lda     save_irq1v_hi
                sta     IRQ1V + 1
                lda     save_user_ier
                sta     USERVIA_IER
                lda     save_nmi_d00
                sta     NMI_VECTOR
                lda     #OSBYTE_SERVICE
                ldx     #SERVICE_RELEASE_NMI
                ldy     save_nmi_y
                jmp     OSBYTE

}
.irq_null
{
        lda     $FC
                rti

}
.init_play_poll
{
                lda     SYSVIA_ORB
                sta     save_via_orb
                lda     SYSVIA_DDRB
                sta     save_via_ddrb
                lda     SYSVIA_DDRA
                sta     save_via_ddra
                lda     SYSVIA_ACR
                sta     save_via_acr
                lda     SYSVIA_T1C_L
                sta     save_via_t1lo
                lda     SYSVIA_T1C_H
                sta     save_via_t1hi
                lda     SYSVIA_IER
                sta     save_via_ier

                lda     #VIA_IER_DISABLE_ALL
                sta     SYSVIA_IER
                sta     SYSVIA_DDRA            ; keyboard DDRA for check_key
                lda     #VIA_IFR_CLEAR_ALL
                sta     SYSVIA_IFR
                lda     #0
                sta     SYSVIA_ACR
                lda     #1
                sta     play_timer_on
                rts

}
.deinit_play_poll
{
                lda     play_timer_on
                beq     done
                lda     #VIA_IER_DISABLE_ALL
                sta     SYSVIA_IER
                lda     #VIA_IFR_CLEAR_ALL
                sta     SYSVIA_IFR
                lda     save_via_acr
                sta     SYSVIA_ACR
                lda     save_via_t1lo
                sta     SYSVIA_T1C_L
                lda     save_via_t1hi
                sta     SYSVIA_T1C_H
                lda     save_via_ddra
                sta     SYSVIA_DDRA
                lda     save_via_ddrb
                sta     SYSVIA_DDRB
                lda     save_via_orb
                sta     SYSVIA_ORB
                lda     save_via_ier
                ora     #VIA_IER_SET_MASK
                ora     #VIA_IFR_CA1
                sta     SYSVIA_IER
                lda     #0
                sta     play_timer_on
.done
        rts

; Poll VSync (CA1); interrupt left disabled.
}
.wait_frame
{
                lda     SYSVIA_IFR
                and     #VIA_IFR_CA1
                beq     wait_frame
                sta     SYSVIA_IFR
                rts

}
.check_key
{
                lda     SYSVIA_DDRB
                pha
                lda     SYSVIA_ORB
                pha
                lda     #KEY_DDRB
                sta     SYSVIA_DDRB
                lda     #KEY_ORB
                sta     SYSVIA_ORB
                txa
                eor     #$FF
                sta     SYSVIA_ORA_NH
                lda     SYSVIA_ORA_NH
                and     #KEY_DOWN_MASK
                tay
                pla
                sta     SYSVIA_ORB
                pla
                sta     SYSVIA_DDRB
                tya
                beq     up
                lda     #$FF
                rts
.up
        lda     #0
                rts

}
.play_tune
{
        jmp     (TUNE_PLAY)

}
.init_tune
{
        sta     zCURTUNE
                tax
                dex
                txa
                jmp     (TUNE_INIT)

}
.zp_save_mos
{
        ldx     #0
.sm
        lda     TUNE_ZP_BASE, x
                sta     mos_zp_save, x
                inx
                cpx     #TUNE_ZP_LEN
                bne     sm
                rts

}
.zp_restore_mos
{
        ldx     #0
.rm
        lda     mos_zp_save, x
                sta     TUNE_ZP_BASE, x
                inx
                cpx     #TUNE_ZP_LEN
                bne     rm
                rts

}
.zp_save_tune
{
        ldx     #0
.st
        lda     TUNE_ZP_BASE, x
                sta     tune_zp_shadow, x
                inx
                cpx     #TUNE_ZP_LEN
                bne     st
                rts

}
.zp_load_tune
{
        ldx     #0
.lt
        lda     tune_zp_shadow, x
                sta     TUNE_ZP_BASE, x
                inx
                cpx     #TUNE_ZP_LEN
                bne     lt
                rts

}
.mos_zp_save
{
        SKIP TUNE_ZP_LEN
}
.tune_zp_shadow
{
        SKIP TUNE_ZP_LEN

}
.oldgate
{
        SKIP 3                       ; previous gate bit per voice
}
.vol
{
        SKIP 3                       ; visual envelope level

; Clear bar/gate tracking (call on song start).
}
.reset_vol_state
{
                ldx     #2
                lda     #0
.clr
        sta     oldgate, x
                sta     vol, x
                sta     GATE_PULSE, x
                dex
                bpl     clr
                rts

}
.showvol
{
        stx     zTMP0
                txa
                asl A
                adc     zTMP0
                asl A
                adc     zTMP0                   ; * 7
                sta     zTMP1                   ; zTMP1 = ch * 7
                tax

                ; Mid-play gate pulses (e.g. Enduro $40→$41) leave shadow gate=1.
                ; ripsid sets GATE_PULSE when gate is written 0 — force a rising edge.
                ldx     zTMP0
                lda     GATE_PULSE, x
                beq     nopulse
                lda     #0
                sta     GATE_PULSE, x
                sta     oldgate, x
.nopulse
        ldx     zTMP1
                lda     SID_COPY_BASE + 4, x    ; channel X flags
                and     #1
                ldx     zTMP0
                cmp     oldgate, x
                beq     sk1

                ; gate value changed - if to 1 set vol to max

                sta     oldgate, x
                cmp     #0
                beq     sk1
                lda     #255
                sta     vol, x
                jmp     sk2

.sk1
        ; gate stayed the same just do decay for now

                ldy     #0
                sty     zTMP2
                cmp     #0
                beq     sk3
                ; get envelope sustain level
                ldx     zTMP1
                lda     SID_COPY_BASE + 6,x
                and     #$F0
                ldx     zTMP0
                sta     zTMP2

.sk3
        lda     vol, x
                cmp     zTMP2
                beq     sk2
                bcs     sk4
                lda     zTMP2
                sta     vol, x
                jmp     sk2
.sk4
                sec
                sbc     #5
                sta     vol, x

.sk2
        lsr     A
                lsr     A
                lsr     A
                lsr     A
                adc     #240
                sta     zTMP2

                ;shift old vol markers along one dot
                ldx     #5
                ldy     #3
.shlp1
        jsr     swapch
                dey
                jsr     swapch
                dey
                jsr     swapch
                dey
                jsr     swapch
                dey
                tya
                clc
                adc     #44             ; next line
                tay
                dex
                bne     shlp1


                ldx     #5
                ldy     #0
.lp1
        lda     (zPTR),y        ; get old char
                and     #$4A
                ora     #$A0            ; keep right hand graphics bits and add 160 for gfx base
                inc     zTMP2           ; inc vol and see if overflows - set bits when it does
                bmi     skd1
                ora     #$01
.skd1
        inc     zTMP2
                bmi     skd2
                ora     #$04
.skd2
        inc     zTMP2
                bmi     skd3
                ora     #$10
.skd3
        sta     (zPTR),y
                tya                     ; next line
                clc
                adc     #40
                tay
                dex
                bne     lp1
                rts

}
.swapch
{
        lda     (zPTR), y
                and     #$15            ;keep left most pixels
                asl     A               ;move to right
                sta     zTMP0
                and     #$20            ; if bit 32 is set shift to 64
                asl     A
                ora     zTMP0           ; we'll have an extra 32 bit left but no mind we or that later
                and     #$4A
                sta     zTMP0

                dey
                lda     (zPTR), y       ; get prev char
                and     #$4A            ; keep right most pixels
                lsr     A               ; move left
                sta     zTMP1
                and     #$20
                lsr     A
                ora     zTMP1
                and     #$15
                ora     zTMP0
                ora     #160
                iny
                sta     (zPTR), y
                rts

}
.showfrq
{
        ; show freq, X points at SID channel base
                ; zPTR points at start of line to show
                txa
                pha
                lda     #32
                ldx     #32
                ldy     #0
                jsr     clr_blk
                ldx     #32
                ldy     #40
                jsr     clr_blk
                pla
                tax

                ; get sid freq and store in zTMP0,1
                lda     SID_COPY_BASE,X
                sta     zTMP0
                lda     SID_COPY_BASE + 1,X
                sta     zTMP1

                ldy     #$FF
                sec
.lp
        rol     zTMP0           ; roll freq left until carry out
                rol     zTMP1
                iny
                bcc     lp
                sty     zTMP2           ; Y is octave (reverse)
                lda     #30
                asl     zTMP2           ; *2 for octave marker 2 chars long
                sbc     zTMP2
                bpl     sk2
                lda     #0
.sk2
        tay
                lda     #255
                sta     (zPTR),y
                iny
                sta     (zPTR),y

                lda     #181            ; vert bar
                lsr     zTMP1            ; get 5 bottom bits of TMP1 and show as note marker
                lsr     zTMP1
                lsr     zTMP1
                bcc     sk1
                lda     #234            ; if carry move bar on one pixel
.sk1
        pha

                clc
                lda     zTMP1
                adc     #40             ; next line
                tay

                pla

                sta     (zPTR),Y        ; store graphic
                rts



}
.clr_blk
{
        sta     (zPTR), y
                iny
                dex
                bne     clr_blk
                rts

}
.unpack_screen
{
        ; unpack a screen's worth of data (1000 bytes) from the RLE data in zPTR, RLE data is encoded as either straight bytes or <32 specifies a length, followed by the char to repeat
                lda     #$7C
                sta     zPTR2 + 1
                lda     #0
                sta     zPTR2
.lp1
        ldy     #0
                lda     (zPTR),y
                cmp     #32
                bcs     sk1    ; >= 32 genuine char
                tax
                iny
                lda     (zPTR),y
                inc     zPTR
                bne     sk11
                inc     zPTR + 1
                jmp     sk11

.sk1
        ldx     #1
.sk11
        ldy     #0
.lp2
        sta     (zPTR2), y
                inc     zPTR2
                bne     sk2
                inc     zPTR2 + 1
                bmi     sk3
.sk2
        dex
                bne     lp2
                inc     zPTR
                bne     lp1
                inc     zPTR + 1
                bne     lp1


.sk3
        rts

}
.scroll
{
        ; before doing scroll check to see if left most chars are colour codes and if they are move into col2
                lda     $7C00 + 17 * 40 + 3
                cmp     #128
                bcc     ssk1
                cmp     #160
                bcs     ssk1
                sta     $7C00 + 17 * 40 + 2
                sta     $7C00 + 18 * 40 + 2
                sta     $7C00 + 19 * 40 + 2

.ssk1
        lda     #LO($7C00 + 17 * 40 + 3)
                sta     zPTR
                lda     #HI($7C00 + 17 * 40 + 3)
                sta     zPTR + 1
                lda     #LO($7C00 + 17 * 40 + 4)
                sta     zPTR2
                lda     #HI($7C00 + 17 * 40 + 4)
                sta     zPTR2 + 1
                ldx     #3
                stx     zTMP0
                ldy     #0
.lp1
        ldx     #36

.lp2
        lda     #0
                sta     zTMP3
                lda     (zPTR), y
                cmp     #160
                bcc     colourcodeL
                and     #$4A
                lsr     A
                sta     zTMP2
                and     #$20
                lsr     A
                ora     zTMP2
                sta     zTMP2

.ccsk3
        lda     (zPTR2), y
                cmp     #160                    ;check to see if it's a colour code
                bcc     colourcode
                and     #$15
                asl     A
                sta     zTMP1
                and     #$20
                asl     A
                ora     zTMP1
                bne     blank_sk
                lda     zTMP3                   ;if zTMP3 is not blank then keep colour code
                bne     ccsk2
.blank_sk
        ora     zTMP2
.ccsk
        ora     #160
.ccsk2
        sta     (zPTR), Y

                iny
                dex
                bne     lp2
                tya
                clc
                adc     #4
                tay
                dec     zTMP0
                bne     lp1
                rts

.colourcodeL
        ; left char is a colour code
                sta     zTMP3                   ;store colour code in zTMP3
                lda     #0
                sta     zTMP2
                jmp     ccsk3

.colourcode
        ; right char is a colour code - if the left char is blank copy it in
                pha
                lda     zTMP2
                bne     ccsk_x   ; previous char not blank
                pla               ; prev char is blank
                jmp     ccsk2

.ccsk_x
        pla
                lda     zTMP2
                jmp     ccsk

}
.show_message
{
        jsr     scroll
                ldy     message_ptr
                lda     $19FE
                sta     zPTR2
                lda     $19FF
                sta     zPTR2 + 1
.aa
        lda     (zPTR2),y
                beq     end
                bmi     code

                sec                     ; make into index into C000 rom char table
                sbc     #32
                ldx     #0
                stx     zPTR + 1

                asl     A
                rol     zPTR + 1
                asl     A
                rol     zPTR + 1
                asl     A
                rol     zPTR + 1

                sta     zPTR

                lda     #$C0
                clc
                adc     zPTR + 1
                sta     zPTR + 1

                ldy     #0              ; line
.lp1
        jsr     getchbits
                sta     $7C00 + 17 * 40 + 39
                jsr     getchbits
                sta     $7C00 + 18 * 40 + 39
                jsr     getchbits
                and     #$AF
                sta     $7C00 + 19 * 40 + 39

                inc     message_col
                lda     #7
                cmp     message_col
                bcs     x
.nextch
        lda     #0
                sta     message_col
                inc     message_ptr

.x
        rts
.end
        jsr     message_reset
                beq     aa

.code
        ; control code - just output the char
                sta     $7C00 + 17 * 40 + 39
                sta     $7C00 + 18 * 40 + 39
                sta     $7C00 + 19 * 40 + 39
                inc     message_col
                lda     #4
                cmp     message_col
                bcc     nextch
                rts


.getchbits
        jsr     shift_bmp
                lsr     A
                lsr     A
                lsr     A
                lsr     A
                lsr     A
                lsr     A
                sta     zTMP0
                jsr     shift_bmp
                lsr     A
                lsr     A
                lsr     A
                lsr     A
                ora     zTMP0
                sta     zTMP0
                jsr     shift_bmp
                lsr     A
                lsr     A
                ora     zTMP0
                sta     zTMP0
                and     #$20
                asl     A
                ora     zTMP0
                ora     #160
                rts


.shift_bmp
                ;lda     (zPTR), y       ; bitmap
                jsr     get_ch_bits
                iny
                ldx     message_col
.shlp1
        beq     o
                asl     A
                dex
                jmp     shlp1
.o
        and     #$80            ; keep left most bit
                asl     A
                bcc     p
                ora     #$40
.p
        rts

}
.message_reset
{
                ldy     #0
                sty     message_ptr
                rts


; Mode 7 RAM only (no OSWRCH). Tune marker at row 23, column 30.
}
.screen_play
{
        lda     #LO(play_screen)
                sta     zPTR
                lda     #HI(play_screen)
                sta     zPTR + 1
                jsr     unpack_screen

                jsr     message_reset

                lda     #132                            ; Mode 7 blue
                sta     $7C00 + 23 * 40 + 30
                ldx     zCURTUNE
                lda     #'<'
                cpx     #2
                bcs     sge
                lda     #' '
.sge
        sta     $7C00 + 23 * 40 + 31
                txa
                clc
                adc     #'0'
                sta     $7C00 + 23 * 40 + 32
                lda     #'>'
                ldx     zCURTUNE
                cpx     $19FC
                bcc     slt2
                lda     #' '
.slt2
        sta     $7C00 + 23 * 40 + 33
                jmp     shut_up

}
.shut_up
{
        ldx     #23
                lda     #0
.L1
        sta     SID_BASE, X
                dex
                bpl     L1
                rts


}
.message_ptr
{
        EQUB 0
}
.message_col
{
        EQUB 0         ; bit column(s) to shift in (0..7)
}
.message
{
        EQUB 145,"SIDPLAY",147," - hello world this is sid player.... A",145,"A",146,"A",147,"A",148,"A",149,"A",150,"A",151,"A",145,"A",145,"A",145,"A",145,"ooooooooo                   ",0

}
.menu
{
        SKIP 1261      ; menu space 1 byte contains number of tunes followed by 10 chars of filename



}

INCLUDE "../../../out/play_screen.asm"
INCLUDE "../../../out/menu_screen.asm"
INCLUDE "../../lib/mul.asm"

.end_code
SKIPTO start_img + &1C00
.end_img

SAVE "sidpl.o", start_img, end_img, start_img
