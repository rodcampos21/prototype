class_name LumPlayer
extends RefCounted
## The traveler (src/game/Player.js): camera-relative movement, walk / run, 4-direction facing from
## the screen-space movement direction, ground collisions through the tile map (radius 0.3, max
## step 0.55) and smooth height following on stairs and bridge decks.

const WALK_SPEED := 3.2
const RUN_SPEED := 5.6
const RADIUS := 0.3
const IDLE_SPEED := 0.54

var sprite: LumCharacterSprite
var tile_map: LumTileMap
var rig: LumCameraRig
var facing := Vector3(0, 0, 1)
var speed := 0.0
var running := false
var frozen := false


func _init(p_sprite: LumCharacterSprite, p_tile_map: LumTileMap, p_rig: LumCameraRig, spawn: Dictionary) -> void:
	sprite = p_sprite
	tile_map = p_tile_map
	rig = p_rig
	var x := float(spawn.get("x", tile_map.width * 0.5))
	var z := float(spawn.get("z", tile_map.depth * 0.5))
	var p := tile_map.nearest_standable(x, z, RADIUS)
	sprite.position = Vector3(p.x, tile_map.get_height(p.x, p.y), p.y)
	var dirs := {"down": Vector3(0, 0, 1), "up": Vector3(0, 0, -1), "left": Vector3(-1, 0, 0), "right": Vector3(1, 0, 0)}
	var f: String = spawn.get("facing", "down")
	facing = dirs.get(f, Vector3(0, 0, 1))
	sprite.set_direction(f if dirs.has(f) else "down")


var position: Vector3:
	get: return sprite.position


func face_towards(x: float, z: float) -> void:
	var d := Vector2(x - sprite.position.x, z - sprite.position.z)
	if d.length() < 1e-4:
		return
	d = d.normalized()
	facing = Vector3(d.x, 0, d.y)
	sprite.face_vector(d.x, d.y, rig.yaw)


func teleport(x: float, z: float) -> void:
	sprite.position = Vector3(x, tile_map.get_height(x, z), z)
	speed = 0.0


func update(dt: float) -> void:
	var mx := 0.0
	var my := 0.0
	var run := false
	if not frozen:
		var v := Input.get_vector("move_left", "move_right", "move_down", "move_up")
		mx = v.x
		my = v.y
		run = Input.is_action_pressed("run")
	var mag := minf(1.0, Vector2(mx, my).length())
	var p := sprite.position
	if mag > 0.05:
		var d := rig.to_world_direction(mx, my).normalized()
		running = run
		var want := (RUN_SPEED if run else WALK_SPEED) * mag
		var out := tile_map.move(Vector2(p.x, p.z), d.x * want * dt, d.z * want * dt, RADIUS, 0.55)
		var moved := Vector2(out.x - p.x, out.y - p.z).length()
		p.x = out.x
		p.z = out.y
		speed = moved / dt if dt > 0.0 else 0.0
		facing = d
		sprite.face_vector(d.x, d.z, rig.yaw)
		sprite.play("run" if run else "walk")
		sprite.speed = clampf(0.55 + 0.45 * (speed / maxf(0.01, want)), 0.55, 1.0) * maxf(0.6, mag)
	else:
		speed = 0.0
		running = false
		sprite.play("idle")
		sprite.speed = IDLE_SPEED
		sprite.face_vector(facing.x, facing.z, rig.yaw)
	var gy := tile_map.get_height(p.x, p.z)
	var k := Lum.damp(22.0, dt) if gy > p.y else Lum.damp(16.0, dt)
	p.y += (gy - p.y) * k
	if absf(gy - p.y) < 1e-3:
		p.y = gy
	sprite.position = p
