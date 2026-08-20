"use strict";

  /* ============================================================
     FIREBASE CONFIG
     ------------------------------------------------------------
     請至 Firebase Console → 專案設定（齒輪圖示）→ 一般 → 往下捲到「您的應用程式」
     若尚未新增過 Web 應用程式，按「新增應用程式」→ 選網頁（</>）→ 註冊後
     就會看到下面這一整段 firebaseConfig，直接複製貼上取代掉即可。

     專案網址：https://console.firebase.google.com/project/kendama-tricks-db/settings/general
  ============================================================ */
  var firebaseConfig = {
    apiKey: "AIzaSyC8WoG060LEUqmbkA1gpBhqH0UTDexTsA0",
    authDomain: "kendama-tricks-db.firebaseapp.com",
    projectId: "kendama-tricks-db",
    storageBucket: "kendama-tricks-db.firebasestorage.app",
    messagingSenderId: "173554266047",
    appId: "1:173554266047:web:70c0c2b0984e5564773b0a",
    measurementId: "G-KT97NVE6Y5"
  };

  firebase.initializeApp(firebaseConfig);
  var fbAuth = firebase.auth();
  var fbStore = firebase.firestore();
