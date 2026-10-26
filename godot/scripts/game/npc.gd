class_name LumNpc
extends RefCounted
## A villager (src/game/Npc.js): idles, wanders within a small radius of home (tile-map
## collisions), glances at the player who comes close, turns to face them when talked to and
## resumes afterwards. Behaviours: 'wander' (default), 'post' (stands at a post and looks around),
## 'perform' (the bard), 'chase' (the child running after the chickens — wanders here until the
## critters are ported).

const RADIUS := 0.3

var id := ""
var name := ""
var def: Dictionary
var obj: Dictionary          ## the level object (script, dialogue, action, item …)
var sprite: LumCharacterSprite
var tile_map: LumTileMap
var home := Vector3.ZERO
var wander := 1.2
var speed := 1.0
var behaviour := "wander"
var talk_radius := 1.6
var talk_point = null        ## Vector3 or null
var home_facing := "down"
var state := "idle"
var timer := 0.0
var target := Vector3.ZERO
var talking := false
var idle_speed := 0.55
var collider := {}
var visits := 0
var _stuck := 0.0
var _look_timer := 0.0
var rng := RandomNumberGenerator.new()
var _yaw := 0.0


func _init(p_def: Dictionary, p_obj: Dictionary, p_sprite: LumCharacterSprite, p_tile_map: LumTileMap, baked: Dictionary) -> void:
	def = p_def
	obj = p_obj
	sprite = p_sprite
	tile_map = p_tile_map
	id = str(def.get("id", ""))
	name = str(def.get("name", "Villager"))
	var h = def.get("home", [0, 0])
	home = Vector3(h[0], 0, h[1])
	wander = float(def.get("wander", 1.2))
	speed = float(def.get("speed", 1.0))
	behaviour = str(baked.get("behaviour", def.get("behaviour", "wander")))
	talk_radius = float(def.get("talkRadius", 1.6))
	var tp = def.get("talkPoint")
	if tp is Array and tp.size() >= 2:
		talk_point = Vector3(tp[0], 0, tp[1])
	home_facing = str(def.get("facing", "down"))
	rng.seed = hash(id)
	timer = rng.randf_range(0.5, 3.0)
	idle_speed = float(baked.get("idleSpeed", rng.randf_range(0.5, 0.62)))
	sprite.position = Vector3(home.x, tile_map.get_height(home.x, home.z), home.z)
	sprite.set_direction(home_facing)
	collider = tile_map.add_dynamic_collider({"type": "circle", "x": home.x, "z": home.z, "r": 0.34, "dynamic": true})
	_idle()


var position: Vector3:
	get: return sprite.position


## Where the player talks to the villager (its position, or e.g. the front of a market counter).
func interact_point() -> Vector3:
	if talk_point != null:
		return Vector3(talk_point.x, sprite.position.y, talk_point.z)
	return sprite.position


func _idle() -> void:
	sprite.play("idle", idle_speed)


func begin_talk(px: float, pz: float, cam_yaw: float) -> void:
	talking = true
	state = "talk"
	_idle()
	sprite.face_vector(px - sprite.position.x, pz - sprite.position.z, cam_yaw)


func end_talk() -> void:
	talking = false
	state = "idle"
	timer = rng.randf_range(1.2, 2.5)


func _pick_target() -> Vector3:
	collider.disabled = true
	for _k in range(6):
		var a := rng.randf_range(0.0, TAU)
		var r := rng.randf_range(0.4, wander)
		var x := home.x + cos(a) * r
		var z := home.z + sin(a) * r
		if tile_map.is_walkable(x, z):
			collider.disabled = false
			return Vector3(x, 0, z)
	collider.disabled = false
	return home


func _walk_towards(dt: float, tx: float, tz: float, spd: float, player_pos) -> bool:
	var p := sprite.position
	var dx := tx - p.x
	var dz := tz - p.z
	var dist := sqrt(dx * dx + dz * dz)
	if dist < 0.08:
		return true
	if player_pos != null:
		var pdx: float = player_pos.x - p.x
		var pdz: float = player_pos.z - p.z
		var pd := sqrt(pdx * pdx + pdz * pdz)
		if pd < 1.0 and (pdx * dx + pdz * dz) > 0.0:
			_idle()
			return false
	var step := minf(dist, spd * dt)
	collider.disabled = true
	var out := tile_map.move(Vector2(p.x, p.z), dx / dist * step, dz / dist * step, RADIUS, 0.55)
	collider.disabled = false
	var moved := Vector2(out.x - p.x, out.y - p.z).length()
	p.x = out.x
	p.z = out.y
	sprite.position = p
	sprite.face_vector(dx, dz, _yaw)
	sprite.play("run" if spd > 2.2 else "walk")
	sprite.speed = 0.8 if spd > 2.2 else maxf(0.45, spd / 2.8)
	_stuck = _stuck + dt if moved < step * 0.25 else 0.0
	return _stuck > 0.4


func update(dt: float, player_pos: Vector3, cam_yaw: float) -> void:
	_yaw = cam_yaw
	if not talking:
		match behaviour:
			"perform", "post":
				_update_post(dt, player_pos)
			_:
				_update_wander(dt, player_pos)
	var p := sprite.position
	var gy := tile_map.get_height(p.x, p.z)
	p.y += (gy - p.y) * Lum.damp(18.0, dt)
	sprite.position = p
	collider.x = p.x
	collider.z = p.z


func _update_wander(dt: float, player_pos: Vector3) -> void:
	var p := sprite.position
	if state == "idle":
		_idle()
		timer -= dt
		var d := Vector2(player_pos.x - p.x, player_pos.z - p.z).length()
		if d < 2.4:
			_look_timer -= dt
			if _look_timer <= 0.0:
				sprite.face_vector(player_pos.x - p.x, player_pos.z - p.z, _yaw)
				_look_timer = 0.4
			timer = maxf(timer, 0.8)
		if timer <= 0.0 and wander > 0.2:
			target = _pick_target()
			state = "walk"
			timer = 6.0
	elif state == "walk":
		timer -= dt
		var stuck := _walk_towards(dt, target.x, target.z, speed, player_pos)
		var arrived := Vector2(target.x - sprite.position.x, target.z - sprite.position.z).length() < 0.1
		if arrived or stuck or timer <= 0.0:
			state = "idle"
			timer = rng.randf_range(2.5, 6.5)
			_idle()


func _update_post(dt: float, player_pos: Vector3) -> void:
	var p := sprite.position
	var off := Vector2(home.x - p.x, home.z - p.z).length()
	if off > 0.15:
		_walk_towards(dt, home.x, home.z, speed, null)
		return
	_idle()
	timer -= dt
	var d := Vector2(player_pos.x - p.x, player_pos.z - p.z).length()
	if d < 2.2:
		sprite.face_vector(player_pos.x - p.x, player_pos.z - p.z, _yaw)
		timer = 1.0
	elif timer <= 0.0:
		var dirs: Array = ["down", "down", "left", "right"] if behaviour == "perform" else ["down", "left", "right", home_facing, home_facing]
		sprite.set_direction(dirs[rng.randi_range(0, dirs.size() - 1)])
		timer = rng.randf_range(2.5, 5.0)
