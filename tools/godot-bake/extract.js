/**
 * tools/godot-bake/extract.js — runs INSIDE the game page (game.html?autostart=1&level=…) once the
 * level is built (`window.__game` exists). It reads the live three.js world the Luminati engine
 * built and turns it into plain data for the Godot port:
 *
 *   window.__lumBake = {
 *     manifest: {...},          // JSON: meshes, materials, textures, sprites, gameplay data
 *     buffers: Uint8Array[],    // binary vertex / index / instance data, addressed by the manifest
 *     images: { [id]: dataURL } // PNG data URLs of every texture and sprite sheet
 *   }
 *
 * Nothing in the page is changed except that the render loop is stopped (the bake does not need
 * frames). Positions stay in the mesh's own space; each mesh carries its world matrix.
 *
 * The file is plain JavaScript evaluated as a function body: `return (async () => …)()`.
 */
return (async () => {
  const g = window.__game;
  const THREE = await import('three');
  const world = g.world;
  const level = g.level;

  // stop drawing: the bake only reads the built scene
  try { g.engine.renderer.setAnimationLoop(null); } catch { /* not every build exposes it */ }
  try { g.engine.stop?.(); } catch { /* ignore */ }

  const buffers = [];
  let bufferBytes = 0;
  /** Store a typed array; returns { buffer, offset, length, type }. */
  const BUF_LIMIT = 32 * 1024 * 1024;
  function store(arr) {
    const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    let b = buffers[buffers.length - 1];
    if (!b || b.used + bytes.length > BUF_LIMIT) {
      b = { data: new Uint8Array(Math.max(BUF_LIMIT, bytes.length)), used: 0 };
      buffers.push(b);
    }
    // 4-byte alignment
    b.used = (b.used + 3) & ~3;
    const offset = b.used;
    b.data.set(bytes, offset);
    b.used += bytes.length;
    bufferBytes += bytes.length;
    const type = arr instanceof Float32Array ? 'f32' : arr instanceof Uint32Array ? 'u32' : arr instanceof Uint16Array ? 'u16'
      : arr instanceof Int16Array ? 'i16' : arr instanceof Uint8Array ? 'u8' : arr instanceof Int8Array ? 'i8' : 'f32';
    return { buffer: buffers.length - 1, offset, length: arr.length, type };
  }

  // ---------------------------------------------------------------------------------------------
  // Textures
  // ---------------------------------------------------------------------------------------------
  const textures = [];
  const texIndex = new Map();
  const images = {};

  /**
   * PNG data URL of an image. `flip`: write the rows bottom-up — three.js uploads canvas textures
   * with flipY, so uv (0, 0) is the image's bottom-left; a flipped PNG puts that row on top, where
   * Godot's uv (0, 0) is, and the Godot shaders can use three's UVs exactly as they are.
   */
  function imageToDataURL(img, flip = false) {
    if (!img) return null;
    const cache = flip ? flipCache : rawCache;
    if (cache.has(img)) return cache.get(img);
    let url = imageToDataURLRaw(img);
    if (url && flip) {
      const src = typeof img.getContext === 'function' || (typeof OffscreenCanvas !== 'undefined' && img instanceof OffscreenCanvas)
        ? img : dataCanvas.get(url);
      if (src) {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.translate(0, img.height); ctx.scale(1, -1); ctx.drawImage(src, 0, 0);
        url = c.toDataURL('image/png');
      }
    }
    cache.set(img, url);
    return url;
  }
  const rawCache = new Map();
  const flipCache = new Map();
  /** The canvases DataTextures were drawn into (for flipping). */
  const dataCanvas = new Map();

  function imageToDataURLRaw(img) {
    let url = null;
    if (typeof HTMLCanvasElement !== 'undefined' && img instanceof HTMLCanvasElement) url = img.toDataURL('image/png');
    else if (typeof OffscreenCanvas !== 'undefined' && img instanceof OffscreenCanvas) {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      url = c.toDataURL('image/png');
    } else if (img.data && img.width && img.height) {
      // DataTexture: RGBA8 or RGBA float
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      const id = ctx.createImageData(img.width, img.height);
      const src = img.data;
      const ch = src.length / (img.width * img.height);
      for (let p = 0; p < img.width * img.height; p++) {
        for (let k = 0; k < 4; k++) {
          let v = k < ch ? src[p * ch + k] : 255;
          if (src instanceof Float32Array) v = Math.round(Math.max(0, Math.min(1, v)) * 255);
          id.data[p * 4 + k] = k === 3 && ch < 4 ? 255 : v;
        }
      }
      // DataTextures are not flipped by three (flipY false): data row 0 is uv v = 0, which is the
      // PNG's top row — Godot's uv v = 0 too
      ctx.putImageData(id, 0, 0);
      url = c.toDataURL('image/png');
      dataCanvas.set(url, c);
    } else if (img.width && img.height && typeof img.getContext !== 'function') {
      try {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        url = c.toDataURL('image/png');
      } catch { url = null; }
    }
    return url;
  }

  function texRef(tex) {
    if (!tex || !tex.isTexture) return null;
    const img = tex.image;
    const key = img || tex;
    if (texIndex.has(key)) {
      const id = texIndex.get(key);
      return { id, offset: [tex.offset.x, tex.offset.y], repeat: [tex.repeat.x, tex.repeat.y], rotation: tex.rotation, channel: tex.channel ?? 0 };
    }
    const id = textures.length;
    const url = imageToDataURL(img, !!tex.flipY);
    const isData = !!(img && img.data);
    textures.push({
      id,
      name: tex.name || '',
      width: img?.width ?? 0,
      height: img?.height ?? 0,
      // three's flipY (canvas textures): the PNG is written bottom-up (see imageToDataURL), so
      // in Godot every texture is sampled with three's own UVs
      flipY: !!tex.flipY,
      dataTexture: isData,
      srgb: tex.colorSpace === THREE.SRGBColorSpace,
      wrapS: tex.wrapS === THREE.RepeatWrapping ? 'repeat' : tex.wrapS === THREE.MirroredRepeatWrapping ? 'mirror' : 'clamp',
      wrapT: tex.wrapT === THREE.RepeatWrapping ? 'repeat' : tex.wrapT === THREE.MirroredRepeatWrapping ? 'mirror' : 'clamp',
      nearest: tex.magFilter === THREE.NearestFilter,
      mipmaps: !!tex.generateMipmaps || (tex.minFilter !== THREE.NearestFilter && tex.minFilter !== THREE.LinearFilter),
      ok: !!url,
    });
    if (url) images[`tex${id}`] = url;
    texIndex.set(key, id);
    return { id, offset: [tex.offset.x, tex.offset.y], repeat: [tex.repeat.x, tex.repeat.y], rotation: tex.rotation, channel: tex.channel ?? 0 };
  }

  // ---------------------------------------------------------------------------------------------
  // Materials
  // ---------------------------------------------------------------------------------------------
  const materials = [];
  const matIndex = new Map();
  // three.js' own lighting / fog uniforms (UniformsLib) are not material parameters
  const THREE_BUILTIN_UNIFORMS = new Set(Object.values(THREE.UniformsLib).flatMap((u) => Object.keys(u)));
  const col = (c) => (c && c.isColor ? [c.r, c.g, c.b] : null);

  function uniformValue(u) {
    const v = u?.value;
    if (v == null) return null;
    if (typeof v === 'number' || typeof v === 'boolean') return v;
    if (v.isColor) return { color: [v.r, v.g, v.b] };
    if (v.isVector2) return [v.x, v.y];
    if (v.isVector3) return [v.x, v.y, v.z];
    if (v.isVector4) return [v.x, v.y, v.z, v.w];
    if (v.isTexture) return { texture: texRef(v) };
    if (v.isMatrix3 || v.isMatrix4) return { matrix: Array.from(v.elements) };
    if (Array.isArray(v) && v.every((x) => typeof x === 'number')) return v;
    if (Array.isArray(v) && v.length && v.every((x) => x && x.isColor)) return { colors: v.map((c) => [c.r, c.g, c.b]) };
    if (Array.isArray(v) && v.length && v.every((x) => x && (x.isVector2 || x.isVector3 || x.isVector4))) return { vectors: v.map((c) => c.toArray()) };
    if (v instanceof Float32Array) return Array.from(v);
    return null;
  }

  /** A material's kind for the Godot side (which shader template it gets). */
  function materialKind(m) {
    const n = m.name || '';
    if (m.isShaderMaterial || m.isRawShaderMaterial) {
      if (/Water$/i.test(n) || n === 'Luminati:Water') return 'water';
      if (/WaterfallPool/i.test(n)) return 'waterfall_pool';
      if (/Waterfall/i.test(n)) return 'waterfall';
      if (/flame/i.test(n)) return 'flame';
      if (/glow/i.test(n)) return 'glow';
      return 'shader';
    }
    if (n.startsWith('TileMap:decal:')) return n.endsWith(':var') ? 'terrain_decal_var' : 'terrain_decal';
    if (n.startsWith('TileMap:')) return n.endsWith(':var') ? 'terrain_var' : 'terrain';
    if (m.userData?.wind) return m.userData.billboard ? 'foliage_billboard' : (n.includes('foliage') ? 'foliage' : 'wind_solid');
    if (m.userData?.luminatiFoliage || m.userData?.foliage) return 'ground_foliage';
    if (m.isMeshBasicMaterial) return 'basic';
    return 'lit';
  }

  function matRef(m, mesh) {
    if (matIndex.has(m)) return matIndex.get(m);
    const id = materials.length;
    const entry = {
      id,
      name: m.name || '',
      type: m.type,
      kind: materialKind(m),
      side: m.side === THREE.DoubleSide ? 'double' : m.side === THREE.BackSide ? 'back' : 'front',
      transparent: !!m.transparent,
      opacity: m.opacity ?? 1,
      alphaTest: m.alphaTest ?? 0,
      depthWrite: m.depthWrite !== false,
      depthTest: m.depthTest !== false,
      blending: m.blending,
      vertexColors: !!m.vertexColors,
      color: col(m.color),
      emissive: col(m.emissive),
      emissiveIntensity: m.emissiveIntensity ?? 0,
      map: texRef(m.map),
      normalMap: texRef(m.normalMap),
      normalScale: m.normalScale ? [m.normalScale.x, m.normalScale.y] : null,
      emissiveMap: texRef(m.emissiveMap),
      alphaMap: texRef(m.alphaMap),
      polygonOffset: m.polygonOffset ? [m.polygonOffsetFactor, m.polygonOffsetUnits] : null,
      userData: {},
      uniforms: {},
      renderOrder: mesh?.renderOrder ?? 0,
    };
    for (const [k, v] of Object.entries(m.userData || {})) {
      if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') entry.userData[k] = v;
      else if (Array.isArray(v) && v.every((x) => typeof x === 'number')) entry.userData[k] = v;
    }
    if (m.uniforms) {
      for (const [k, u] of Object.entries(m.uniforms)) {
        if (THREE_BUILTIN_UNIFORMS.has(k)) continue;
        const val = uniformValue(u);
        if (val !== null) entry.uniforms[k] = val;
      }
    }
    if (m.defines) entry.defines = { ...m.defines };
    // the TileMap variation constants (TileMap._patchMaterial): units of the texture, seed
    if (entry.kind.endsWith('_var')) {
      const texName = entry.name.replace(/^TileMap:(decal:)?/, '').replace(/:var$/, '');
      const meta = world.textures.meta(texName);
      entry.uniforms.lmUnits = meta.units;
      entry.uniforms.lmVarSeed = (world.tileMap.seed % 997) * 0.731 + 3.17;
    }
    if (entry.kind.startsWith('terrain')) entry.uniforms.uLmBounce = world.tileMap.wallBounce;
    materials.push(entry);
    matIndex.set(m, id);
    return id;
  }

  // ---------------------------------------------------------------------------------------------
  // Meshes
  // ---------------------------------------------------------------------------------------------
  const meshes = [];

  function attrData(a) {
    if (!a) return null;
    if (a.isInterleavedBufferAttribute) {
      const out = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
      return out;
    }
    const arr = a.array;
    if (arr instanceof Float32Array) return arr.subarray(0, a.count * a.itemSize);
    // normalise integer attributes to float (three's `normalized` flag)
    const out = new Float32Array(a.count * a.itemSize);
    const div = a.normalized ? (arr instanceof Uint8Array ? 255 : arr instanceof Uint16Array ? 65535 : arr instanceof Int8Array ? 127 : arr instanceof Int16Array ? 32767 : 1) : 1;
    for (let i = 0; i < out.length; i++) out[i] = arr[i] / div;
    return out;
  }

  /** Is this object visible in the colour pass (it and all its parents)? */
  function shown(o) {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  }

  function exportMesh(o, tag) {
    const geo = o.geometry;
    if (!geo || !geo.attributes?.position) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.every((m) => m.colorWrite === false)) return; // shadow-only proxies
    const attrs = {};
    const n = geo.attributes.position.count;
    for (const [name, a] of Object.entries(geo.attributes)) {
      if (a.isInstancedBufferAttribute) continue;
      let d = attrData(a);
      if (!d) continue;
      let itemSize = a.itemSize;
      if (name === 'color' && itemSize === 3) {
        // Godot vertex colours are RGBA
        const c4 = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) { c4[i * 4] = d[i * 3]; c4[i * 4 + 1] = d[i * 3 + 1]; c4[i * 4 + 2] = d[i * 3 + 2]; c4[i * 4 + 3] = 1; }
        d = c4; itemSize = 4;
      }
      attrs[name] = { ...store(d), itemSize };
    }
    // Godot CUSTOM0 / CUSTOM1 (RGBA float): wind (aSway, aPhase), leaf-card pivots (aCenter), the
    // water's surface height on its cross-sections (aTop)
    const sway = geo.attributes.aSway, phase = geo.attributes.aPhase, center = geo.attributes.aCenter, top = geo.attributes.aTop;
    if (sway || phase || top) {
      const c0 = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        c0[i * 4] = top ? top.getX(i) : sway ? sway.getX(i) : 0;
        c0[i * 4 + 1] = phase ? phase.getX(i) : 0;
      }
      attrs.custom0 = { ...store(c0), itemSize: 4 };
    }
    if (center) {
      const c1 = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { c1[i * 4] = center.getX(i); c1[i * 4 + 1] = center.getY(i); c1[i * 4 + 2] = center.getZ(i); }
      attrs.custom1 = { ...store(c1), itemSize: 4 };
    }
    let index = null;
    if (geo.index) {
      const ia = geo.index.array;
      index = store(ia instanceof Uint32Array ? ia.subarray(0, geo.index.count) : new Uint32Array(Array.from(ia.subarray(0, geo.index.count))));
    }
    const groups = (geo.groups && geo.groups.length ? geo.groups : [{ start: 0, count: index ? geo.index.count : geo.attributes.position.count, materialIndex: 0 }])
      .map((gr) => ({ start: gr.start, count: gr.count, material: matRef(mats[gr.materialIndex ?? 0] ?? mats[0], o) }));
    const entry = {
      name: o.name || '',
      parent: o.parent?.name || '',
      tag,
      matrix: Array.from(o.matrixWorld.elements),
      vertexCount: geo.attributes.position.count,
      attrs,
      index,
      groups,
      castShadow: !!o.castShadow,
      receiveShadow: !!o.receiveShadow,
      renderOrder: o.renderOrder ?? 0,
      drawRange: [geo.drawRange.start, geo.drawRange.count],
    };
    if (o.isInstancedMesh) {
      entry.instanceCount = o.count;
      // Godot MultiMesh buffer: per instance a row-major 3×4 transform, RGBA colour, custom data
      // (x = the sprite-strip frame, aFrame)
      {
        const im = o.instanceMatrix.array;
        const ic = o.instanceColor?.array ?? null;
        const fr = geo.attributes.aFrame?.array ?? null;
        const buf = new Float32Array(o.count * 20);
        for (let i = 0; i < o.count; i++) {
          const e = i * 16, b = i * 20;
          buf[b] = im[e]; buf[b + 1] = im[e + 4]; buf[b + 2] = im[e + 8]; buf[b + 3] = im[e + 12];
          buf[b + 4] = im[e + 1]; buf[b + 5] = im[e + 5]; buf[b + 6] = im[e + 9]; buf[b + 7] = im[e + 13];
          buf[b + 8] = im[e + 2]; buf[b + 9] = im[e + 6]; buf[b + 10] = im[e + 10]; buf[b + 11] = im[e + 14];
          buf[b + 12] = ic ? ic[i * 3] : 1; buf[b + 13] = ic ? ic[i * 3 + 1] : 1; buf[b + 14] = ic ? ic[i * 3 + 2] : 1; buf[b + 15] = 1;
          buf[b + 16] = fr ? fr[i] : 0;
        }
        entry.multimesh = store(buf);
      }
      entry.instanceMatrix = store(o.instanceMatrix.array.subarray(0, o.count * 16));
      entry.instanceAttrs = {};
      for (const [name, a] of Object.entries(geo.attributes)) {
        if (!a.isInstancedBufferAttribute) continue;
        entry.instanceAttrs[name] = { ...store(attrData(a).subarray(0, o.count * a.itemSize)), itemSize: a.itemSize };
      }
    }
    meshes.push(entry);
  }

  world.root.updateMatrixWorld(true);
  // animated parts: a group flagged `userData.dynamic` (a windmill's sails) is left out of the
  // static merge and turned by its prop's update(); its meshes are exported relative to it
  const animated = [];
  const animIndex = new Map();
  /** Ground-foliage fields (GroundDetail → Foliage): their instanced mesh → shader parameters. */
  const foliageOf = new Map();
  for (const f of world.groundDetail?.fields ?? []) {
    const mesh = f.mesh ?? f.object ?? null;
    if (!mesh) continue;
    const u = {};
    for (const [k, v] of Object.entries(f._uniforms ?? {})) {
      if (['uTime', 'uCameraYaw', 'uWind', 'uWindStrength'].includes(k)) continue;
      const val = uniformValue(v);
      if (val !== null) u[k] = val;
    }
    foliageOf.set(mesh, u);
  }
  world.root.traverse((o) => {
    if (!o.isMesh || !shown(o)) return;
    let tag = 'static';
    for (let p = o.parent; p && p !== world.root; p = p.parent) {
      if (p.userData?.dynamic) {
        if (!animIndex.has(p)) {
          animIndex.set(p, animated.length);
          animated.push({ kind: /sail/i.test(p.name) ? 'sails' : 'dynamic', name: p.name, matrix: Array.from(p.matrixWorld.elements),
            // windmill sails: rotation.z -= dt · speed · (0.6 + 0.4 · windStrength) (props/Structures.js)
            axisLocal: [0, 0, 1], speed: -0.55 });
        }
        tag = `anim:${animIndex.get(p)}`;
        break;
      }
    }
    const before = meshes.length;
    exportMesh(o, tag);
    if (meshes.length > before && foliageOf.has(o)) {
      const e = meshes[meshes.length - 1];
      e.foliage = foliageOf.get(o);
      for (const gr of e.groups) materials[gr.material].kind = 'ground_foliage';
    }
  });

  // ---------------------------------------------------------------------------------------------
  // Gameplay data
  // ---------------------------------------------------------------------------------------------
  const tm = world.tileMap;
  const tiles = new Array(tm.width * tm.depth);
  const tileH = new Float32Array(tm.width * tm.depth);
  const tileWater = new Float32Array(tm.width * tm.depth);
  // flags: 1 exists (not void), 2 walkable, 4 water, 8 blocked; stairs: 16 N, 32 S, 64 E, 128 W
  const tileFlags = new Uint8Array(tm.width * tm.depth);
  const STAIR = { N: 16, S: 32, E: 64, W: 128 };
  for (let j = 0; j < tm.depth; j++) {
    for (let i = 0; i < tm.width; i++) {
      const t = tm.tileAt(i, j);
      const k = j * tm.width + i;
      if (!t) { tileFlags[k] = 0; tileH[k] = tm.baseY; tileWater[k] = NaN; continue; }
      tileFlags[k] = 1 | (t.walkable ? 2 : 0) | (t.water ? 4 : 0) | (t.blocked ? 8 : 0) | (t.stairs ? STAIR[t.stairs] : 0);
      tileH[k] = t.h;
      tileWater[k] = t.water && t.waterSurface != null ? t.waterSurface : NaN;
      tiles[k] = t.char;
    }
  }
  const colliders = tm.colliders.filter((c) => !c.dynamic).map((c) => (c.type === 'circle'
    ? { type: 'circle', x: c.x, z: c.z, r: c.r }
    : { type: 'box', minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ }));
  const walkSurfaces = tm.walkSurfaces.map((r) => ({ minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ, y: r.y }));

  const v3 = (v) => (v ? [v.x, v.y, v.z] : null);
  const interactables = (world.interactables ?? []).map((it) => ({
    id: it.id, kind: it.kind, label: it.label, position: v3(it.position), radius: it.radius, prompt: v3(it.prompt),
    lookSpan: it.lookSpan ? { a: v3(it.lookSpan.a), b: v3(it.lookSpan.b) } : null,
    text: it.text ? { speaker: it.text.speaker ?? '', lines: it.text.lines ?? [], sfx: it.text.sfx ?? null, keys: it.text.keys ?? null,
      speakerDefault: it.text.speakerDefault ?? null, linesDefault: it.text.linesDefault ?? null } : null,
  }));

  const lightDescs = (world._lightDescs ?? []).map((d) => ({
    position: v3(d.position), color: (() => { try { const c = new THREE.Color(d.color ?? 0xffb46b); return [c.r, c.g, c.b]; } catch { return [1, 0.7, 0.42]; } })(),
    intensity: d.intensity ?? 8, distance: d.distance ?? 8, decay: d.decay ?? 2, flicker: d.flicker ?? 0.3,
    nightOnly: d.nightOnly ?? true, dayIntensity: d.dayIntensity ?? null, priority: d.priority ?? null, seed: d.seed ?? null,
    flickerSpeed: d.flickerSpeed ?? 2.6, tag: d.tag ?? '',
  }));

  const emissives = (world.emissiveEntries ?? []).map((e) => ({
    material: matIndex.has(e.material) ? matIndex.get(e.material) : -1, name: e.material?.name ?? '', day: e.day, night: e.night, baseDay: e.baseDay ?? e.day,
  }));

  // characters: the player and every villager (their generated sprite sheets)
  const sheets = [];
  const sheetIndex = new Map();
  function sheetRef(sheet) {
    if (!sheet) return -1;
    if (sheetIndex.has(sheet)) return sheetIndex.get(sheet);
    const id = sheets.length;
    const canvas = sheet.canvas ?? sheet.texture?.image;
    const url = imageToDataURL(canvas);
    if (url) images[`sheet${id}`] = url;
    sheets.push({
      id, name: sheet.name ?? '', frameWidth: sheet.frameWidth, frameHeight: sheet.frameHeight, columns: sheet.columns, rows: sheet.rows,
      pixelsPerUnit: sheet.pixelsPerUnit ?? 16, anchor: sheet.anchor ?? [0.5, 0], animations: sheet.animations ?? {},
      width: canvas?.width ?? 0, height: canvas?.height ?? 0, poses: sheet.poses ?? null,
    });
    sheetIndex.set(sheet, id);
    return id;
  }

  const npcs = (g.npcs ?? []).map((n) => ({
    id: n.id, name: n.name, def: JSON.parse(JSON.stringify(n.def ?? {})), sheet: sheetRef(n.sheet),
    position: v3(n.position), wander: n.wander, speed: n.speed, behaviour: n.behaviour, talkRadius: n.talkRadius,
    talkPoint: n.talkPoint ? v3(n.talkPoint) : null, homeFacing: n.homeFacing, idleSpeed: n.idleSpeed,
    chaseBounds: n.chaseBounds ?? null,
    conversation: (() => { try { return JSON.parse(JSON.stringify(n.conversation ?? n.def?.lines ?? null)); } catch { return null; } })(),
  }));
  const player = g.player ? { sheet: sheetRef(g.player.sheet ?? g.player.sprite?.sheet), position: v3(g.player.position) } : null;

  const rig = g.rig;
  // (window.__game is the automation API; the Game instance itself is `__game.game`)
  const G = g.game ?? g;
  const framing = G.camera && !G.camera.isCamera ? { ...G.camera } : null;
  const cameraBounds = G.cameraBounds ? JSON.parse(JSON.stringify(G.cameraBounds)) : null;
  const highGround = G.highGround ? { ...G.highGround } : null;
  const camera = rig ? {
    framing, cameraBounds, highGround, lookAhead: rig.lookAhead, followLambda: rig.followLambda,
    targetOffsetY: rig.targetOffsetY, yawLimit: rig.yawLimit, rotateSpeed: rig.rotateSpeed,
    distance: rig.distance, pitch: rig.pitch, yaw: rig.yaw, fov: g.engine.camera.fov,
    minDistance: rig.minDistance, maxDistance: rig.maxDistance,
    bounds: (() => { try { return JSON.parse(JSON.stringify(rig.bounds ?? rig._bounds ?? null)); } catch { return null; } })(),
    yawLimits: (() => { try { return JSON.parse(JSON.stringify(rig.yawLimits ?? rig._yawLimits ?? null)); } catch { return null; } })(),
  } : null;

  const lighting = g.lighting ? {
    timeOfDay: g.lighting.timeOfDay, timeSpeed: g.lighting.timeSpeed,
    keyframes: g.lighting.keyframes, sunPath: g.lighting.sunPath, moonPath: g.lighting.moonPath,
    minElevation: g.lighting.minElevation, maxElevation: g.lighting.maxElevation,
    shadowExtent: g.lighting.shadowExtent, settings: { ...g.lighting.settings, backdrop: g.lighting.settings.backdrop ? col(g.lighting.settings.backdrop) : null },
  } : null;

  const manifest = {
    format: 'luminati-godot-bake', version: 1,
    level: { name: level.name, subtitle: level.subtitle, width: level.width, depth: level.depth },
    meshes, materials, textures, sheets, animated,
    gameplay: {
      tileMap: { width: tm.width, depth: tm.depth, baseY: tm.baseY, waterLevel: tm.waterLevel,
        flags: store(tileFlags), heights: store(tileH), water: store(tileWater) },
      colliders, walkSurfaces, interactables, lights: lightDescs, emissives, npcs, player, camera, lighting,
      spawn: level.spawn, environment: level.environment,
      regions: level.objects.filter((o) => o.type === 'region'),
    },
    stats: { meshes: meshes.length, materials: materials.length, textures: textures.length, bytes: bufferBytes },
  };

  window.__lumBake = { manifest, buffers: buffers.map((b) => b.data.subarray(0, b.used)), images };
  return manifest.stats;
})();
