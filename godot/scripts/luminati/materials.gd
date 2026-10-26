class_name LumMaterials
extends RefCounted
## Builds Godot ShaderMaterials for the baked three.js materials (tools/godot-bake/extract.js).
##
## A baked material has a `kind` (terrain, terrain_var, terrain_decal(_var), lit, wind_solid,
## foliage, foliage_billboard, ground_foliage, water, waterfall, waterfall_pool, flame, glow) and
## the three.js parameters (map, normalMap, emissiveMap, alphaMap, alphaTest, side, vertexColors …).
## Surface variants are compiled from res://shaders/lum_surface.gdshaderinc with `#define`s, one
## Shader per variant (cached), exactly like the engine's onBeforeCompile program keys.

const SURFACE_INC := "res://shaders/lum_surface.gdshaderinc"

static var _shader_cache := {}
static var _texture_cache := {}

var textures: Array = []          ## baked texture entries (with `path`)
var materials: Array = []         ## ShaderMaterial per baked material index
var entries: Array = []           ## the baked material entries
## Materials whose emissive intensity follows the day / night (window, lantern glass): index → entry
var emissive_materials := {}


func _init(baked_materials: Array, baked_textures: Array) -> void:
	textures = baked_textures
	entries = baked_materials
	for m in baked_materials:
		materials.append(_build(m))


func get_material(index: int) -> Material:
	return materials[index] if index >= 0 and index < materials.size() else null


func texture_of(ref) -> Texture2D:
	if ref == null or not (ref is Dictionary) or not ref.has("id"):
		return null
	var t: Dictionary = textures[int(ref.id)]
	var path = t.get("path")
	if path == null or path == "":
		return null
	if _texture_cache.has(path):
		return _texture_cache[path]
	var tex: Texture2D = load(path) if ResourceLoader.exists(path) else _load_raw(path)
	_texture_cache[path] = tex
	return tex


## A PNG that the editor has not imported yet (first run straight after a bake).
static func _load_raw(path: String) -> Texture2D:
	var img := Image.load_from_file(ProjectSettings.globalize_path(path))
	if img == null or img.is_empty():
		push_warning("[Luminati] missing texture %s" % path)
		return null
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)


static func surface_shader(defines: Array, render_mode: String) -> Shader:
	var key := ",".join(defines) + "|" + render_mode
	if _shader_cache.has(key):
		return _shader_cache[key]
	var code := "shader_type spatial;\nrender_mode %s;\n" % render_mode
	for d in defines:
		code += "#define %s\n" % d
	code += "#include \"%s\"\n" % SURFACE_INC
	var sh := Shader.new()
	sh.code = code
	_shader_cache[key] = sh
	return sh


static func file_shader(path: String) -> Shader:
	if not _shader_cache.has(path):
		_shader_cache[path] = load(path)
	return _shader_cache[path]


func _map_transform(ref) -> Vector4:
	if ref is Dictionary and ref.has("repeat"):
		return Vector4(ref.repeat[0], ref.repeat[1], ref.offset[0], ref.offset[1])
	return Vector4(1, 1, 0, 0)


func _build(m: Dictionary) -> Material:
	var kind: String = m.get("kind", "lit")
	match kind:
		"water":
			return _water(m)
		"waterfall":
			return _waterfall(m)
		"waterfall_pool":
			return _pool(m)
		"flame":
			return _flame(m)
		"glow":
			return _glow(m)
		"ground_foliage":
			return _ground_foliage(m)
	return _surface(m, kind)


func _surface(m: Dictionary, kind: String) -> ShaderMaterial:
	var defines: Array = []
	var modes: Array = ["ambient_light_disabled", "specular_disabled"]
	if m.get("side", "front") == "double":
		modes.append("cull_disabled")
	elif m.get("side") == "back":
		modes.append("cull_front")
	if m.get("vertexColors", false):
		defines.append("LUM_VERTEX_COLOR")
	if m.get("normalMap") != null:
		defines.append("LUM_NORMAL")
	if m.get("emissiveMap") != null:
		defines.append("LUM_EMISSIVE")
	if kind.begins_with("terrain"):
		defines.append("LUM_BOUNCE")
	if kind.begins_with("terrain_decal"):
		defines.append("LUM_DECAL")
		defines.append("LUM_LIFT")
		modes.append("skip_vertex_transform")
	if kind.ends_with("_var"):
		defines.append("LUM_VARIATION")
	if kind in ["wind_solid", "foliage", "foliage_billboard"]:
		defines.append("LUM_WIND")
	if kind == "foliage_billboard":
		defines.append("LUM_BILLBOARD")
	if kind in ["foliage", "foliage_billboard"]:
		defines.append("LUM_FOLIAGE")
	var mat := ShaderMaterial.new()
	mat.shader = surface_shader(defines, ", ".join(modes))
	mat.resource_name = m.get("name", "")
	var col: Color = Lum.lin(m.get("color"))
	mat.set_shader_parameter("base_color", Color(col.r, col.g, col.b, m.get("opacity", 1.0)))
	var tex := texture_of(m.get("map"))
	if tex:
		mat.set_shader_parameter("map", tex)
	mat.set_shader_parameter("map_transform", _map_transform(m.get("map")))
	mat.set_shader_parameter("alpha_scissor", m.get("alphaTest", 0.0))
	if m.get("normalMap") != null:
		mat.set_shader_parameter("normal_map", texture_of(m.normalMap))
		var ns = m.get("normalScale")
		mat.set_shader_parameter("normal_scale", Vector2(ns[0], ns[1]) if ns is Array else Vector2.ONE)
	if m.get("emissiveMap") != null:
		mat.set_shader_parameter("emissive_map", texture_of(m.emissiveMap))
		mat.set_shader_parameter("emissive_color", Lum.lin(m.get("emissive"), Color(1, 0.72, 0.44)))
		mat.set_shader_parameter("emissive_intensity", m.get("emissiveIntensity", 1.0))
		emissive_materials[int(m.id)] = mat
	if m.get("alphaMap") != null:
		mat.set_shader_parameter("alpha_map", texture_of(m.alphaMap))
	var u: Dictionary = m.get("uniforms", {})
	if u.has("lmUnits"):
		mat.set_shader_parameter("lm_units", Vector2(u.lmUnits[0], u.lmUnits[1]))
		mat.set_shader_parameter("lm_var_seed", u.lmVarSeed)
	if u.has("uLmBounce"):
		mat.set_shader_parameter("lm_bounce", u.uLmBounce)
	if kind in ["foliage", "foliage_billboard"]:
		# props/Wind.js FOLIAGE_WRAP (0.45 unless the material says otherwise)
		mat.set_shader_parameter("wrap_light", m.get("userData", {}).get("wrap", 0.45))
	mat.render_priority = clampi(int(m.get("renderOrder", 0)), -128, 127) if kind.begins_with("terrain_decal") else 0
	return mat


func _u(m: Dictionary, key: String, fallback = null):
	return m.get("uniforms", {}).get(key, fallback)


func _ucolor(m: Dictionary, key: String, fallback := Color(1, 1, 1)) -> Color:
	var v = _u(m, key)
	if v is Dictionary and v.has("color"):
		return Lum.lin(v.color, fallback)
	if v is Array:
		return Lum.lin(v, fallback)
	return fallback


func _ufloat(m: Dictionary, key: String, fallback := 0.0) -> float:
	var v = _u(m, key)
	return float(v) if (v is float or v is int) else fallback


func _water(m: Dictionary) -> ShaderMaterial:
	var mat := ShaderMaterial.new()
	mat.shader = file_shader("res://shaders/lum_water.gdshader")
	mat.resource_name = "luminati:water"
	var shore = _u(m, "uShore")
	if shore is Dictionary and shore.has("texture"):
		mat.set_shader_parameter("shore", texture_of(shore.texture))
	var rect = _u(m, "uShoreRect", [0, 0, 1, 1])
	mat.set_shader_parameter("shore_rect", Vector4(rect[0], rect[1], rect[2], rect[3]))
	for pair in [["uMaxDist", "max_dist"], ["uMaxDepth", "max_depth"], ["uMaxFlow", "max_flow"], ["uOpacity", "opacity"],
			["uShallowOpacity", "shallow_opacity"], ["uGlint", "glint_amount"], ["uFoamAmount", "foam_amount"],
			["uBrightness", "brightness"], ["uDeepAt", "deep_at"], ["uReflect", "reflect_amount"],
			["uSaturation", "saturation"], ["uNeutral", "neutral"]]:
		var v = _u(m, pair[0])
		if v != null:
			mat.set_shader_parameter(pair[1], float(v))
	for pair in [["uC0", "c0"], ["uC1", "c1"], ["uC2", "c2"], ["uC3", "c3"], ["uCrest", "crest"], ["uFoam", "foam_color"]]:
		mat.set_shader_parameter(pair[1], _ucolor(m, pair[0]))
	mat.render_priority = 10
	return mat


func _waterfall(m: Dictionary) -> ShaderMaterial:
	var mat := ShaderMaterial.new()
	mat.shader = file_shader("res://shaders/lum_waterfall.gdshader")
	mat.resource_name = "luminati:waterfall"
	mat.set_shader_parameter("width_units", _ufloat(m, "uWidth", 2.0))
	mat.set_shader_parameter("length_units", _ufloat(m, "uLength", 2.0))
	mat.set_shader_parameter("lip_length", _ufloat(m, "uLipLength", 0.3))
	mat.set_shader_parameter("seed", _ufloat(m, "uSeed", 0.0))
	for pair in [["uC0", "c0"], ["uC1", "c1"], ["uC2", "c2"], ["uC3", "c3"], ["uFoam", "foam_color"]]:
		mat.set_shader_parameter(pair[1], _ucolor(m, pair[0]))
	mat.render_priority = 11
	return mat


func _pool(m: Dictionary) -> ShaderMaterial:
	var mat := ShaderMaterial.new()
	mat.shader = file_shader("res://shaders/lum_waterfall_pool.gdshader")
	mat.resource_name = "luminati:waterfall_pool"
	mat.set_shader_parameter("foam_color", _ucolor(m, "uFoam"))
	mat.set_shader_parameter("c0", _ucolor(m, "uC0"))
	var size = _u(m, "uSize", [2, 1])
	mat.set_shader_parameter("size", Vector2(size[0], size[1]))
	mat.set_shader_parameter("seed", _ufloat(m, "uSeed", 0.0))
	return mat


func _flame(m: Dictionary) -> ShaderMaterial:
	var mat := ShaderMaterial.new()
	mat.shader = file_shader("res://shaders/lum_flame.gdshader")
	mat.resource_name = "luminati:flame"
	mat.set_shader_parameter("seed", _ufloat(m, "uSeed"))
	mat.set_shader_parameter("intensity", _ufloat(m, "uIntensity", 1.0))
	mat.set_shader_parameter("speed", _ufloat(m, "uSpeed", 1.0))
	mat.set_shader_parameter("lift", _ufloat(m, "uLift", 0.02))
	var px = _u(m, "uPx", [8, 12])
	mat.set_shader_parameter("px_size", Vector2(px[0], px[1]))
	var fire = _u(m, "uFire")
	if fire is Dictionary and fire.has("colors"):
		for i in range(mini(6, fire.colors.size())):
			mat.set_shader_parameter("fire%d" % i, Lum.lin(fire.colors[i]))
	return mat


func _glow(m: Dictionary) -> ShaderMaterial:
	var mat := ShaderMaterial.new()
	mat.shader = file_shader("res://shaders/lum_glow.gdshader")
	mat.resource_name = "luminati:glow"
	mat.set_shader_parameter("seed", _ufloat(m, "uSeed"))
	mat.set_shader_parameter("intensity", _ufloat(m, "uIntensity", 0.6))
	mat.set_shader_parameter("day", _ufloat(m, "uDay", 0.25))
	mat.set_shader_parameter("lift", _ufloat(m, "uLift", -0.05))
	mat.set_shader_parameter("base_v", _ufloat(m, "uBaseV", -1.0))
	mat.set_shader_parameter("color", _ucolor(m, "uColor", Color(1, 0.54, 0.23)))
	mat.render_priority = 55
	return mat


func _ground_foliage(m: Dictionary) -> ShaderMaterial:
	var mat := ShaderMaterial.new()
	mat.shader = file_shader("res://shaders/lum_ground_foliage.gdshader")
	mat.resource_name = m.get("name", "foliage")
	mat.set_shader_parameter("map", texture_of(m.get("map")))
	mat.set_shader_parameter("map_transform", _map_transform(m.get("map")))
	mat.set_shader_parameter("alpha_scissor", m.get("alphaTest", 0.5))
	return mat


## Ground-foliage parameters live on the mesh (Foliage uniforms), not the material.
static func apply_foliage_params(mat: ShaderMaterial, params: Dictionary) -> ShaderMaterial:
	var m := mat.duplicate() as ShaderMaterial
	var map := {"uFoliageWind": "foliage_wind", "uAnchorY": "anchor_y", "uQuadHeight": "quad_height", "uFrameU": "frame_u",
		"uRootDarken": "root_darken", "uNormalUp": "normal_up", "uWrap": "wrap_light", "uRoundness": "roundness"}
	for k in map:
		if params.has(k):
			m.set_shader_parameter(map[k], float(params[k]))
	return m
