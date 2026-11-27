"use strict";

  /* ============================================================
     DRAWER TAGS — the two tag rows of the trick drawer (v0.9.2):
     招式類別 (class tags, carry a grip+parts combo) and 標籤 (text tags).
     Edit mode: grip+parts -> matching class tags offered as one-tap adds; adding a class tag
     overwrites grip + parts with its combo (no 「套用」 button any more).
     Pure helpers are in js/30-drawer-logic.js (tests/tags.test.js).
  ============================================================ */
  addStrings({
    zh:{ classTagsLabel:"招式類別", addClassTag:"加入類別", suggestedClassHint:"符合握持手勢與部位，點一下加入" },
    jp:{ classTagsLabel:"技のカテゴリ", addClassTag:"カテゴリを追加", suggestedClassHint:"持ち方と部位に一致。タップで追加" },
    en:{ classTagsLabel:"Trick class", addClassTag:"Add class", suggestedClassHint:"Matches grip and parts - tap to add" }
  });

  function makeTagChip(label, kind, onClick, extraClass){
    var b = makeChip(label, false, onClick);
    if(kind === "class") b.classList.add("tag-class");
    else if(kind === "text") b.classList.add("tag-text");
    if(extraClass) b.classList.add(extraClass);
    return b;
  }

  // Class row: chips (+ x in edit mode), dashed suggestions, add picker. Adding a class tag
  // overwrites the trick's grip + parts with the combo (putTagOnTrick, js/30); removing keeps them.
  function buildDrawerClassRow(tr, canEditTrick, expandContent){
    var chips = trickTagChips(tr, "class");
    var anyClass = (db.tags || []).some(function(g){ return tagKind(g) === "class"; });
    if(!chips.length && !(canEditTrick && anyClass)) return;
    expandContent.appendChild(makeLabel(t("classTagsLabel")));
    var wrap = document.createElement("div");
    wrap.className = "drawer-chip-row";
    function addClass(id){
      putTagOnTrick(tr, id);
      saveDB(); refreshDrawerGripParts(tr); refreshDrawerTags();
    }
    chips.forEach(function(c){
      var chip = canEditTrick
        ? makeTagChip(c.label + " ×", "class", function(){
            tr.tagIds = (tr.tagIds || []).filter(function(x){ return x !== c.id; });
            saveDB(); refreshDrawerTags();
          })
        : makeTagChip(c.label, "class", null);
      chip.classList.add("active");
      if(canEditTrick) chip.title = t("removeTagFromTrick");
      wrap.appendChild(chip);
    });
    if(canEditTrick){
      classTagSuggestions(tr).forEach(function(c){
        var s = makeTagChip("+ " + c.label, "class", function(){ addClass(c.id); }, "tag-suggest");
        s.title = t("suggestedClassHint");
        wrap.appendChild(s);
      });
      wrap.appendChild(makeChip("+ " + t("addClassTag"), drawerUi.classPickerFor === tr.id, function(){
        drawerUi.classPickerFor = drawerUi.classPickerFor === tr.id ? null : tr.id; refreshDrawerTags();
      }));
    }
    expandContent.appendChild(wrap);
    if(!canEditTrick) return;
    if(drawerUi.classPickerFor === tr.id){
      var pick = document.createElement("div");
      pick.className = "drawer-tag-picker";
      var row = document.createElement("div");
      row.className = "drawer-chip-row";
      availableTagChips(tr, "class").forEach(function(c){
        row.appendChild(makeTagChip("+ " + c.label, "class", function(){ addClass(c.id); }));
      });
      pick.appendChild(row);
      expandContent.appendChild(pick);
    }
  }

  // Text-tag row (chips on the trick + edit-mode add picker).
  function buildDrawerTextRow(tr, canEditTrick, expandContent){
    var tagChips = trickTagChips(tr, "text");
    if(!tagChips.length && !canEditTrick) return;
    expandContent.appendChild(makeLabel(t("tagsLabel")));
    var tagWrap = document.createElement("div");
    tagWrap.className = "drawer-chip-row";
    tagChips.forEach(function(c){
      var chip;
      if(canEditTrick){
        chip = makeTagChip(c.label + " ×", "text", function(){
          tr.tagIds = (tr.tagIds || []).filter(function(x){ return x !== c.id; });
          saveDB(); refreshDrawerTags();
        });
        chip.title = t("removeTagFromTrick");
      } else chip = makeTagChip(c.label, "text", null);
      chip.classList.add("active");
      tagWrap.appendChild(chip);
    });
    if(canEditTrick){
      tagWrap.appendChild(makeChip("+ " + t("addTag"), drawerUi.tagPicker, function(){
        drawerUi.tagPicker = !drawerUi.tagPicker; refreshDrawerTags();
      }));
    }
    expandContent.appendChild(tagWrap);
    if(canEditTrick && drawerUi.tagPicker){
      var picker = document.createElement("div");
      picker.className = "drawer-tag-picker";
      var pickRow = document.createElement("div");
      pickRow.className = "drawer-chip-row";
      // Pick only: tags are created / deleted in the admin tag manager (js/77).
      availableTagChips(tr, "text").forEach(function(c){
        pickRow.appendChild(makeTagChip("+ " + c.label, "text", function(){
          tr.tagIds = (tr.tagIds || []).concat([c.id]);
          saveDB(); refreshDrawerTags();
        }));
      });
      picker.appendChild(pickRow);
      expandContent.appendChild(picker);
    }
  }

  // Tags: class row, then text-tag row. Lives in one box (drawerUi.tagsRef) that refreshDrawerTags()
  // re-fills in place, so tag edits do not re-render (flicker) the whole drawer.
  function fillDrawerTags(box, tr, canEditTrick){
    box.innerHTML = "";
    buildDrawerClassRow(tr, canEditTrick, box);
    buildDrawerTextRow(tr, canEditTrick, box);
  }
  function buildDrawerTags(tr, canEditTrick, expandContent){
    var box = document.createElement("div");
    box.className = "drawer-tags-sec";
    expandContent.appendChild(box);
    drawerUi.tagsRef = { box: box, tr: tr, canEdit: canEditTrick };
    fillDrawerTags(box, tr, canEditTrick);
  }
  function refreshDrawerTags(){
    var r = drawerUi.tagsRef;
    if(r && r.box.parentNode) fillDrawerTags(r.box, r.tr, r.canEdit);
  }

  // View mode (v0.9.3): class tags, text tags, grip and parts as chips on one wrapping line,
  // no labels or separate rows. Nothing is rendered when there is nothing to show.
  function buildDrawerFlowChips(tr, parent){
    var chips = [];
    if(tr.grip) chips.push(makeChip(t("grip_" + tr.grip), true));
    (tr.parts || []).forEach(function(k){ chips.push(makeChip(t("part_" + k), true)); });
    trickTagChips(tr, "class").forEach(function(c){
      var b = makeTagChip(c.label, "class", null); b.classList.add("active"); chips.push(b);
    });
    trickTagChips(tr, "text").forEach(function(c){
      var b = makeTagChip(c.label, "text", null); b.classList.add("active"); chips.push(b);
    });
    if(!chips.length) return;
    var row = document.createElement("div");
    row.className = "drawer-chip-row drawer-flow";
    chips.forEach(function(c){ row.appendChild(c); });
    parent.appendChild(row);
  }
