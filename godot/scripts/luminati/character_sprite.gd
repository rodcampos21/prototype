class_name LumCharacterSprite
extends Node3D
## An animated, lit pixel-art billboard (src/engine/sprite/Sprite3D.js): the visible quad turns to
## the camera yaw (cylindrical billboard), a shadow-only copy turns to the sun so the cast shadow is
## a full silhouette, and a soft blob darkens the ground under the feet. The sheet is a baked
## character sheet (32 × 32 frames; rows down, left, right, up; idle / walk / run animations).

const DIRECTIONS := ["down", "left", "right", "up"]

var sheet: Dictionary
var texture: Texture2D
var mesh: MeshInstance3D
var shadow_proxy: MeshInstance3D
var blob: MeshInstance3D
var material: ShaderMaterial
var proxy_material: ShaderMaterial

var direction := "down"
var animation := ""
var speed := 1.0
var playing := true
var _anim: Dictionary = {}
var _frame := 0
var _time := 0.0
var _col := 0
var _row := 0
var frame_w := 32.0
var frame_h := 32.0
var size := Vector2(2, 2)
## Called with (frame_index, animation_name) whenever the shown frame changes (footsteps).
var on_frame_change: Callable


func setup(p_sheet: Dictionary, p_texture: Texture2D, opts := {}) -> void:
	sheet = p_sheet
	texture = p_texture
	frame_w = float(sheet.get("frameWidth", 32))
	frame_h = float(sheet.get("frameHeight", 32))
	var ppu := float(sheet.get("pixelsPerUnit", 16))
	var anchor = sheet.get("anchor", [0.5, 0])
	size = Vector2(frame_w / ppu, frame_h / ppu)
	var quad := QuadMesh.new()
	quad.size = size
	quad.center_offset = Vector3(size.x * (0.5 - float(anchor[0])), size.y * (0.5 - float(anchor[1])), 0)
	material = ShaderMaterial.new()
	material.shader = preload("res://shaders/lum_sprite.gdshader")
	material.set_shader_parameter("sheet", texture)
	for k in ["normal_up", "wrap_light", "roundness", "emissive_intensity"]:
		if opts.has(k):
			material.set_shader_parameter(k, opts[k])
	mesh = MeshInstance3D.new()
	mesh.name = "Quad"
	mesh.mesh = quad
	mesh.material_override = material
	mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mesh)
	proxy_material = ShaderMaterial.new()
	proxy_material.shader = preload("res://shaders/lum_sprite_shadow.gdshader")
	proxy_material.set_shader_parameter("sheet", texture)
	shadow_proxy = MeshInstance3D.new()
	shadow_proxy.name = "ShadowProxy"
	var pquad := QuadMesh.new()
	pquad.size = size
	pquad.center_offset = quad.center_offset
	shadow_proxy.mesh = pquad
	shadow_proxy.material_override = proxy_material
	shadow_proxy.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY
	add_child(shadow_proxy)
	if opts.get("blob", true):
		var bm := ShaderMaterial.new()
		bm.shader = preload("res://shaders/lum_blob.gdshader")
		bm.set_shader_parameter("opacity", 0.5)
		var plane := PlaneMesh.new()
		var bs := Vector2(maxf(0.7, size.x * 0.52), maxf(0.36, size.x * 0.26))
		plane.size = bs
		blob = MeshInstance3D.new()
		blob.name = "Blob"
		blob.mesh = plane
		blob.material_override = bm
		blob.position.y = 0.012
		blob.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(blob)
	direction = opts.get("direction", "down") if opts.get("direction", "down") in DIRECTIONS else "down"
	play("idle")


func _resolve(name: String, dir := "") -> String:
	if dir == "":
		dir = direction
	var anims: Dictionary = sheet.get("animations", {})
	var key := "%s_%s" % [name, dir]
	if anims.has(key):
		return key
	if anims.has(name):
		return name
	return ""


func play(name: String, p_speed := -1.0, restart := false) -> void:
	var key := _resolve(name)
	if key == "":
		return
	if key == animation and not restart:
		if p_speed >= 0.0:
			speed = p_speed
		playing = true
		return
	speed = p_speed if p_speed >= 0.0 else 1.0
	_set_animation(key, true)
	playing = true


func _set_animation(key: String, reset: bool) -> void:
	_anim = sheet.animations[key]
	animation = key
	var n := maxi(1, _anim.frames.size())
	if reset:
		_frame = 0
		_time = 0.0
	else:
		_frame %= n
	var f: Dictionary = _anim.frames[_frame] if _anim.frames.size() > _frame else _anim.frames[0]
	_col = int(f.col)
	_row = int(f.row)
	_apply_frame()


func set_direction(dir: String) -> void:
	if dir == direction or not (dir in DIRECTIONS):
		return
	direction = dir
	if animation != "":
		var base := animation
		for d in DIRECTIONS:
			if animation.ends_with("_" + d):
				base = animation.substr(0, animation.length() - d.length() - 1)
				break
		var key := _resolve(base, dir)
		if key != "":
			_set_animation(key, false)


## Face a world-space vector as seen from the camera yaw (Sprite3D.directionFromVector).
func face_vector(dx: float, dz: float, yaw: float) -> void:
	var c := cos(yaw)
	var s := sin(yaw)
	var rx := dx * c - dz * s
	var rz := dx * s + dz * c
	var ax := absf(rx)
	var az := absf(rz)
	if ax < 1e-6 and az < 1e-6:
		return
	var horizontal_now := direction == "left" or direction == "right"
	var bias := 1.15
	var horizontal := ax * bias >= az if horizontal_now else ax > az * bias
	if horizontal:
		set_direction("right" if rx > 0 else "left")
	else:
		set_direction("down" if rz > 0 else "up")


func _apply_frame() -> void:
	var tw := float(sheet.get("width", frame_w * float(sheet.get("columns", 6))))
	var th := float(sheet.get("height", frame_h * float(sheet.get("rows", 4))))
	var rect := Vector4(_col * frame_w / tw, _row * frame_h / th, frame_w / tw, frame_h / th)
	material.set_shader_parameter("frame", rect)
	proxy_material.set_shader_parameter("frame", rect)


func set_opacity(v: float) -> void:
	material.set_shader_parameter("dither_opacity", v)


func update_sprite(dt: float, cam_yaw: float, sun_dir: Vector3) -> void:
	if playing and not _anim.is_empty() and _anim.frames.size() > 0:
		var fps := float(_anim.get("fps", 8.0))
		if fps <= 0.0:
			fps = 8.0
		_time += dt * speed
		var dur := 1.0 / fps
		if _time >= dur:
			var steps := floori(_time / dur)
			_time -= steps * dur
			var n: int = _anim.frames.size()
			var f := _frame + steps
			if f >= n:
				if _anim.get("loop", true) != false:
					f %= n
				else:
					f = n - 1
					playing = false
			if f != _frame:
				_frame = f
				var fr: Dictionary = _anim.frames[f]
				_col = int(fr.col)
				_row = int(fr.row)
				_apply_frame()
				if on_frame_change.is_valid():
					on_frame_change.call(f, animation)
	var own_yaw := rotation.y
	mesh.rotation = Vector3(0, cam_yaw - own_yaw, 0)
	if sun_dir.x * sun_dir.x + sun_dir.z * sun_dir.z > 1e-8:
		# facing the sun, and set back from it a little so the visible quad never falls in its own shadow
		var sun_yaw := atan2(sun_dir.x, sun_dir.z)
		shadow_proxy.rotation = Vector3(0, sun_yaw - own_yaw, 0)
		var back := Vector3(sun_dir.x, 0, sun_dir.z).normalized() * -0.35
		shadow_proxy.position = back
	if blob:
		blob.rotation = Vector3(0, cam_yaw - own_yaw, 0)
