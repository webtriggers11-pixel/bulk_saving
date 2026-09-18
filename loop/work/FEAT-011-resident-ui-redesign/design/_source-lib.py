# -*- coding: utf-8 -*-
"""Bulk Saving resident theme v4 — themeable tokens, liquid glass, bento, micro-motion."""

# ---------------------------------------------------------------- token refs (CSS vars)
INK    = "var(--ink)"
INK_2  = "var(--ink-2)"
INK_3  = "var(--ink-3)"
BRAND  = "var(--brand)"
BRAND_INK = "var(--brand-ink)"
ACCENT, ACCENT_INK = BRAND, BRAND_INK
AMBER_INK = "#8A5512"
RED_INK   = "#A32318"
GREEN_INK = "#0F6B45"

GROUND = ("background-color:var(--ground-a);"
          "background-image:radial-gradient(900px 520px at 4% -12%,var(--mesh-1),transparent 64%),"
          "radial-gradient(680px 460px at 112% 2%,var(--mesh-2),transparent 62%),"
          "radial-gradient(760px 560px at 46% 116%,var(--mesh-3),transparent 66%),"
          "linear-gradient(180deg,var(--ground-b) 0%,var(--ground-a) 100%);")

GLASS = ("background-image:linear-gradient(152deg,rgba(255,255,255,.90) 0%,rgba(255,255,255,.62) 46%,rgba(255,255,255,.74) 100%);"
         "backdrop-filter:blur(26px) saturate(180%);-webkit-backdrop-filter:blur(26px) saturate(180%);"
         "border:1px solid rgba(255,255,255,.85);border-radius:26px;"
         "box-shadow:0 1px 1px rgba(255,255,255,.9) inset,0 -1px 2px rgba(var(--sh),.05) inset,"
         "0 2px 4px rgba(var(--sh),.05),0 24px 52px -26px rgba(var(--sh),.45);")

SOLID = ("background-image:linear-gradient(170deg,rgba(255,255,255,.96),rgba(255,255,255,.80));"
         "backdrop-filter:blur(18px) saturate(150%);-webkit-backdrop-filter:blur(18px) saturate(150%);"
         "border:1px solid rgba(255,255,255,.72);border-radius:24px;"
         "box-shadow:0 1px 0 rgba(255,255,255,.8) inset,0 2px 4px rgba(var(--sh),.04),"
         "0 18px 42px -26px rgba(var(--sh),.40);")

TINT = ("background-image:linear-gradient(152deg,rgba(var(--brand-lt-rgb),.22) 0%,rgba(var(--brand-rgb),.08) 52%,rgba(255,255,255,.34) 100%);"
        "backdrop-filter:blur(18px) saturate(165%);-webkit-backdrop-filter:blur(18px) saturate(165%);"
        "border:1px solid rgba(255,255,255,.64);border-radius:24px;"
        "box-shadow:0 1px 0 rgba(255,255,255,.7) inset,0 18px 44px -28px rgba(var(--sh),.48);")

ACCENT_SURF = ("background-image:radial-gradient(120% 120% at 8% 0%,rgba(var(--brand-lt-rgb),.62) 0%,transparent 52%),"
               "linear-gradient(142deg,var(--brand-deep) 0%,var(--brand) 46%,var(--brand-lt) 118%);"
               "border:1px solid rgba(255,255,255,.22);border-radius:26px;color:#FFFFFF;"
               "box-shadow:0 1px 0 rgba(255,255,255,.30) inset,0 26px 50px -22px rgba(var(--sh),.75);")

INSET = ("background-image:linear-gradient(168deg,rgba(255,255,255,.74),rgba(255,255,255,.44));"
         "border:1px solid rgba(255,255,255,.62);border-radius:18px;"
         "box-shadow:0 1px 0 rgba(255,255,255,.75) inset,0 -1px 2px rgba(var(--sh),.03) inset;")

BTN_BASE = ("position:relative;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;gap:9px;"
            "height:50px;padding:0 22px;border-radius:16px;font-family:inherit;font-size:15px;font-weight:700;"
            "letter-spacing:-.015em;cursor:pointer;box-sizing:border-box;")
BTN_PRIMARY = BTN_BASE + ("border:1px solid rgba(255,255,255,.20);color:#FFFFFF;"
                          "background-image:radial-gradient(130% 120% at 14% 0%,rgba(var(--brand-lt-rgb),.55),transparent 58%),"
                          "linear-gradient(140deg,var(--brand),var(--brand-deep));"
                          "box-shadow:0 1px 0 rgba(255,255,255,.34) inset,0 12px 26px -12px rgba(var(--sh),.9);")
BTN_SECOND = BTN_BASE + ("border:1px solid rgba(255,255,255,.72);color:var(--ink);"
                         "background-image:linear-gradient(165deg,rgba(255,255,255,.92),rgba(255,255,255,.66));"
                         "backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);"
                         "box-shadow:0 1px 0 rgba(255,255,255,.9) inset,0 10px 22px -16px rgba(var(--sh),.55);")
BTN_OUTLINE = BTN_BASE + ("border:1px solid rgba(var(--brand-rgb),.34);color:var(--brand-ink);"
                          "background-image:linear-gradient(165deg,rgba(var(--brand-lt-rgb),.16),rgba(var(--brand-rgb),.05));")
BTN_GHOST  = BTN_BASE + "border:1px solid transparent;color:var(--ink-2);background-color:transparent;"
BTN_ICON   = ("position:relative;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;"
              "width:48px;height:48px;border-radius:16px;border:1px solid rgba(255,255,255,.74);color:var(--ink);"
              "background-image:linear-gradient(165deg,rgba(255,255,255,.92),rgba(255,255,255,.62));"
              "backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);cursor:pointer;padding:0;"
              "box-shadow:0 1px 0 rgba(255,255,255,.9) inset,0 8px 18px -14px rgba(var(--sh),.6);")

INPUT = ("width:100%;box-sizing:border-box;height:50px;padding:0 15px;border-radius:16px;"
         "border:1px solid rgba(255,255,255,.74);color:var(--ink);"
         "background-image:linear-gradient(170deg,rgba(255,255,255,.94),rgba(255,255,255,.72));"
         "font-family:inherit;font-size:15px;font-weight:600;letter-spacing:-.01em;"
         "box-shadow:0 1px 2px rgba(var(--sh),.06) inset,0 1px 0 rgba(255,255,255,.7);")

LABEL   = ("display:block;margin:0 0 8px;font-size:11.5px;font-weight:800;letter-spacing:.09em;"
           "text-transform:uppercase;color:var(--ink-2);")
EYEBROW = ("margin:0;font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;"
           "color:var(--brand-ink);")
CAPTION = "margin:0;font-size:13px;font-weight:500;line-height:1.5;color:var(--ink-2);"
H1 = "margin:0;font-size:26px;font-weight:800;letter-spacing:-.035em;line-height:1.08;color:var(--ink);"
H2 = "margin:0;font-size:19px;font-weight:800;letter-spacing:-.028em;line-height:1.22;color:var(--ink);"

PALETTES = [
    ("teal", "Teal", "#0F766E", "#0A544C", "#2ED6BB", "#095049", "15,118,110", "46,214,187",
     "#EEF2F1", "#F5F8F7", "#0C1B19", "#4E615C", "#687A74", "9,52,47",
     "rgba(46,214,187,.26)", "rgba(15,118,110,.18)", "rgba(63,118,140,.16)"),
    ("indigo", "Indigo", "#4F46E5", "#312E81", "#8B8CFF", "#3730A3", "79,70,229", "139,140,255",
     "#EFF0F8", "#F6F7FC", "#14142B", "#545473", "#6C6C8E", "30,27,75",
     "rgba(139,140,255,.30)", "rgba(79,70,229,.20)", "rgba(236,72,153,.14)"),
    ("ember", "Ember", "#C2410C", "#7C2D12", "#FB923C", "#9A3412", "194,65,12", "251,146,60",
     "#F6F1EC", "#FBF7F3", "#221310", "#6A5248", "#7A5C50", "90,40,15",
     "rgba(251,146,60,.30)", "rgba(194,65,12,.16)", "rgba(180,120,90,.18)"),
]

def _theme_css():
    out = []
    for (key, _name, brand, deep, lt, bink, brgb, ltrgb, ga, gb, ink, ink2, ink3, sh, m1, m2, m3) in PALETTES:
        sel = ":root," if key == "teal" else ""
        out.append(
            f'{sel}[data-theme="{key}"]{{--brand:{brand};--brand-deep:{deep};--brand-lt:{lt};--brand-ink:{bink};'
            f'--brand-rgb:{brgb};--brand-lt-rgb:{ltrgb};--ground-a:{ga};--ground-b:{gb};'
            f'--ink:{ink};--ink-2:{ink2};--ink-3:{ink3};--sh:{sh};--mesh-1:{m1};--mesh-2:{m2};--mesh-3:{m3}}}')
    return "\n".join(out)

HELMET = """<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
__THEMES__
body{margin:0;font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;background:var(--ground-a);color:var(--ink)}
a{color:var(--brand);text-decoration:none}a:hover{color:var(--brand-ink)}
*{-webkit-tap-highlight-color:transparent}
input,textarea,button{font-family:inherit}
dl,dd,dt{margin:0}ul,ol{margin:0;padding:0;list-style:none}
.num{font-variant-numeric:tabular-nums;letter-spacing:-.03em}

/* motion vocabulary */
.t{transition:transform .34s cubic-bezier(.22,.8,.28,1),box-shadow .34s cubic-bezier(.22,.8,.28,1),background-color .26s ease,background-image .26s ease,border-color .26s ease,color .22s ease,opacity .26s ease,filter .26s ease}
.t-fast{transition:transform .16s cubic-bezier(.3,.9,.4,1),opacity .16s ease,color .16s ease,background-color .16s ease}

/* entrance */
@keyframes rise{from{opacity:0;transform:translateY(20px) scale(.98)}to{opacity:1;transform:none}}
@keyframes riseSm{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes blurIn{from{opacity:0;filter:blur(10px);transform:translateY(8px) scale(.96)}to{opacity:1;filter:blur(0);transform:none}}
.rise{animation:rise .78s cubic-bezier(.22,.9,.26,1) both}
.blur-in{animation:blurIn .9s cubic-bezier(.22,.9,.26,1) both}
.stagger>*{animation:rise .78s cubic-bezier(.22,.9,.26,1) both}
.stagger>*:nth-child(1){animation-delay:.04s}.stagger>*:nth-child(2){animation-delay:.12s}
.stagger>*:nth-child(3){animation-delay:.20s}.stagger>*:nth-child(4){animation-delay:.28s}
.stagger>*:nth-child(5){animation-delay:.36s}.stagger>*:nth-child(6){animation-delay:.44s}
.stagger>*:nth-child(7){animation-delay:.52s}.stagger>*:nth-child(8){animation-delay:.60s}
.fade-in{animation:riseSm .6s ease both;animation-delay:.34s}

/* ambient */
@keyframes driftA{0%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(38px,26px,0) scale(1.14)}100%{transform:translate3d(0,0,0) scale(1)}}
@keyframes driftB{0%{transform:translate3d(0,0,0) scale(1.06)}50%{transform:translate3d(-34px,34px,0) scale(.9)}100%{transform:translate3d(0,0,0) scale(1.06)}}
@keyframes driftC{0%{transform:translate3d(0,0,0)}50%{transform:translate3d(26px,-32px,0) scale(1.1)}100%{transform:translate3d(0,0,0)}}
.blob{position:absolute;border-radius:50%;filter:blur(46px);pointer-events:none;will-change:transform}
.blob-a{animation:driftA 22s ease-in-out infinite}.blob-b{animation:driftB 27s ease-in-out infinite}.blob-c{animation:driftC 19s ease-in-out infinite}

/* cards */
.card{will-change:transform}
.card:hover{transform:translateY(-3px);box-shadow:0 1px 1px rgba(255,255,255,.9) inset,0 4px 8px rgba(var(--sh),.06),0 36px 66px -30px rgba(var(--sh),.6)}
.card-glow{position:relative}
.card-glow::after{content:"";position:absolute;inset:-1px;border-radius:inherit;padding:1px;background:linear-gradient(140deg,rgba(255,255,255,.95),rgba(var(--brand-lt-rgb),.55),rgba(255,255,255,0) 62%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:.5;pointer-events:none;transition:opacity .4s ease}
.card-glow:hover::after{opacity:1}
@keyframes spinSlow{to{transform:rotate(360deg)}}
.halo::before{content:"";position:absolute;inset:-60%;background:conic-gradient(from 0deg,transparent 0deg,rgba(var(--brand-lt-rgb),.30) 60deg,transparent 140deg,transparent 360deg);animation:spinSlow 11s linear infinite;pointer-events:none}

/* buttons */
@keyframes sweep{0%{transform:translateX(-120%) skewX(-18deg)}100%{transform:translateX(320%) skewX(-18deg)}}
.btn::after{content:"";position:absolute;top:0;bottom:0;width:38%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent);transform:translateX(-120%) skewX(-18deg);pointer-events:none}
.btn:hover::after{animation:sweep .85s cubic-bezier(.3,.8,.3,1)}
.btn:hover{transform:translateY(-2px);box-shadow:0 1px 0 rgba(255,255,255,.34) inset,0 18px 30px -14px rgba(var(--sh),.75)}
.btn:active{transform:translateY(0) scale(.975);transition-duration:.12s}
.btn:focus-visible{outline:none;box-shadow:0 0 0 4px rgba(var(--brand-rgb),.28),0 12px 26px -12px rgba(var(--sh),.7)}
.btn .nudge{transition:transform .28s cubic-bezier(.22,.9,.26,1)}
.btn:hover .nudge{transform:translateX(4px)}
.soft:hover{background-image:linear-gradient(165deg,#FFFFFF,rgba(255,255,255,.84))}
.tap:active{transform:scale(.93);transition-duration:.12s}
.tap:hover{transform:translateY(-2px)}
@keyframes ripple{from{transform:translate(-50%,-50%) scale(0);opacity:.5}to{transform:translate(-50%,-50%) scale(2.6);opacity:0}}
.ripple::before{content:"";position:absolute;left:50%;top:50%;width:120%;padding-bottom:120%;border-radius:50%;background:rgba(255,255,255,.55);transform:translate(-50%,-50%) scale(0);opacity:0;pointer-events:none}
.ripple:active::before{animation:ripple .55s ease-out}

/* inputs */
@keyframes ringIn{from{box-shadow:0 0 0 0 rgba(var(--brand-rgb),.34)}to{box-shadow:0 0 0 5px rgba(var(--brand-rgb),.17)}}
input:focus,textarea:focus{outline:none;border-color:rgba(var(--brand-rgb),.6);animation:ringIn .28s ease-out forwards}
input::placeholder,textarea::placeholder{color:var(--ink-3);font-weight:500}
.field:focus-within .field-label{color:var(--brand-ink);transform:translateY(-1px)}
.field-label{transition:color .22s ease,transform .22s ease}

/* live signals */
@keyframes pulseTeal{0%{box-shadow:0 0 0 0 rgba(var(--brand-rgb),.45)}70%{box-shadow:0 0 0 8px rgba(var(--brand-rgb),0)}100%{box-shadow:0 0 0 0 rgba(var(--brand-rgb),0)}}
.dot-teal{animation:pulseTeal 2.6s ease-out infinite}
@keyframes pulseGreen{0%{box-shadow:0 0 0 0 rgba(22,163,74,.45)}70%{box-shadow:0 0 0 7px rgba(22,163,74,0)}100%{box-shadow:0 0 0 0 rgba(22,163,74,0)}}
.dot-live{animation:pulseGreen 2.4s ease-out infinite}
@keyframes breathe{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.04)}}
.breathe{animation:breathe 3.4s ease-in-out infinite}

/* progress + skeleton */
@keyframes grow{from{width:0}}
@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}
.bar-fill{animation:grow 1.5s cubic-bezier(.22,.9,.26,1) both;position:relative;overflow:hidden}
.bar-fill::after{content:"";position:absolute;inset:0;width:45%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent);animation:shimmer 2.6s ease-in-out infinite}
@keyframes skeleton{0%{transform:translateX(-100%)}100%{transform:translateX(230%)}}
@keyframes skelPulse{0%,100%{opacity:.75}50%{opacity:1}}
.skel{position:relative;overflow:hidden;background-image:linear-gradient(120deg,rgba(var(--sh),.09),rgba(var(--sh),.05));animation:skelPulse 2.2s ease-in-out infinite}
.skel::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.9),transparent);animation:skeleton 1.7s ease-in-out infinite}
.skel-d1::after{animation-delay:.12s}.skel-d2::after{animation-delay:.24s}.skel-d3::after{animation-delay:.36s}

/* accent surface effects */
@keyframes glide{0%{transform:translate3d(-30%,-10%,0) scale(1)}50%{transform:translate3d(30%,14%,0) scale(1.22)}100%{transform:translate3d(-30%,-10%,0) scale(1)}}
.orb{position:absolute;border-radius:50%;filter:blur(30px);pointer-events:none;animation:glide 14s ease-in-out infinite}
@keyframes sheen{0%{transform:translateX(-130%) rotate(14deg)}55%,100%{transform:translateX(240%) rotate(14deg)}}
.sheen::before{content:"";position:absolute;top:-40%;bottom:-40%;width:34%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent);animation:sheen 6.5s cubic-bezier(.4,.1,.3,1) infinite;pointer-events:none}

/* celebration */
@keyframes burst{0%{transform:translate(0,0) scale(0);opacity:0}25%{opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(1);opacity:0}}
.spark{position:absolute;width:6px;height:6px;border-radius:50%;background:var(--brand-lt);animation:burst 1.4s cubic-bezier(.2,.8,.3,1) infinite;pointer-events:none}

/* spinners, stars, checks, toast, tabs */
@keyframes spin{to{transform:rotate(360deg)}}
.spin{animation:spin .85s linear infinite}
@keyframes pop{0%{transform:scale(.7);opacity:0}60%{transform:scale(1.14)}100%{transform:scale(1);opacity:1}}
.pop{animation:pop .42s cubic-bezier(.3,1.3,.5,1) both}
.star-hit:hover{transform:scale(1.2) rotate(-7deg)}
.star-hit:active{transform:scale(.94)}
@keyframes draw{to{stroke-dashoffset:0}}
.draw{stroke-dasharray:30;stroke-dashoffset:30;animation:draw .7s cubic-bezier(.22,.9,.26,1) .25s forwards}
@keyframes slideUp{from{opacity:0;transform:translateY(22px) scale(.97)}to{opacity:1;transform:none}}
.slide-up{animation:slideUp .5s cubic-bezier(.22,.9,.26,1) both}
@keyframes strip{from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:none}}
.strip-in{animation:strip .5s cubic-bezier(.22,.9,.26,1) both}
.tab .tab-pill{transition:transform .34s cubic-bezier(.3,1.2,.4,1),background-color .26s ease,box-shadow .3s ease,opacity .26s ease}
.tab:hover .tab-pill{transform:translateY(-3px)}
.tab:active .tab-pill{transform:scale(.9)}
.tab-on .tab-pill{box-shadow:0 8px 18px -10px rgba(var(--sh),.9)}
@keyframes tabIn{from{opacity:0;transform:scaleX(.2)}to{opacity:1;transform:none}}
.tab-line{animation:tabIn .5s cubic-bezier(.3,1.1,.4,1) both}

.grain{position:absolute;inset:0;opacity:.055;mix-blend-mode:overlay;pointer-events:none}
.chip:hover{transform:translateY(-1px)}
.row-hover:hover{background-color:rgba(255,255,255,.55)}
.ic-spin:hover{transform:rotate(90deg)}
@media (prefers-reduced-motion:reduce){*{animation-duration:.01ms !important;animation-iteration-count:1 !important;transition-duration:.01ms !important}}
</style>
</helmet>""".replace("__THEMES__", _theme_css())

# ---------------------------------------------------------------- icons
_P = {
 "home": '<path d="M3.2 10.4 12 3.4l8.8 7"/><path d="M5.4 9.4V19a1.6 1.6 0 0 0 1.6 1.6h10a1.6 1.6 0 0 0 1.6-1.6V9.4"/><path d="M9.6 20.6v-5.4h4.8v5.4"/>',
 "services": '<rect x="3.2" y="3.2" width="7.4" height="7.4" rx="2.4"/><rect x="13.4" y="3.2" width="7.4" height="7.4" rx="2.4"/><rect x="3.2" y="13.4" width="7.4" height="7.4" rx="2.4"/><rect x="13.4" y="13.4" width="7.4" height="7.4" rx="2.4"/>',
 "requests": '<path d="M20.8 11.3V12a8.8 8.8 0 1 1-5.2-8"/><path d="m8.6 11.4 3 3 9.2-9.2"/>',
 "profile": '<circle cx="12" cy="8.2" r="3.9"/><path d="M4.6 20.6c1.2-3.7 3.9-5.6 7.4-5.6s6.2 1.9 7.4 5.6"/>',
 "back": '<path d="m14.2 5.2-6.8 6.8 6.8 6.8"/>',
 "logout": '<path d="M9.4 20.6H5.6a2 2 0 0 1-2-2V5.4a2 2 0 0 1 2-2h3.8"/><path d="m16.2 16.2 4.2-4.2-4.2-4.2"/><path d="M20.4 12H9.6"/>',
 "ac": '<path d="M12 2.6v18.8"/><path d="m4.4 7.2 15.2 9.6"/><path d="m19.6 7.2-15.2 9.6"/><path d="M12 6.8 9.6 4.4M12 6.8l2.4-2.4M12 17.2l-2.4 2.4M12 17.2l2.4 2.4"/>',
 "pest": '<path d="M8.4 6.4a3.6 3.6 0 0 1 7.2 0"/><rect x="6.4" y="6.4" width="11.2" height="12.6" rx="5.6"/><path d="M3.4 11.2h3M17.6 11.2h3M4 16.6h2.4M17.6 16.6H20M4.6 6.4 7 7.8M19.4 6.4 17 7.8"/>',
 "clean": '<path d="M12 3.2 13.7 8.6l5.3 1.7-5.3 1.7L12 17.4l-1.7-5.4L5 10.3l5.3-1.7L12 3.2Z"/><path d="m18.4 15.6.7 2.2 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.2Z"/>',
 "paint": '<rect x="3.2" y="4.2" width="12" height="5.6" rx="2"/><path d="M15.2 7h3.6a2 2 0 0 1 2 2v2.2a2 2 0 0 1-2 2h-6.4"/><rect x="9.6" y="13.2" width="4.8" height="7" rx="1.8"/>',
 "clock": '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.2 2"/>',
 "users": '<circle cx="9.2" cy="8.4" r="3.4"/><path d="M2.8 20.2c.9-3.2 3.3-5 6.4-5s5.5 1.8 6.4 5"/><path d="M16 5.4a3.4 3.4 0 0 1 0 6.2"/><path d="M17.6 15.6c2 .8 3.2 2.3 3.7 4.6"/>',
 "spark": '<path d="M12 3.4 13.6 9l5.6 1.6L13.6 12l-1.6 5.6L10.4 12 4.8 10.6 10.4 9 12 3.4Z"/>',
 "trend": '<path d="M3.4 7.6 10 14.2l3.4-3.4 7.2 7.2"/><path d="M15.4 18h5.2v-5.2"/>',
 "plus": '<path d="M12 5.6v12.8M5.6 12h12.8"/>',
 "minus": '<path d="M5.6 12h12.8"/>',
 "refresh": '<path d="M20.4 12a8.4 8.4 0 1 1-2.5-6"/><path d="M20.4 4.6V10h-5.4"/>',
 "wifioff": '<path d="m3.4 3.4 17.2 17.2"/><path d="M8.6 15.4a4.8 4.8 0 0 1 6.8 0"/><path d="M5 11.9a10 10 0 0 1 3.4-2.3"/><path d="M19 11.9a10 10 0 0 0-8.4-2.8"/><circle cx="12" cy="19.2" r="1.1"/>',
 "install": '<path d="M12 3.4v11.4"/><path d="m7.6 10.6 4.4 4.4 4.4-4.4"/><path d="M4.6 20.4h14.8"/>',
 "phone": '<path d="M7.4 3.4h9.2a1.8 1.8 0 0 1 1.8 1.8v13.6a1.8 1.8 0 0 1-1.8 1.8H7.4a1.8 1.8 0 0 1-1.8-1.8V5.2a1.8 1.8 0 0 1 1.8-1.8Z"/><path d="M10.6 17.8h2.8"/>',
 "building": '<path d="M4.2 20.6V5.4a1.8 1.8 0 0 1 1.8-1.8h7.2a1.8 1.8 0 0 1 1.8 1.8v15.2"/><path d="M15 9.6h3a1.8 1.8 0 0 1 1.8 1.8v9.2"/><path d="M7.4 7.6h1.6M11 7.6h1.6M7.4 11.4h1.6M11 11.4h1.6M7.4 15.2h1.6M11 15.2h1.6"/><path d="M2.8 20.6h18.4"/>',
 "shield": '<path d="M12 3.2 5 6v5.6c0 4 2.8 7.6 7 9.2 4.2-1.6 7-5.2 7-9.2V6l-7-2.8Z"/><path d="m9.2 11.8 2 2 3.8-3.8"/>',
 "x": '<path d="m6.4 6.4 11.2 11.2M17.6 6.4 6.4 17.6"/>',
 "arrow": '<path d="M4.6 12h14"/><path d="m13 6.4 5.6 5.6-5.6 5.6"/>',
 "info": '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.4"/><circle cx="12" cy="7.9" r="1"/>',
 "check": '<path d="m5.4 12.6 4.4 4.4 8.8-9.4"/>',
 "alert": '<path d="M12 3.6 21 19.4H3L12 3.6Z"/><path d="M12 9.8v4.4"/><circle cx="12" cy="17" r="1"/>',
 "bolt": '<path d="M13.6 2.6 4.8 13.4h6L10.4 21.4l8.8-10.8h-6l.4-8Z"/>',
 "palette": '<path d="M12 3.2a8.8 8.8 0 0 0 0 17.6c1.5 0 2.2-1 2.2-2 0-1.4-1.3-1.7-1.3-2.9 0-.8.7-1.5 1.6-1.5h1.6a4.7 4.7 0 0 0 4.7-4.7c0-3.6-3.9-6.5-8.8-6.5Z"/><circle cx="8" cy="10" r="1.1"/><circle cx="12" cy="7.6" r="1.1"/><circle cx="16" cy="10" r="1.1"/>',
}

def icon(name, size=22, color="currentColor", stroke=1.8, style="", cls=""):
    c = f' class="{cls}"' if cls else ""
    return ('<svg aria-hidden="true"%s viewBox="0 0 24 24" width="%d" height="%d" fill="none" stroke="%s" '
            'stroke-width="%s" stroke-linecap="round" stroke-linejoin="round" '
            'style="display:block;flex-shrink:0;%s">%s</svg>') % (c, size, size, color, stroke, style, _P[name])

STAR_PATH = "m12 3.6 2.6 5.5 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8L12 3.6Z"

def star(filled=True, size=22, color="#E8A916", dim="#C3D0CC", cls=""):
    c = color if filled else dim
    fill = c if filled else "none"
    k = f' class="{cls}"' if cls else ""
    return ('<svg aria-hidden="true"%s viewBox="0 0 24 24" width="%d" height="%d" fill="%s" stroke="%s" '
            'stroke-width="1.5" stroke-linejoin="round" style="display:block"><path d="%s"/></svg>') % (k, size, size, fill, c, STAR_PATH)

def grain(uid):
    return ('<svg class="grain" aria-hidden="true" width="100%%" height="100%%">'
            '<filter id="grain-%s"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/>'
            '<feColorMatrix type="saturate" values="0"/></filter>'
            '<rect width="100%%" height="100%%" filter="url(#grain-%s)" opacity="0.55"/></svg>') % (uid, uid)

def blobs(kind="phone"):
    if kind == "phone":
        return ('<div class="blob blob-a" style="top:-90px;left:-70px;width:260px;height:260px;'
                'background:radial-gradient(circle,var(--mesh-1),transparent 68%)"></div>'
                '<div class="blob blob-b" style="top:180px;right:-110px;width:280px;height:280px;'
                'background:radial-gradient(circle,var(--mesh-2),transparent 70%)"></div>'
                '<div class="blob blob-c" style="bottom:-60px;left:-40px;width:240px;height:240px;'
                'background:radial-gradient(circle,var(--mesh-3),transparent 70%)"></div>')
    return ('<div class="blob blob-a" style="top:-140px;left:-120px;width:520px;height:520px;'
            'background:radial-gradient(circle,var(--mesh-1),transparent 68%)"></div>'
            '<div class="blob blob-b" style="bottom:-180px;right:-140px;width:560px;height:560px;'
            'background:radial-gradient(circle,var(--mesh-2),transparent 70%)"></div>')

def sparks(n=6):
    import math
    out = []
    for i in range(n):
        ang = (360 / n) * i + 12
        dx = round(math.cos(math.radians(ang)) * 34)
        dy = round(math.sin(math.radians(ang)) * 26)
        out.append(f'<span class="spark" style="--dx:{dx}px;--dy:{dy}px;left:14px;top:50%;animation-delay:{i*0.09:.2f}s"></span>')
    return '<span aria-hidden="true" style="position:absolute;inset:0;pointer-events:none">' + "".join(out) + '</span>'

# ---------------------------------------------------------------- page
THEME_PROP = ('"theme":{"editor":"enum","options":["teal","indigo","ember"],"default":"teal",'
              '"section":"Theme"}')
DEFAULT_LOGIC = """class Component extends DCLogic {
  renderVals() { return { theme: this.props.theme ?? 'teal' }; }
}"""

def page(title, body, w=390, h=844, uid="a", logic=None, props=None, kind="phone", theme_hole=True):
    extra = ("," + props) if props else ""
    props_json = '{%s,"$preview":{"width":%d,"height":%d}%s}' % (THEME_PROP, w, h, extra)
    theme_attr = ' data-theme="{{theme}}"' if theme_hole else ' data-theme="teal"'
    return """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>%s</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
%s
<div%s style="width:%dpx;height:%dpx;box-sizing:border-box;position:relative;overflow:hidden;%s">
%s
%s
%s
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='%s'>
%s
</script>
</body>
</html>
""" % (title, HELMET, theme_attr, w, h, GROUND, blobs(kind), grain(uid), body, props_json, logic or DEFAULT_LOGIC)

# ---------------------------------------------------------------- chrome
TABS = [("home", "Home"), ("services", "Services"), ("requests", "My Requests"), ("profile", "Profile")]

def bottom_nav(active):
    items = []
    for key, label in TABS:
        on = key == active
        col = "var(--brand-ink)" if on else "var(--ink-2)"
        pill = ("background-image:linear-gradient(150deg,rgba(var(--brand-lt-rgb),.34),rgba(var(--brand-rgb),.16));"
                "border:1px solid rgba(255,255,255,.7);") if on else "border:1px solid transparent;"
        line = ('<span class="tab-line" style="display:block;width:16px;height:2.5px;border-radius:999px;'
                'background-image:linear-gradient(90deg,var(--brand-deep),var(--brand-lt))"></span>') if on else \
               '<span style="display:block;width:16px;height:2.5px"></span>'
        items.append(
            '<li style="flex:1 1 0;display:flex"><a href="#" class="tab %s" style="flex:1 1 0;display:flex;'
            'flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:58px;'
            'padding:7px 4px;border-radius:18px;color:%s;text-decoration:none">'
            '<span class="tab-pill" style="display:flex;align-items:center;justify-content:center;width:44px;height:30px;'
            'border-radius:12px;%s">%s</span>'
            '<span style="font-size:10.5px;font-weight:%s;letter-spacing:-.005em">%s</span>%s</a></li>'
            % ("tab-on" if on else "", col, pill, icon(key, 21, "currentColor", 2.0 if on else 1.7), "800" if on else "600", label, line))
    return ('<nav aria-label="Main" class="fade-in" style="position:absolute;left:0;right:0;bottom:0;padding:9px 10px 14px;'
            'background-image:linear-gradient(180deg,rgba(255,255,255,.58),rgba(255,255,255,.93));'
            'backdrop-filter:blur(28px) saturate(200%%);-webkit-backdrop-filter:blur(28px) saturate(200%%);'
            'border-top:1px solid rgba(255,255,255,.85);'
            'box-shadow:0 1px 0 rgba(255,255,255,.9) inset,0 -16px 38px -24px rgba(var(--sh),.55)">'
            '<ul style="display:flex;align-items:stretch;gap:4px;margin:0;padding:0;list-style:none">%s</ul></nav>'
            % "".join(items))

def badge(text, tone="slate", ic=None, cls=""):
    tones = {
        "slate": ("linear-gradient(160deg,rgba(255,255,255,.88),rgba(255,255,255,.58))", "rgba(255,255,255,.72)", "var(--ink-2)"),
        "teal":  ("linear-gradient(160deg,rgba(var(--brand-lt-rgb),.30),rgba(var(--brand-rgb),.12))", "rgba(255,255,255,.7)", "var(--brand-ink)"),
        "amber": ("linear-gradient(160deg,rgba(232,169,22,.30),rgba(180,110,9,.12))", "rgba(255,255,255,.62)", AMBER_INK),
        "blue":  ("linear-gradient(160deg,rgba(59,130,246,.24),rgba(37,99,235,.09))", "rgba(255,255,255,.64)", "#1B4FC4"),
        "green": ("linear-gradient(160deg,rgba(34,180,110,.26),rgba(22,138,90,.10))", "rgba(255,255,255,.64)", GREEN_INK),
        "red":   ("linear-gradient(160deg,rgba(214,89,74,.24),rgba(163,35,24,.09))", "rgba(255,255,255,.6)", RED_INK),
    }
    bg, bd, fg = tones[tone]
    ico = (icon(ic, 13, "currentColor", 2.2) + " ") if ic else ""
    return ('<span class="chip t %s" style="display:inline-flex;align-items:center;gap:6px;white-space:nowrap;'
            'padding:6px 11px;border-radius:999px;background-image:%s;border:1px solid %s;color:%s;'
            'font-size:11.5px;font-weight:800;'
            'box-shadow:0 1px 0 rgba(255,255,255,.7) inset,0 6px 14px -10px rgba(var(--sh),.6)">%s%s</span>'
            % (cls, bg, bd, fg, ico, text))

def progress(pct, label, delay="0s", tip=True, h=10):
    tip_html = ('<span style="position:absolute;top:50%%;right:-1px;transform:translate(50%%,-50%%);width:12px;height:12px;'
                'border-radius:50%%;background:#FFFFFF;border:2.5px solid var(--brand);'
                'box-shadow:0 0 12px 2px rgba(var(--brand-lt-rgb),.85)"></span>') if tip and pct < 100 else ""
    return ('<div role="progressbar" aria-valuenow="%d" aria-valuemin="0" aria-valuemax="100" aria-label="%s" '
            'style="position:relative;height:%dpx;border-radius:999px;'
            'background-image:linear-gradient(180deg,rgba(var(--sh),.14),rgba(var(--sh),.07));'
            'box-shadow:0 1px 2px rgba(var(--sh),.14) inset,0 1px 0 rgba(255,255,255,.6);overflow:visible">'
            '<div class="bar-fill" style="position:relative;height:100%%;width:%d%%;border-radius:999px;animation-delay:%s;'
            'background-image:linear-gradient(90deg,var(--brand-deep),var(--brand) 55%%,var(--brand-lt));'
            'box-shadow:0 1px 0 rgba(255,255,255,.45) inset,0 4px 14px -3px rgba(var(--brand-rgb),.9)">%s</div></div>'
            % (pct, label, h, pct, delay, tip_html))

def skel(w, h, r=999, cls="", style=""):
    return f'<span class="skel {cls}" style="display:block;width:{w};height:{h}px;border-radius:{r}px;{style}"></span>'
