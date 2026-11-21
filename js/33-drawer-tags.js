"use strict";

  /* ============================================================
     DRAWER TAGS — the two tag rows of the trick drawer (v0.9.2):
     招式類別 (class tags, carry a grip+parts combo) and 標籤 (text tags).
     Edit mode shows suggestions both ways (never auto-applied):
       grip+parts -> matching class tags;  class tag -> 「套用 …」 for its combo.
     Pure helpers are in js/30-drawer-logic.js (tests/tags.test.js).
  ============================================================ */
  addStrings({
    zh:{ classTagsLabel:"招式類別", addClassTag:"加入類別", suggestedClassHint:"符合持法與部位，點一下加入", applyComboBtn:"套用 {combo}", applyComboTitle:"把持法與部位設成此類別" },
    jp:{ classTagsLabel:"技のカテゴリ", addClassTag:"カテゴリを追加", suggestedClassHint:"持ち方と部位に一致。タップで追加", applyComboBtn:"{combo} を適用", applyComboTitle:"持ち方と部位をこのカテゴリに合わせる" },
    en:{ classTagsLabel:"Trick class", addClassTag:"Add class", suggestedClassHint:"Matches grip and parts - tap to add", applyComboBtn:"Apply {combo}", applyComboTitle:"Set grip and parts to this class" }
  });

  function makeTagChip(label, kind, onClick, extraClass){
    var b = makeChip(label, false, onClick);
    if(kind === "class") b.classList.add("tag-class");
    if(extraClass) b.classList.add(extraClass);
    return b;
  }

  // Class row: chips (+ x in edit mode), dashed suggestions, add picker, "apply combo" buttons.
  function buildDrawerClassRow(tr, canEditTrick, expandContent){
    var chips = trickTagChips(tr, "class");
    var anyClass = (db.tags || []).some(function(g){ return tagKind(g) === "class"; });
    if(!chips.length && !(canEditTrick && anyClass)) return;
    expandContent.appendChild(makeLabel(t("classTagsLabel")));
    var wrap = document.createElement("div");
    wrap.className = "drawer-chip-row";
    chips.forEach(function(c){
      var chip = canEditTrick
        ? makeTagChip(c.label + " ×", "class", function(){
            tr.tagIds = (tr.tagIds || []).filter(function(x){ return x !== c.id; });
            saveDB(); renderDrawer();
          })
        : makeTagChip(c.label, "class", null);
      if(canEditTrick) chip.title = t("removeTagFromTrick");
      wrap.appendChild(chip);
    });
    if(canEditTrick){
      classTagSuggestions(tr).forEach(function(c){
        var s = makeTagChip("+ " + c.label, "class", function(){
          tr.tagIds = (tr.tagIds || []).concat([c.id]);
          saveDB(); renderDrawer();
        }, "tag-suggest");
        s.title = t("suggestedClassHint");
        wrap.appendChild(s);
      });
      wrap.appendChild(makeChip("+ " + t("addClassTag"), drawerUi.classPickerFor === tr.id, function(){
        drawerUi.classPickerFor = drawerUi.classPickerFor === tr.id ? null : tr.id; renderDrawer();
      }));
    }
    expandContent.appendChild(wrap);
    if(!canEditTrick) return;
    // Class tag whose combo differs from the trick: offer to apply it.
    var applyRow = null;
    chips.forEach(function(c){
      var tag = getTag(c.id);
      if(!classComboGap(tr, tag)) return;
      if(!applyRow){ applyRow = document.createElement("div"); applyRow.className = "drawer-chip-row"; }
      var b = document.createElement("button");
      b.type = "button"; b.className = "drawer-chip tag-apply";
      b.textContent = t("applyComboBtn").replace("{combo}", comboLabel(tag.combo));
      b.title = c.label + " · " + t("applyComboTitle");
      b.addEventListener("click", function(){ applyClassCombo(tr, tag); saveDB(); renderDrawer(); });
      applyRow.appendChild(b);
    });
    if(applyRow) expandContent.appendChild(applyRow);
    if(drawerUi.classPickerFor === tr.id){
      var pick = document.createElement("div");
      pick.className = "drawer-tag-picker";
      var row = document.createElement("div");
      row.className = "drawer-chip-row";
      availableTagChips(tr, "class").forEach(function(c){
        row.appendChild(makeTagChip("+ " + c.label, "class", function(){
          tr.tagIds = (tr.tagIds || []).concat([c.id]);
          saveDB(); renderDrawer();
        }));
      });
      pick.appendChild(row);
      expandContent.appendChild(pick);
    }
  }

  // Tags: class row, then text-tag row (chips on the trick + edit-mode add picker).
  function buildDrawerTags(tr, canEditTrick, expandContent){
    buildDrawerClassRow(tr, canEditTrick, expandContent);
    var tagChips = trickTagChips(tr, "text");
    if(tagChips.length || canEditTrick){
      expandContent.appendChild(makeLabel(t("tagsLabel")));
      var tagWrap = document.createElement("div");
      tagWrap.className = "drawer-chip-row";
      tagChips.forEach(function(c){
        var chip;
        if(canEditTrick){
          chip = makeChip(c.label + " ×", false, function(){
            tr.tagIds = (tr.tagIds || []).filter(function(x){ return x !== c.id; });
            saveDB(); renderDrawer();
          });
          chip.title = t("removeTagFromTrick");
        } else chip = makeChip(c.label, false);
        tagWrap.appendChild(chip);
      });
      if(canEditTrick){
        tagWrap.appendChild(makeChip("+ " + t("addTag"), drawerUi.tagPicker, function(){
          drawerUi.tagPicker = !drawerUi.tagPicker; renderDrawer();
        }));
      }
      expandContent.appendChild(tagWrap);
      if(canEditTrick && drawerUi.tagPicker){
        var picker = document.createElement("div");
        picker.className = "drawer-tag-picker";
        var pickRow = document.createElement("div");
        pickRow.className = "drawer-chip-row";
        var isAdmin = typeof isAdminAccount === "function" && isAdminAccount();
        availableTagChips(tr, "text").forEach(function(c){
          pickRow.appendChild(makeChip("+ " + c.label, false, function(){
            tr.tagIds = (tr.tagIds || []).concat([c.id]);
            saveDB(); renderDrawer();
          }));
          if(isAdmin){
            var delTag = document.createElement("button");
            delTag.type = "button"; delTag.className = "drawer-chip drawer-chip-danger";
            delTag.title = t("deleteTagGlobal"); delTag.innerHTML = ICON_TRASH;
            delTag.addEventListener("click", function(){
              openConfirm(t("confirmDeleteTagTitle"), t("confirmDeleteTagBody"), function(){
                removeTag(c.id); renderColumns(); renderDrawer();
              });
            });
            pickRow.appendChild(delTag);
          }
        });
        picker.appendChild(pickRow);
        var newRow = document.createElement("div");
        newRow.className = "drawer-tag-new";
        var newInp = document.createElement("input");
        newInp.type = "text"; newInp.className = "drawer-inline-input"; newInp.placeholder = t("newTagPlaceholder");
        var newBtn = document.createElement("button");
        newBtn.type = "button"; newBtn.className = "col-add-btn";
        newBtn.innerHTML = ICON_PLUS + "<span>" + escapeHtml(t("addTag")) + "</span>";
        var submitTag = function(){
          if(addTagToTrick(tr, newInp.value, state.lang)) renderDrawer();
        };
        newBtn.addEventListener("click", submitTag);
        newInp.addEventListener("keydown", function(ev){ if(ev.key === "Enter"){ ev.preventDefault(); submitTag(); } });
        newRow.appendChild(newInp); newRow.appendChild(newBtn);
        picker.appendChild(newRow);
        expandContent.appendChild(picker);
      }
    }
  }
