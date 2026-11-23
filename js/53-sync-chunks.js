"use strict";

  /* ============================================================
     SYNC CHUNKS — payload splitting + the Firestore read/write of a user's cloud data
     (C3: no single document over 1MB). Pure helpers first (unit tested), Firestore after.
  ============================================================ */
  var CHUNK_CHARS = 200000;                 // <= 800KB UTF-8 per chunk doc (cap is 1MB)
  var BATCH_MAX_BYTES = 9 * 1024 * 1024;    // Firestore request cap is ~10MiB
  var BATCH_MAX_OPS = 400;                  // batch cap is 500 writes

  // Splits a string into pieces of at most `size` chars, never cutting a surrogate pair.
  function splitPayload(str, size){
    size = size || CHUNK_CHARS;
    str = String(str);
    var out = [];
    var i = 0;
    while(i < str.length){
      var end = Math.min(i + size, str.length);
      if(end < str.length){
        var c = str.charCodeAt(end - 1);
        if(c >= 0xD800 && c <= 0xDBFF && end - 1 > i) end--;
      }
      out.push(str.slice(i, end));
      i = end;
    }
    if(!out.length) out.push("");
    return out;
  }
  function joinChunks(pieces){ return (pieces || []).join(""); }

  // Indexes (as strings) of chunk docs that exist but are no longer needed.
  function staleChunkIndexes(oldCount, newCount){
    var out = [];
    for(var i = newCount; i < (oldCount || 0); i++) out.push(String(i));
    return out;
  }

  // FNV-1a 32-bit + length: cheap change detector (not security).
  function hashString(str){
    var h = 0x811c9dc5;
    for(var i = 0; i < str.length; i++){
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(16) + "-" + str.length.toString(16);
  }

  function utf8Bytes(str){
    var n = 0;
    for(var i = 0; i < str.length; i++){
      var c = str.charCodeAt(i);
      if(c < 0x80) n += 1;
      else if(c < 0x800) n += 2;
      else if(c >= 0xD800 && c <= 0xDBFF){ n += 4; i++; }
      else n += 3;
    }
    return n;
  }

  // ops: [{ kind:"set"|"delete", path, data?, ts?, bytes }] -> array of batches (order kept),
  // each within maxBytes / maxOps. One oversized op still gets its own batch.
  function planBatches(ops, maxBytes, maxOps){
    maxBytes = maxBytes || BATCH_MAX_BYTES;
    maxOps = maxOps || BATCH_MAX_OPS;
    var batches = [], cur = [], bytes = 0;
    ops.forEach(function(op){
      var b = op.bytes || 100;
      if(cur.length && (cur.length >= maxOps || bytes + b > maxBytes)){
        batches.push(cur); cur = []; bytes = 0;
      }
      cur.push(op); bytes += b;
    });
    if(cur.length) batches.push(cur);
    return batches;
  }

  // All write ops that replace one payload stored as {docPath} header + {docPath}/chunks/{i}.
  // headerData excludes the timestamp field (updatedAt, or `tsField`), added on commit.
  function buildChunkedOps(docPath, payload, headerData, oldCount, tsField){
    var pieces = splitPayload(payload);
    var ops = [];
    pieces.forEach(function(p, i){
      ops.push({ kind: "set", path: docPath + "/chunks/" + i, data: { data: p }, bytes: utf8Bytes(p) + 100 });
    });
    var header = Object.assign({}, headerData, { chunks: pieces.length });
    ops.push({ kind: "set", path: docPath, data: header, ts: tsField || true, bytes: 500 });
    staleChunkIndexes(oldCount, pieces.length).forEach(function(i){
      ops.push({ kind: "delete", path: docPath + "/chunks/" + i, bytes: 100 });
    });
    return ops;
  }

  /* ------------------------------------------------------------
     Firestore I/O
  ------------------------------------------------------------ */
  function commitOps(ops){
    var batches = planBatches(ops);
    var chain = Promise.resolve();
    batches.forEach(function(list){
      chain = chain.then(function(){
        var batch = fbStore.batch();
        list.forEach(function(op){
          var ref = fbStore.doc(op.path);
          if(op.kind === "delete"){ batch.delete(ref); return; }
          var data = Object.assign({}, op.data);
          if(op.ts) data[typeof op.ts === "string" ? op.ts : "updatedAt"] = firebase.firestore.FieldValue.serverTimestamp();
          batch.set(ref, data);
        });
        return batch.commit().catch(function(err){
          // Name the rejected batch so a rules denial can be traced to its paths.
          console.error("Batch commit failed:", list.map(function(op){ return op.kind + " " + op.path; }));
          throw err;
        });
      });
    });
    return chain;
  }

  // Reads and joins chunk docs of `docPath`; null when a piece is missing.
  function readChunkedPayload(docPath, count){
    if(!count) return Promise.resolve(null);
    return fbStore.collection(docPath + "/chunks").get().then(function(snap){
      var map = {};
      snap.forEach(function(d){ map[d.id] = d.data().data; });
      var pieces = [];
      for(var i = 0; i < count; i++){
        if(typeof map[String(i)] !== "string") return null;
        pieces.push(map[String(i)]);
      }
      return joinChunks(pieces);
    });
  }

  // Reads users/{uid}/meta/spaces. Only schema 2/3 counts as existing cloud data.
  function cloudReadMeta(uid){
    return fbStore.doc("users/" + uid + "/meta/spaces").get().then(function(snap){
      var meta = snap.exists ? snap.data() : null;
      var usable = !!meta && (meta.schema === 3 || meta.schema === 2);
      return {
        exists: usable, meta: usable ? meta : null,
        cloudTs: usable && typeof meta.clientUpdatedAt === "number" ? meta.clientUpdatedAt : 0
      };
    });
  }

  // One space header -> { diff, hash } (hash null for schema-2 inline headers).
  function readSpaceDiff(uid, sid, header){
    if(typeof header.chunks === "number"){
      return readChunkedPayload("users/" + uid + "/spaceData/" + sid, header.chunks).then(function(str){
        if(str === null){ console.error("Missing chunks for space", sid); return null; }
        try{ return { diff: JSON.parse(str), hash: header.hash || null }; }
        catch(e){ console.error("Bad payload for space", sid, e); return null; }
      });
    }
    if(header.added || header.modified || header.removed){
      return Promise.resolve({ diff: header, hash: null }); // schema 2 inline diff
    }
    return Promise.resolve(null);
  }

  // Cloud -> { exists, cloudTs, db, hashes }. Missing cloud data gives base-only content.
  function loadMergedDBFromCloud(uid, metaInfo){
    return (metaInfo ? Promise.resolve(metaInfo) : cloudReadMeta(uid)).then(function(mi){
      var meta = mi.meta;
      var spacesList = (meta && Array.isArray(meta.spaces) && meta.spaces.length) ? meta.spaces : null;
      var liveIds = DEFAULT_SPACE_IDS.concat((spacesList || []).map(function(sp){ return sp && sp.id; }));
      var headersP = mi.exists ? fbStore.collection("users/" + uid + "/spaceData").get() : Promise.resolve(null);
      return headersP.then(function(snap){
        var headers = {};
        if(snap) snap.forEach(function(doc){ headers[doc.id] = doc.data(); });
        var sids = Object.keys(headers).filter(function(id){ return liveIds.indexOf(id) !== -1; });
        return Promise.all(sids.map(function(sid){ return readSpaceDiff(uid, sid, headers[sid]); })).then(function(results){
          var diffMap = {}, hashes = {};
          sids.forEach(function(sid, i){
            if(!results[i]) return;
            diffMap[sid] = results[i].diff;
            if(results[i].hash) hashes[sid] = results[i].hash;
          });
          var spaceIds = Object.keys(diffMap);
          DEFAULT_SPACE_IDS.forEach(function(id){ if(spaceIds.indexOf(id) === -1) spaceIds.push(id); });
          return ensureViewingVersionResolved(uid).then(function(viewingVersion){
            return fetchSharedBaseVersion(viewingVersion).then(function(indexBase){
              var baseMap = {};
              spaceIds.forEach(function(id){ baseMap[id] = baseForSpace(indexBase, id); });
              var merged = mergeAllSpaces(spaceIds, baseMap, diffMap);
              var raw = { categories: merged.categories, tricks: merged.tricks, infos: merged.infos,
                tags: mergeTagLists(indexBase.tags, meta && meta.tags, isAdminAccount()), spaces: spacesList };
              // Labels: admin's unpublished edits come from meta.labels; everyone else gets the published base.
              if(isAdminAccount() && meta && meta.labels && typeof meta.labels === "object") raw.labels = meta.labels;
              else if(!isAdminAccount()) raw.labels = indexBase.labels || {};
              return {
                exists: mi.exists, cloudTs: mi.cloudTs, hashes: hashes,
                db: normalizeDB(raw)
              };
            });
          });
        });
      });
    });
  }

  // Writes only the spaces whose diff hash changed since the last sync, then meta/spaces
  // last (it carries clientUpdatedAt). Resolves { clientUpdatedAt, hashes, snapshot, seq }.
  function pushToCloud(uid, metaInfo){
    var seq = _mutSeq;
    return ensureViewingVersionResolved(uid).then(function(viewingVersion){
      return fetchSharedBaseVersion(viewingVersion);
    }).then(function(indexBase){
      var snapshot = JSON.parse(JSON.stringify(db));
      var ids = allKnownSpaceIds();
      var oldHashes = userCache.hashes || {};
      var newHashes = {};
      var jobs = [];
      ids.forEach(function(sid){
        var diff = computeSpaceDiff(sid, baseForSpace(indexBase, sid));
        var payload = JSON.stringify(diff);
        var h = hashString(payload);
        newHashes[sid] = h;
        if(h !== oldHashes[sid]) jobs.push({ sid: sid, diff: diff, payload: payload, hash: h });
      });
      var gone = Object.keys(oldHashes).filter(function(sid){ return ids.indexOf(sid) === -1; });
      var headerReads = jobs.map(function(j){ return j.sid; }).concat(gone).map(function(sid){
        return fbStore.doc("users/" + uid + "/spaceData/" + sid).get().then(function(s){
          return s.exists && typeof s.data().chunks === "number" ? s.data().chunks : 0;
        });
      });
      return Promise.all(headerReads).then(function(counts){
        var ops = [];
        jobs.forEach(function(j, i){
          ops = ops.concat(buildChunkedOps("users/" + uid + "/spaceData/" + j.sid, j.payload,
            { schema: CLOUD_SCHEMA, baseVersion: j.diff.baseVersion, hash: j.hash }, counts[i]));
        });
        gone.forEach(function(sid, k){
          var oldCount = counts[jobs.length + k];
          staleChunkIndexes(oldCount, 0).forEach(function(i){
            ops.push({ kind: "delete", path: "users/" + uid + "/spaceData/" + sid + "/chunks/" + i, bytes: 100 });
          });
          ops.push({ kind: "delete", path: "users/" + uid + "/spaceData/" + sid, bytes: 100 });
        });
        var clientUpdatedAt = Math.max(Date.now(), ((metaInfo && metaInfo.cloudTs) || 0) + 1);
        var metaData = { spaces: snapshot.spaces, tags: snapshot.tags, schema: CLOUD_SCHEMA, clientUpdatedAt: clientUpdatedAt };
        var labelBytes = 0;
        if(isAdminAccount()){ metaData.labels = snapshot.labels || {}; labelBytes = JSON.stringify(metaData.labels).length; }
        ops.push({ kind: "set", path: "users/" + uid + "/meta/spaces", ts: true, bytes: JSON.stringify(snapshot.spaces).length + JSON.stringify(snapshot.tags).length + labelBytes + 200,
          data: metaData });
        return commitOps(ops).then(function(){
          return { clientUpdatedAt: clientUpdatedAt, hashes: newHashes, snapshot: snapshot, seq: seq };
        });
      });
    });
  }
