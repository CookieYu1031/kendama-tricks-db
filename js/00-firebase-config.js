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
    apiKey: "YOUR_API_KEY",
    authDomain: "kendama-tricks-db.firebaseapp.com",
    projectId: "kendama-tricks-db",
    storageBucket: "kendama-tricks-db.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  };

  firebase.initializeApp(firebaseConfig);
  var fbAuth = firebase.auth();
  var fbStore = firebase.firestore();
