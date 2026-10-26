class_name LumBakedWorld
extends RefCounted
## Loads a level baked by tools/godot-bake (levels/<id>/world.json + world.bin) and builds its
## scene: terrain, water, props, trees, ground foliage, flames — the geometry the Luminati engine
## generated, with Godot materials (LumMaterials). Gameplay data (tiles, colliders, interactables,
## lights, villagers, camera) is read from the same manifest by the game.

var id := ""
var manifest: Dictionary = {}
var bin := PackedByteArray()
var mats: LumMaterials
var root: Node3D
## Animated parts (windmill sails): [{ node: Node3D, axis: Vector3, speed: float }]
var animated: Array = []


func load_level(level_id: String) -> bool:
	id = level_id
	var dir := "%s/%s" % [Lum.LEVELS_DIR, level_id]
	var json_path := dir + "/world.json"
	if not FileAccess.file_exists(json_path):
		push_error("[Luminati] level %s is not baked (%s missing). Run: node tools/godot-bake/bake.mjs %s" % [level_id, json_path, level_id])
		return false
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(json_path))
	if not (parsed is Dictionary):
		push_error("[Luminati] %s: unreadable manifest" % json_path)
		return false
	manifest = parsed
	if FileAccess.file_exists(dir + "/world.bin.gz"):
		bin = FileAccess.get_file_as_bytes(dir + "/world.bin.gz").decompress(int(manifest.get("binBytes", 0)), FileAccess.COMPRESSION_GZIP)
	else:
		bin = FileAccess.get_file_as_bytes(dir + "/world.bin")
	if bin.is_empty():
		push_error("[Luminati] %s: no geometry data" % dir)
		return false
	return true


# ------------------------------------------------------------------------------------------------
# Binary access (offsets and lengths written by bake.mjs)
# ------------------------------------------------------------------------------------------------

func _bytes(ref: Dictionary, elem_size: int) -> PackedByteArray:
	var off := int(ref.offset)
	return bin.slice(off, off + int(ref.length) * elem_size)


func f32(ref: Dictionary) -> PackedFloat32Array:
	return _bytes(ref, 4).to_float32_array()


func i32(ref: Dictionary) -> PackedInt32Array:
	return _bytes(ref, 4).to_int32_array()


func u8(ref: Dictionary) -> PackedByteArray:
	return _bytes(ref, 1)


func _vec3(ref: Dictionary) -> PackedVector3Array:
	return _bytes(ref, 4).to_vector3_array()


func _vec2(ref: Dictionary) -> PackedVector2Array:
	return _bytes(ref, 4).to_vector2_array()


func _colors(ref: Dictionary) -> PackedColorArray:
	return _bytes(ref, 4).to_color_array()


# ------------------------------------------------------------------------------------------------
# Scene
# ------------------------------------------------------------------------------------------------

func build() -> Node3D:
	mats = LumMaterials.new(manifest.get("materials", []), manifest.get("textures", []))
	root = Node3D.new()
	root.name = "World"
	var anim_roots := {}
	for i in range(manifest.get("animated", []).size()):
		var a: Dictionary = manifest.animated[i]
		var pivot := Node3D.new()
		pivot.name = "Anim_%s_%d" % [a.get("kind", "part"), i]
		pivot.transform = Lum.transform_from_three(a.matrix)
		root.add_child(pivot)
		anim_roots[i] = pivot
		var ax = a.get("axisLocal", [0, 0, 1])
		animated.append({"node": pivot, "axis": Vector3(ax[0], ax[1], ax[2]).normalized(), "speed": float(a.get("speed", 0.5)),
			"base": pivot.transform})
	var count := 0
	for m in manifest.get("meshes", []):
		var node := _build_mesh(m)
		if node == null:
			continue
		var tag: String = m.get("tag", "static")
		if tag.begins_with("anim:"):
			var ai := int(tag.substr(5))
			var pivot: Node3D = anim_roots.get(ai)
			if pivot:
				# exported in world space: re-express relative to the turning pivot
				node.transform = pivot.transform.affine_inverse() * node.transform
				pivot.add_child(node)
				count += 1
				continue
		root.add_child(node)
		count += 1
	return root


func _build_mesh(m: Dictionary) -> GeometryInstance3D:
	var attrs: Dictionary = m.get("attrs", {})
	if not attrs.has("position"):
		return null
	var positions := _vec3(attrs.position)
	var normals := _vec3(attrs.normal) if attrs.has("normal") else PackedVector3Array()
	var uvs := _vec2(attrs.uv) if attrs.has("uv") else PackedVector2Array()
	var uv2s := _vec2(attrs.uv1) if attrs.has("uv1") else PackedVector2Array()
	var colors := _colors(attrs.color) if attrs.has("color") and int(attrs.color.itemSize) == 4 else PackedColorArray()
	var custom0 := f32(attrs.custom0) if attrs.has("custom0") else PackedFloat32Array()
	var custom1 := f32(attrs.custom1) if attrs.has("custom1") else PackedFloat32Array()
	var index := i32(m.index) if m.get("index") != null else PackedInt32Array()
	var vcount := positions.size()
	if normals.size() != vcount:
		normals = PackedVector3Array()
	var mesh := ArrayMesh.new()
	var flags := 0
	if custom0.size() == vcount * 4:
		flags |= (Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM0_SHIFT)
	if custom1.size() == vcount * 4:
		flags |= (Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM1_SHIFT)
	var groups: Array = m.get("groups", [])
	var surface := 0
	for g in groups:
		var arrays := []
		arrays.resize(Mesh.ARRAY_MAX)
		var start := int(g.start)
		var cnt := int(g.count)
		if cnt <= 0:
			continue
		if index.size() > 0:
			# one surface per group: the whole vertex set, the group's slice of the index
			arrays[Mesh.ARRAY_VERTEX] = positions
			if normals.size() == vcount: arrays[Mesh.ARRAY_NORMAL] = normals
			if uvs.size() == vcount: arrays[Mesh.ARRAY_TEX_UV] = uvs
			if uv2s.size() == vcount: arrays[Mesh.ARRAY_TEX_UV2] = uv2s
			if colors.size() == vcount: arrays[Mesh.ARRAY_COLOR] = colors
			if custom0.size() == vcount * 4: arrays[Mesh.ARRAY_CUSTOM0] = custom0
			if custom1.size() == vcount * 4: arrays[Mesh.ARRAY_CUSTOM1] = custom1
			var idx := index.slice(start, start + cnt)
			# three.js winds front faces counter-clockwise, Godot clockwise: swap two corners
			_flip_winding(idx)
			arrays[Mesh.ARRAY_INDEX] = idx
		else:
			arrays[Mesh.ARRAY_VERTEX] = _flip_tris_v3(positions.slice(start, start + cnt))
			if normals.size() == vcount: arrays[Mesh.ARRAY_NORMAL] = _flip_tris_v3(normals.slice(start, start + cnt))
			if uvs.size() == vcount: arrays[Mesh.ARRAY_TEX_UV] = _flip_tris_v2(uvs.slice(start, start + cnt))
			if uv2s.size() == vcount: arrays[Mesh.ARRAY_TEX_UV2] = _flip_tris_v2(uv2s.slice(start, start + cnt))
			if colors.size() == vcount: arrays[Mesh.ARRAY_COLOR] = _flip_tris_c(colors.slice(start, start + cnt))
			if custom0.size() == vcount * 4: arrays[Mesh.ARRAY_CUSTOM0] = _flip_tris_f4(custom0.slice(start * 4, (start + cnt) * 4))
			if custom1.size() == vcount * 4: arrays[Mesh.ARRAY_CUSTOM1] = _flip_tris_f4(custom1.slice(start * 4, (start + cnt) * 4))
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays, [], {}, flags)
		var mat := mats.get_material(int(g.material))
		if m.has("foliage") and mat is ShaderMaterial:
			mat = LumMaterials.apply_foliage_params(mat, m.foliage)
		mesh.surface_set_material(surface, mat)
		surface += 1
	if surface == 0:
		return null
	var node: GeometryInstance3D
	if m.has("multimesh") and int(m.get("instanceCount", 0)) > 0:
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.use_colors = true
		mm.use_custom_data = true
		mm.mesh = mesh
		mm.instance_count = int(m.instanceCount)
		mm.buffer = f32(m.multimesh)
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		node = mmi
	else:
		var mi := MeshInstance3D.new()
		mi.mesh = mesh
		node = mi
	node.name = (m.get("name", "") as String).replace(":", "_").replace("/", "_").replace("@", "_")
	if node.name == "":
		node.name = "Mesh"
	node.transform = Lum.transform_from_three(m.matrix)
	node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if m.get("castShadow", false) else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# sway, billboarding and multimesh instances reach past the mesh's own bounds
	node.extra_cull_margin = 2.0
	return node


static func _flip_winding(idx: PackedInt32Array) -> void:
	var n := idx.size() - idx.size() % 3
	var i := 0
	while i < n:
		var t := idx[i + 1]
		idx[i + 1] = idx[i + 2]
		idx[i + 2] = t
		i += 3


static func _flip_tris_v3(a: PackedVector3Array) -> PackedVector3Array:
	var i := 0
	while i + 2 < a.size():
		var t := a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t
		i += 3
	return a


static func _flip_tris_v2(a: PackedVector2Array) -> PackedVector2Array:
	var i := 0
	while i + 2 < a.size():
		var t := a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t
		i += 3
	return a


static func _flip_tris_c(a: PackedColorArray) -> PackedColorArray:
	var i := 0
	while i + 2 < a.size():
		var t := a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t
		i += 3
	return a


static func _flip_tris_f4(a: PackedFloat32Array) -> PackedFloat32Array:
	var i := 0
	while i + 11 < a.size():
		for k in range(4):
			var t := a[i + 4 + k]; a[i + 4 + k] = a[i + 8 + k]; a[i + 8 + k] = t
		i += 12
	return a


## Turn the animated parts (windmill sails); `wind` scales the speed like the engine (0.6 + 0.4 × strength).
func update(dt: float, wind_strength: float) -> void:
	for a in animated:
		var node: Node3D = a.node
		node.rotate_object_local(a.axis, a.speed * dt * (0.6 + 0.4 * wind_strength))
