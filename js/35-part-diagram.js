"use strict";

  /* ============================================================
     PART DIAGRAM (v0.9.3) — inline SVG kendama with one clickable region per part key
     (PART_KEYS in js/01). Parts the trick has light up (theme accent); the rest stay muted.
     The art is isolated in PD_SHAPES below (part key -> shape data): swap that table (and
     PD_VIEWBOX) to change the drawing; everything else is generic.
     Everything on the ken (spike, cup, handle) is symmetric about the vertical axis x = 360.
     Hierarchy (PART_PARENT in js/01): kenchou's shape also covers the tip, chuzara's covers the
     rim; the child is drawn on top so it can be lit alone. A lit parent marks the child ".inh".
     partDiagramSvg() is pure (tests/part-diagram.test.js); createPartDiagram() is the reusable
     component (drawer, search panel, submission form).
     Colors come from CSS (.part-diagram in css/detail-drawer.css), so light / dark follow the theme.
  ============================================================ */
  var PD_VIEWBOX = "135 100 860 930";
  var PD_STRING_A = "M360 380C400 378 430 340 445 312C455 295 468 288 475 302";
  var PD_STRING_B = "M462 505C458 545 456 580 470 610C485 635 520 640 545 628C580 610 590 575 585 558C580 552 560 560 548 575" +
    "C520 610 500 640 515 670C525 685 545 680 570 665C610 640 650 600 655 548C655 540 645 545 635 555C610 580 585 620 560 660" +
    "C530 700 530 725 555 727C590 725 640 690 665 655C690 625 705 600 700 586C690 580 670 600 655 615C625 645 625 670 650 686" +
    "C690 692 720 668 745 655C770 640 770 615 748 612C728 615 715 645 740 662C770 668 800 660 815 665C820 672 818 678 818 683";
  var PD_SARA_BODY = "M222 278C255 335 300 350 335 348L385 348C420 350 465 335 498 278L498 538C465 505 420 480 385 472L335 472C300 480 255 505 222 538Z";
  var PD_RIM_L = "M153 288Q153 278 175 273Q205 268 224 276L224 540Q190 548 160 534Q153 531 153 524Z";
  var PD_RIM_R = "M567 288Q567 278 545 273Q515 268 496 276L496 540Q530 548 560 534Q567 531 567 524Z";
  // Geometry table. Draw order = paint order (later parts sit on top of earlier ones).
  // Shape kinds: d (path), line (stroked path), circle [cx,cy,r], ellipse [cx,cy,rx,ry], rect [x,y,w,h,rx] (dashed),
  // hit = extra transparent hit radius for tiny targets.
  var PD_SHAPES = [
    { key:"sara",        d: PD_SARA_BODY },
    { key:"saraEdge",    d: PD_RIM_L + PD_RIM_R },
    { key:"kenchou",     d:"M360 118L385 146L385 342Q385 363 360 363Q335 363 335 342L335 146Z" },   // spike incl. tip
    { key:"kensaki",     d:"M335 166L335 146L360 118L385 146L385 166Z" },
    { key:"kenBody",     d:"M325 470Q360 450 395 470L398 512C400 610 410 705 428 765L292 765C310 705 320 610 322 512Z" },
    { key:"suberidome",  d:"M292 765C280 775 268 780 268 795C268 806 278 808 285 812L435 812C442 808 452 806 452 795C452 780 440 775 428 765Z" },
    { key:"chuzara",     d:"M285 812C288 850 278 890 270 920C264 940 255 948 249 952L246 990Q246 1000 258 1002Q360 1010 462 1002Q474 1000 474 990L471 952C465 948 456 940 450 920C442 890 432 850 435 812Z" },  // incl. rim
    { key:"chuzaraEdge", d:"M249 952Q360 966 471 952L474 990Q474 1000 462 1002Q360 1010 258 1002Q246 1000 246 990Z" },
    { key:"junction",    rect:[306, 436, 108, 66, 8] },   // dashed box: where the body meets the cups (not a physical part)
    { key:"string",      d: PD_STRING_A + PD_STRING_B, line:true },
    { key:"tamaTop",     circle:[818, 848, 164] },
    { key:"tamaPoint",   circle:[818, 712, 14], hit:24, dot:true },
    { key:"ana",         ellipse:[818, 990, 58, 22] }
  ];

  function pdShapeMarkup(s){
    if(s.circle) return '<circle class="pd-shape' + (s.dot ? " pd-dot" : "") + '" cx="' + s.circle[0] + '" cy="' + s.circle[1] + '" r="' + s.circle[2] + '"/>' +
      (s.hit ? '<circle class="pd-hit" cx="' + s.circle[0] + '" cy="' + s.circle[1] + '" r="' + s.hit + '"/>' : "");
    if(s.ellipse) return '<ellipse class="pd-shape" cx="' + s.ellipse[0] + '" cy="' + s.ellipse[1] + '" rx="' + s.ellipse[2] + '" ry="' + s.ellipse[3] + '"/>' +
      '<ellipse class="pd-inner" cx="' + s.ellipse[0] + '" cy="' + (s.ellipse[1] - 5) + '" rx="' + (s.ellipse[2] * 0.52) + '" ry="7"/>';
    if(s.rect) return '<rect class="pd-shape pd-dash" x="' + s.rect[0] + '" y="' + s.rect[1] + '" width="' + s.rect[2] + '" height="' + s.rect[3] + '" rx="' + s.rect[4] + '"/>';
    if(s.line) return '<path class="pd-shape pd-line" d="' + s.d + '"/><path class="pd-hit pd-hit-line" d="' + s.d + '"/>';
    return '<path class="pd-shape" d="' + s.d + '"/>';
  }

  // Visual state of one part: "on" (selected), "inh" (parent selected -> area lit too),
  // "sub" (cup lit alone tints the rims softly) or "".
  function pdPartState(key, sel){
    if(sel.indexOf(key) !== -1) return "on";
    if(typeof PART_PARENT !== "undefined" && PART_PARENT[key] && sel.indexOf(PART_PARENT[key]) !== -1) return "inh";
    if(key === "saraEdge" && sel.indexOf("sara") !== -1) return "sub";
    return "";
  }
  function pdPartClass(key, sel){
    var st = pdPartState(key, sel);
    return "pd-part" + (st ? " " + st : "");
  }

  // selectedParts: array of part keys. interactive: regions are clickable (edit mode).
  // Returns the svg markup; each part is <g class="pd-part [on|inh|sub]" data-part="key">.
  function partDiagramSvg(selectedParts, interactive){
    var sel = selectedParts || [];
    var svg = '<svg class="part-diagram' + (interactive ? " interactive" : "") + '" viewBox="' + PD_VIEWBOX + '" xmlns="http://www.w3.org/2000/svg" role="img">';
    PD_SHAPES.forEach(function(s){
      var on = sel.indexOf(s.key) !== -1;
      var title = typeof t === "function" ? t("part_" + s.key) : s.key;
      svg += '<g class="' + pdPartClass(s.key, sel) + '" data-part="' + s.key + '"' +
        (interactive ? ' role="button" tabindex="0" aria-pressed="' + (on ? "true" : "false") + '"' : "") + '>' +
        '<title>' + escapeHtml(title) + '</title>' + pdShapeMarkup(s) + '</g>';
    });
    return svg + '</svg>';
  }

  // Reusable component. opts: { selected: [keys], interactive: bool, onToggle: fn(key), info: bool (adds the 部位 ⓘ title) }.
  // Returns a div.part-diagram-box with:
  //   .update(selected)  re-colors the existing svg in place (no DOM replacement) and remembers the list
  //   .selected          the current key list (array copy)
  // Interactive: click / Enter / Space on a region calls onToggle(key); the caller changes its own data
  // and calls box.update(newList). Each region has a <title> (accessible name) and, when
  // interactive, tabindex=0, role=button and aria-pressed.
  function createPartDiagram(opts){
    opts = opts || {};
    var box = document.createElement("div");
    box.className = "part-diagram-box";
    box.selected = (opts.selected || []).slice();
    box.innerHTML = partDiagramSvg(box.selected, !!opts.interactive);
    if(opts.info){ // "部位 ⓘ" title above the drawing (opens js/48-modal-part-info.js)
      var info = document.createElement("button");
      info.type = "button";
      info.className = "grip-info-link grip-info-title part-info-title";
      info.textContent = t("partTitle") + " ⓘ";
      info.addEventListener("click", function(ev){
        ev.stopPropagation();
        if(typeof openPartInfo === "function") openPartInfo();
      });
      box.classList.add("has-info");
      box.insertBefore(info, box.firstChild);
    }
    box.update = function(selected){
      box.selected = (selected || []).slice();
      var groups = box.querySelectorAll("[data-part]");
      for(var i = 0; i < groups.length; i++){
        var g = groups[i], k = g.getAttribute("data-part");
        g.setAttribute("class", pdPartClass(k, box.selected));
        if(opts.interactive) g.setAttribute("aria-pressed", box.selected.indexOf(k) !== -1 ? "true" : "false");
      }
    };
    if(opts.interactive && opts.onToggle){
      var fire = function(ev){
        if(ev.target.closest && ev.target.closest(".part-info-title")) return;
        var g = ev.target.closest ? ev.target.closest("[data-part]") : null;
        if(g) opts.onToggle(g.getAttribute("data-part"));
      };
      box.addEventListener("click", fire);
      box.addEventListener("keydown", function(ev){
        if(ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); fire(ev); }
      });
    }
    return box;
  }

  // Back-compat wrapper (drawer view mode).
  function buildPartDiagram(tr, interactive, onToggle, info){
    return createPartDiagram({ selected: tr.parts || [], interactive: interactive, onToggle: onToggle, info: !!info });
  }
