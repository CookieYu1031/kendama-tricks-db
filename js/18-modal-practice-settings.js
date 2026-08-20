"use strict";

  /* ============================================================
     PRACTICE SETTINGS MODAL — the "二級介面" (secondary interface) that a
     daily-practice row's own edit button opens, so target-count / daily-
     reset editing no longer unfolds inline just because the app's global
     edit mode happens to be on.
  ============================================================ */
  var practiceSettingsTrickId = null;

  function openPracticeSettingsModal(trickId){
    var tr = getTrick(trickId);
    if(!tr) return;
    practiceSettingsTrickId = trickId;
    document.getElementById("practiceSettingsTitle").textContent = localize(tr.name);
    document.getElementById("practiceTargetLabel").textContent = t("practiceTarget");
    document.getElementById("practiceDailyResetLabel").textContent = t("practiceDailyReset");
    document.getElementById("practiceSettingsCancelBtn").textContent = t("cancel");
    document.getElementById("practiceSettingsSaveBtn").textContent = t("save");
    document.getElementById("practiceTargetInput").value = tr.target || 0;
    document.getElementById("practiceDailyResetInput").checked = !!tr.dailyReset;
    document.getElementById("practiceSettingsOverlay").classList.add("show");
  }
  function closePracticeSettingsModal(){
    document.getElementById("practiceSettingsOverlay").classList.remove("show");
    practiceSettingsTrickId = null;
  }
  function savePracticeSettingsFromModal(){
    var tr = getTrick(practiceSettingsTrickId);
    if(!tr) return closePracticeSettingsModal();
    tr.target = Math.max(0, parseInt(document.getElementById("practiceTargetInput").value, 10) || 0);
    tr.dailyReset = document.getElementById("practiceDailyResetInput").checked;
    saveDB();
    closePracticeSettingsModal();
    showToast(t("savedTrick"));
    renderColumns();
  }
