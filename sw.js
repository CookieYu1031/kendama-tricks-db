"use strict";
// Service worker: app shell offline. Same-origin = network-first (avoid mixing
// old/new files), fall back to cache. Firebase/Google APIs are never touched.
var CACHE_VERSION = "kdb-v0.9.1";
var SW_PRECACHE = [
  "./", "index.html", "manifest.webmanifest",
  "assets/app-icon-180.png", "assets/app-icon-192.png", "assets/app-icon-512.png",
  "assets/brand-icon.png", "assets/favicon-32-white.png", "assets/favicon-32-black.png"
];
var SW_CACHE_FIRST_HOSTS = ["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];
var SW_NETWORK_TIMEOUT = 4000;

function swParseUrl(url){
  var m = /^(https?:)\/\/([^\/?#]+)([^?#]*)/i.exec(String(url || ""));
  if(!m) return null;
  return { host: m[2].toLowerCase(), path: m[3] || "/" };
}

// Returns "network-first" | "cache-first" | "bypass".
function swRouteFor(url, method, mode, selfHost){
  if(String(method || "GET").toUpperCase() !== "GET") return "bypass";
  var u = swParseUrl(url);
  if(!u) return "bypass";
  if(!selfHost && typeof self !== "undefined" && self.location) selfHost = self.location.host;
  if(selfHost && u.host === String(selfHost).toLowerCase()){
    if(u.path.indexOf("/__/") === 0) return "bypass";
    return "network-first";
  }
  if(SW_CACHE_FIRST_HOSTS.indexOf(u.host) >= 0) return "cache-first";
  return "bypass";
}

function swNetworkFirst(req, isNav){
  return caches.open(CACHE_VERSION).then(function(cache){
    var fallback = function(){
      return cache.match(req, { ignoreSearch: isNav }).then(function(hit){
        if(hit) return hit;
        if(isNav) return cache.match("index.html", { ignoreSearch: true });
        return undefined;
      });
    };
    return new Promise(function(resolve){
      var done = false;
      var timer = setTimeout(function(){
        fallback().then(function(hit){ if(hit && !done){ done = true; resolve(hit); } });
      }, SW_NETWORK_TIMEOUT);
      fetch(req).then(function(res){
        clearTimeout(timer);
        if(res && res.ok) cache.put(req, res.clone());
        if(!done){ done = true; resolve(res); }
      }).catch(function(err){
        clearTimeout(timer);
        fallback().then(function(hit){
          if(done) return;
          done = true;
          if(hit) resolve(hit); else resolve(Response.error());
        });
      });
    });
  });
}

function swCacheFirst(req){
  return caches.open(CACHE_VERSION).then(function(cache){
    return cache.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(res){
        if(res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
        return res;
      });
    });
  });
}

if(typeof self !== "undefined" && typeof self.addEventListener === "function"){
  self.addEventListener("install", function(e){
    e.waitUntil(caches.open(CACHE_VERSION).then(function(cache){
      return Promise.all(SW_PRECACHE.map(function(p){ return cache.add(p).catch(function(){}); }));
    }).then(function(){ return self.skipWaiting(); }));
  });
  self.addEventListener("activate", function(e){
    e.waitUntil(caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE_VERSION; })
        .map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); }));
  });
  self.addEventListener("fetch", function(e){
    var req = e.request;
    var route = swRouteFor(req.url, req.method, req.mode);
    if(route === "bypass") return;
    if(route === "cache-first") e.respondWith(swCacheFirst(req));
    else e.respondWith(swNetworkFirst(req, req.mode === "navigate"));
  });
}
