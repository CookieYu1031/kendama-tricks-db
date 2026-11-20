// 07-id.js — 7-char time-based unique ID (spec §五.1).
// Format: [year 2 (b36, fullYear-2000)][month b36][day b36][hour b36][minute b62][second b62], local time.
// At most one ID per second: nextId() queues ahead of the clock and persists lastIssued.
"use strict";

var ID_B36 = "0123456789abcdefghijklmnopqrstuvwxyz";
var ID_B62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
var ID_CLOCK_KEY = "kendama-id-clock-v1";
var idLastIssued = null; // epoch seconds

function encodeTimeId(date){
  var y = date.getFullYear() - 2000;
  return ID_B36.charAt(Math.floor(y / 36) % 36) + ID_B36.charAt(y % 36) +
    ID_B36.charAt(date.getMonth() + 1) +
    ID_B36.charAt(date.getDate()) +
    ID_B36.charAt(date.getHours()) +
    ID_B62.charAt(date.getMinutes()) +
    ID_B62.charAt(date.getSeconds());
}

function decodeTimeId(id){
  if(!isTimeId(id)) return null;
  var y = ID_B36.indexOf(id.charAt(0)) * 36 + ID_B36.indexOf(id.charAt(1));
  var d = new Date(2000 + y, ID_B36.indexOf(id.charAt(2)) - 1, ID_B36.indexOf(id.charAt(3)),
    ID_B36.indexOf(id.charAt(4)), ID_B62.indexOf(id.charAt(5)), ID_B62.indexOf(id.charAt(6)));
  return d;
}

function isTimeId(str){
  if(typeof str !== "string" || str.length !== 7) return false;
  var i, v;
  for(i = 0; i < 5; i++) if(ID_B36.indexOf(str.charAt(i)) < 0) return false;
  for(i = 5; i < 7; i++){
    v = ID_B62.indexOf(str.charAt(i));
    if(v < 0 || v > 59) return false;
  }
  v = ID_B36.indexOf(str.charAt(2));
  if(v < 1 || v > 12) return false;
  v = ID_B36.indexOf(str.charAt(3));
  if(v < 1 || v > 31) return false;
  if(ID_B36.indexOf(str.charAt(4)) > 23) return false;
  return true;
}

function idLoadClock(){
  if(idLastIssued !== null) return idLastIssued;
  var n = 0;
  try { n = parseInt(localStorage.getItem(ID_CLOCK_KEY), 10) || 0; } catch(e){ n = 0; }
  idLastIssued = n;
  return n;
}

function nextId(isTaken){
  var sec = Math.max(Math.floor(Date.now() / 1000), idLoadClock() + 1);
  var id = encodeTimeId(new Date(sec * 1000));
  while(typeof isTaken === "function" && isTaken(id)){
    sec++;
    id = encodeTimeId(new Date(sec * 1000));
  }
  idLastIssued = sec;
  try { localStorage.setItem(ID_CLOCK_KEY, String(sec)); } catch(e){}
  return id;
}
