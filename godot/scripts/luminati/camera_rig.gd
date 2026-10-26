class_name LumCameraRig
extends Node
## The 2.5D "diorama" camera — a port of src/engine/core/CameraRig.js with the game's framing
## (src/game/Game.js `_updatePlayCamera` / `_updateCameraBounds`): a narrow 28° lens far away at a
## high pitch, following the player with look-ahead, orbiting on Q / E within ±60°, zooming with
## Z / X or the wheel, the focus clamped to bounds that widen from near to far zoom, a tilt on
## high ground and a narrower yaw near the east / west map edges.

var camera: Camera3D
var target: Node3D

var min_distance := 18.0
var max_distance := 42.0
var follow_lambda := 5.0
var follow_lambda_y := 3.5
var look_ahead := 1.3
var look_ahead_speed := 4.0
var look_ahead_lambda := 2.2
var velocity_lambda := 8.0
var target_offset_y := 1.0
var yaw_limit := deg_to_rad(60.0)
var rotate_speed := deg_to_rad(70.0)
var rotate_lambda := 7.0
var pitch_lambda := 6.0
var zoom_lambda := 6.0
var zoom_key_speed := 14.0
var wheel_zoom_scale := 0.012 * 120.0
var min_pitch := deg_to_rad(8.0)
var max_pitch := deg_to_rad(80.0)
var auto_snap_distance := 8.0
var input_enabled := true

var yaw_center := 0.0
var focus := Vector3.ZERO
var yaw := 0.0
var pitch := deg_to_rad(32.0)
var distance := 30.0
var yaw_target := 0.0
var pitch_target := deg_to_rad(32.0)
var distance_target := 30.0
var bounds = null   # {minX, maxX, minZ, maxZ}
var velocity := Vector3.ZERO
var look_offset := Vector3.ZERO
var _prev := Vector3.ZERO
var _has_prev := false
var _wheel := 0.0

## Level framing (the game's `camera` + `cameraBounds` + `highGround`)
var framing := {"distance": 30.0, "pitch": 32.0, "minDistance": 18.0, "maxDistance": 42.0}
var bounds_near := {}
var bounds_mid := {}
var bounds_far := {}
var high_ground = null
var level_width := 48.0
var photo_mode := false


func configure(cam_info: Dictionary, level_w: float) -> void:
	level_width = level_w
	var f = cam_info.get("framing")
	if f is Dictionary:
		framing = f
	min_distance = float(framing.get("minDistance", 18.0))
	max_distance = float(framing.get("maxDistance", 42.0))
	distance = float(framing.get("distance", 30.0))
	distance_target = distance
	pitch = deg_to_rad(float(framing.get("pitch", 32.0)))
	pitch_target = pitch
	yaw = 0.0
	yaw_target = 0.0
	yaw_center = 0.0
	if cam_info.get("lookAhead") != null:
		look_ahead = float(cam_info.lookAhead)
	var cb = cam_info.get("cameraBounds")
	if cb is Dictionary and cb.has("mid"):
		bounds_near = cb.near
		bounds_mid = cb.mid
		bounds_far = cb.far
		bounds = bounds_mid.duplicate()
	high_ground = cam_info.get("highGround")
	if camera:
		camera.fov = float(cam_info.get("fov", 28.0))


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			_wheel -= 1.0
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_wheel += 1.0


func rotate_by(delta: float) -> void:
	yaw_target += delta
	_clamp_yaw()


func zoom(delta: float) -> void:
	distance_target = clampf(distance_target + delta, min_distance, max_distance)


func snap() -> void:
	yaw = yaw_target
	pitch = pitch_target
	distance = distance_target
	look_offset = Vector3.ZERO
	velocity = Vector3.ZERO
	if target:
		var tp := target.global_position
		_prev = tp
		_has_prev = true
		focus = Vector3(tp.x, tp.y + target_offset_y, tp.z)
	_clamp_bounds_v(focus)
	_apply()


func _clamp_yaw() -> void:
	yaw_target = clampf(yaw_target, yaw_center - yaw_limit, yaw_center + yaw_limit)


func _clamp_bounds_v(v: Vector3) -> Vector3:
	if bounds is Dictionary and bounds.has("minX"):
		v.x = clampf(v.x, bounds.minX, bounds.maxX)
		v.z = clampf(v.z, bounds.minZ, bounds.maxZ)
	return v


## Game._updatePlayCamera: high-ground tilt, edge-aware yaw, zoom-dependent bounds.
func _play_camera_extras() -> void:
	if target == null or photo_mode:
		return
	var p := target.global_position
	var hg = high_ground
	var pitch_deg := float(framing.get("pitch", 32.0))
	if hg is Dictionary and p.y > float(hg.minY):
		pitch_deg = float(hg.pitch)
	pitch_target = deg_to_rad(pitch_deg)
	var W := level_width
	var e0 := minf(9.0, W / 5.0)
	var e1 := e0 * (5.0 / 9.0)
	var east := Lum.smoothstep01(W - e0, W - e1, p.x)
	var west := Lum.smoothstep01(e0, e1, p.x)
	if east > 0.0 or west > 0.0:
		yaw_target = clampf(yaw_target, -deg_to_rad(60.0 - 50.0 * west), deg_to_rad(60.0 - 50.0 * east))
	_update_bounds()


func _update_bounds() -> void:
	if bounds_mid.is_empty():
		return
	var C := framing
	var d := distance
	var a: Dictionary
	var c: Dictionary
	var t: float
	if d <= float(C.distance):
		a = bounds_near; c = bounds_mid
		t = clampf((d - float(C.minDistance)) / maxf(1e-6, float(C.distance) - float(C.minDistance)), 0.0, 1.0)
	else:
		a = bounds_mid; c = bounds_far
		t = clampf((d - float(C.distance)) / maxf(1e-6, float(C.maxDistance) - float(C.distance)), 0.0, 1.0)
	bounds = {"minX": lerpf(a.minX, c.minX, t), "maxX": lerpf(a.maxX, c.maxX, t),
		"minZ": lerpf(a.minZ, c.minZ, t), "maxZ": lerpf(a.maxZ, c.maxZ, t)}


func update(dt: float) -> void:
	dt = maxf(dt, 0.0)
	if input_enabled:
		var rot := 0.0
		if Input.is_action_pressed("cam_left"): rot -= 1.0
		if Input.is_action_pressed("cam_right"): rot += 1.0
		rot += Input.get_joy_axis(0, JOY_AXIS_RIGHT_X) if absf(Input.get_joy_axis(0, JOY_AXIS_RIGHT_X)) > 0.2 else 0.0
		if rot != 0.0:
			rotate_by(clampf(rot, -1.0, 1.0) * rotate_speed * dt)
		var z := 0.0
		if Input.is_action_pressed("zoom_in"): z -= 1.0
		if Input.is_action_pressed("zoom_out"): z += 1.0
		if z != 0.0:
			zoom(z * zoom_key_speed * dt)
		if _wheel != 0.0:
			zoom(_wheel * wheel_zoom_scale)
	_wheel = 0.0
	_play_camera_extras()
	if target:
		var tp := target.global_position
		if not _has_prev:
			_prev = tp
			_has_prev = true
		var jump := Vector2(tp.x - _prev.x, tp.z - _prev.z).length()
		if jump > auto_snap_distance:
			_prev = tp
			snap()
			return
		if dt > 0.0:
			var raw := Vector3((tp.x - _prev.x) / dt, 0.0, (tp.z - _prev.z) / dt)
			velocity = velocity.lerp(raw, Lum.damp(velocity_lambda, dt))
		_prev = tp
		var speed := Vector2(velocity.x, velocity.z).length()
		var lx := 0.0
		var lz := 0.0
		if speed > 0.05 and look_ahead > 0.0:
			var k := look_ahead * minf(1.0, speed / look_ahead_speed) / speed
			lx = velocity.x * k
			lz = velocity.z * k
		var la := Lum.damp(look_ahead_lambda, dt)
		look_offset.x += (lx - look_offset.x) * la
		look_offset.z += (lz - look_offset.z) * la
		var desired := _clamp_bounds_v(Vector3(tp.x + look_offset.x, tp.y + target_offset_y, tp.z + look_offset.z))
		var kf := Lum.damp(follow_lambda, dt)
		var ky := Lum.damp(follow_lambda_y, dt)
		focus.x += (desired.x - focus.x) * kf
		focus.y += (desired.y - focus.y) * ky
		focus.z += (desired.z - focus.z) * kf
	focus = _clamp_bounds_v(focus)
	_clamp_yaw()
	pitch_target = clampf(pitch_target, min_pitch, max_pitch)
	distance_target = clampf(distance_target, min_distance, max_distance)
	yaw += (yaw_target - yaw) * Lum.damp(rotate_lambda, dt)
	pitch += (pitch_target - pitch) * Lum.damp(pitch_lambda, dt)
	distance += (distance_target - distance) * Lum.damp(zoom_lambda, dt)
	_apply()


func _apply() -> void:
	if camera == null:
		return
	var cp := cos(pitch)
	var sp := sin(pitch)
	var sy := sin(yaw)
	var cy := cos(yaw)
	camera.global_position = focus + Vector3(sy * cp, sp, cy * cp) * distance
	camera.look_at(focus, Vector3.UP)
	RenderingServer.global_shader_parameter_set("lum_camera_yaw", yaw)


## Camera-relative movement: screen-space (x right, y up) → world XZ direction.
func to_world_direction(x: float, y: float) -> Vector3:
	var s := sin(yaw)
	var c := cos(yaw)
	return Vector3(c * x - s * y, 0.0, -s * x - c * y)


## Distance from the camera to the focus point (DOF focus).
func focus_distance() -> float:
	return camera.global_position.distance_to(focus) if camera else distance
