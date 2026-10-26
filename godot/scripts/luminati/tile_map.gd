class_name LumTileMap
extends RefCounted
## The walkable ground of a level — a port of src/engine/world/TileMap.js' queries: ground height
## (tiles, stairs ramps, bridge-deck walk surfaces), walkability, colliders (circles and boxes) and
## `move()` with sliding, the 0.55 maximum step and the push-out from colliders. The tile grid is
## the engine's own, as the bake read it after the world was built (houses block their tiles).

const STEP_H := 0.125            # LEVEL_HEIGHT / STAIR_STEPS (4 steps per stairs tile)
const PERIM := 8                 # samples round a character's circle
const F_EXISTS := 1
const F_WALKABLE := 2
const F_WATER := 4
const F_BLOCKED := 8
const F_STAIRS_N := 16
const F_STAIRS_S := 32
const F_STAIRS_E := 64
const F_STAIRS_W := 128

var width := 0
var depth := 0
var base_y := 0.0
var flags := PackedByteArray()
var heights := PackedFloat32Array()
var water := PackedFloat32Array()
var walk_surfaces: Array = []    # [{minX, maxX, minZ, maxZ, y}]
var colliders: Array = []        # [{type: 'circle'|'box', ...}]
var _loose := 0
var _pcos := PackedFloat32Array()
var _psin := PackedFloat32Array()
## Spatial grid of the static colliders (cell → collider indices)
var _grid := {}
const CELL := 4.0


func _init(world: LumBakedWorld) -> void:
	var tm: Dictionary = world.manifest.gameplay.tileMap
	width = int(tm.width)
	depth = int(tm.depth)
	base_y = float(tm.baseY)
	flags = world.u8(tm.flags)
	heights = world.f32(tm.heights)
	water = world.f32(tm.water)
	for r in world.manifest.gameplay.get("walkSurfaces", []):
		walk_surfaces.append(r)
	for c in world.manifest.gameplay.get("colliders", []):
		colliders.append(c)
	for k in range(PERIM):
		var a := TAU * k / PERIM
		_pcos.append(cos(a))
		_psin.append(sin(a))
	_rebuild_grid()


func _rebuild_grid() -> void:
	_grid.clear()
	for k in range(colliders.size()):
		var c: Dictionary = colliders[k]
		if c.get("dynamic", false):
			continue
		var x0: float; var x1: float; var z0: float; var z1: float
		if c.type == "circle":
			x0 = c.x - c.r; x1 = c.x + c.r; z0 = c.z - c.r; z1 = c.z + c.r
		else:
			x0 = c.minX; x1 = c.maxX; z0 = c.minZ; z1 = c.maxZ
		for j in range(floori(z0 / CELL), floori(z1 / CELL) + 1):
			for i in range(floori(x0 / CELL), floori(x1 / CELL) + 1):
				var key := Vector2i(i, j)
				if not _grid.has(key):
					_grid[key] = []
				_grid[key].append(k)


## Dynamic colliders (walking villagers) are tested on every query.
var dynamic_colliders: Array = []


func add_dynamic_collider(c: Dictionary) -> Dictionary:
	dynamic_colliders.append(c)
	return c


func _near(x: float, z: float, r: float) -> Array:
	var out: Array = []
	var seen := {}
	for j in range(floori((z - r) / CELL), floori((z + r) / CELL) + 1):
		for i in range(floori((x - r) / CELL), floori((x + r) / CELL) + 1):
			var list = _grid.get(Vector2i(i, j))
			if list == null:
				continue
			for k in list:
				if not seen.has(k):
					seen[k] = true
					out.append(k)
	out.sort()
	var res: Array = []
	for k in out:
		res.append(colliders[k])
	for c in dynamic_colliders:
		if not c.get("disabled", false):
			res.append(c)
	return res


# ------------------------------------------------------------------------------------------------
# Tiles
# ------------------------------------------------------------------------------------------------

func flags_at(i: int, j: int) -> int:
	if i < 0 or j < 0 or i >= width or j >= depth:
		return 0
	return flags[j * width + i]


func tile_exists(i: int, j: int) -> bool:
	return flags_at(i, j) & F_EXISTS != 0


func tile_height(i: int, j: int) -> float:
	if not tile_exists(i, j):
		return base_y
	return heights[j * width + i]


func water_surface(x: float, z: float) -> float:
	var i := floori(x)
	var j := floori(z)
	if flags_at(i, j) & F_WATER == 0:
		return NAN
	return water[j * width + i]


func _stair_t(f: int, lx: float, lz: float) -> float:
	if f & F_STAIRS_N: return 1.0 - lz
	if f & F_STAIRS_S: return lz
	if f & F_STAIRS_E: return lx
	return 1.0 - lx


func _stair_ramp(f: int, h: float, lx: float, lz: float) -> float:
	var p := _stair_t(f, lx, lz)
	return clampf(h + STEP_H * 0.5 + p * Lum.LEVEL_HEIGHT, h, h + Lum.LEVEL_HEIGHT)


func _is_stairs(f: int) -> bool:
	return f & (F_STAIRS_N | F_STAIRS_S | F_STAIRS_E | F_STAIRS_W) != 0


func _walk_height(x: float, z: float) -> float:
	var best := NAN
	for r in walk_surfaces:
		if x >= r.minX and x <= r.maxX and z >= r.minZ and z <= r.maxZ and (is_nan(best) or r.y > best):
			best = r.y
	return best


## Ground height: walk surfaces override tiles; stairs interpolate; void / outside → base.
func get_height(x: float, z: float) -> float:
	var ws := _walk_height(x, z)
	if not is_nan(ws):
		return ws
	var i := floori(x)
	var j := floori(z)
	var f := flags_at(i, j)
	if f & F_EXISTS == 0:
		return base_y
	var h := heights[j * width + i]
	return _stair_ramp(f, h, x - i, z - j) if _is_stairs(f) else h


func _point_in_collider(x: float, z: float) -> bool:
	for c in _near(x, z, 0.0):
		if c.type == "circle":
			var dx: float = x - c.x
			var dz: float = z - c.z
			if dx * dx + dz * dz < c.r * c.r:
				return true
		elif x > c.minX and x < c.maxX and z > c.minZ and z < c.maxZ:
			return true
	return false


func is_walkable(x: float, z: float) -> bool:
	if x < 0 or z < 0 or x > width or z > depth:
		return false
	if is_nan(_walk_height(x, z)):
		var f := flags_at(floori(x), floori(z))
		if f & F_EXISTS == 0 or f & F_WALKABLE == 0:
			return false
	return not _point_in_collider(x, z)


func _stand_height(x: float, z: float, href: float, max_step: float) -> float:
	var h := _walk_height(x, z)
	if is_nan(h):
		var i := floori(x)
		var j := floori(z)
		var f := flags_at(i, j)
		if f & F_EXISTS == 0 or f & F_WALKABLE == 0:
			return NAN
		h = heights[j * width + i]
		if _is_stairs(f):
			h = _stair_ramp(f, h, x - i, z - j)
	return NAN if absf(h - href) > max_step else h


func _can_occupy(x: float, z: float, r: float, href: float, max_step: float) -> bool:
	if x - r < 0 or z - r < 0 or x + r > width or z + r > depth:
		return false
	var hc := _stand_height(x, z, href, max_step)
	if is_nan(hc):
		return false
	for k in range(PERIM):
		if is_nan(_stand_height(x + _pcos[k] * r, z + _psin[k] * r, hc, max_step)):
			return false
	return true


func _occupy(x: float, z: float, r: float, href: float, max_step: float) -> bool:
	if _loose == 0:
		return _can_occupy(x, z, r, href, max_step)
	if x - r < 0 or z - r < 0 or x + r > width or z + r > depth:
		return false
	var h := _walk_height(x, z)
	var walkable := true
	if is_nan(h):
		var i := floori(x)
		var j := floori(z)
		var f := flags_at(i, j)
		if f & F_EXISTS == 0:
			return false
		h = heights[j * width + i]
		if _is_stairs(f):
			h = _stair_ramp(f, h, x - i, z - j)
		walkable = f & F_WALKABLE != 0
	if _loose == 1:
		return walkable and absf(h - href) <= max_step
	return h - href <= max_step


## Result of _push_out (doubles: a Vector2 would round to 32-bit floats and drift from the engine)
var _px := 0.0
var _pz := 0.0


func _push_out(x: float, z: float, r: float) -> void:
	# TileMap._pushOut walks every collider in index order, testing each against the position as
	# pushed so far: the candidates of a generous neighbourhood, in index order, do the same
	var cands := _near(x, z, r + 3.0)
	for _pass in range(3):
		var moved := false
		for c in cands:
			if c.type == "circle":
				var dx: float = x - c.x
				var dz: float = z - c.z
				var mn: float = c.r + r
				var d2 := dx * dx + dz * dz
				if d2 >= mn * mn:
					continue
				var d := sqrt(d2)
				if d < 1e-6:
					dx = 0.0; dz = 1.0; d = 1.0
				x = c.x + dx / d * mn
				z = c.z + dz / d * mn
				moved = true
			else:
				var qx := clampf(x, c.minX, c.maxX)
				var qz := clampf(z, c.minZ, c.maxZ)
				var dx := x - qx
				var dz := z - qz
				var d2 := dx * dx + dz * dz
				if d2 == 0.0:
					var l: float = x - c.minX
					var rr: float = c.maxX - x
					var t: float = z - c.minZ
					var b: float = c.maxZ - z
					var m := minf(minf(l, rr), minf(t, b))
					if m == l: x = c.minX - r
					elif m == rr: x = c.maxX + r
					elif m == t: z = c.minZ - r
					else: z = c.maxZ + r
					moved = true
				elif d2 < r * r:
					var d := sqrt(d2)
					x = qx + dx / d * r
					z = qz + dz / d * r
					moved = true
		if not moved:
			break
	_px = x
	_pz = z


## Move a circle of `radius` from (x, z) by (dx, dz) with sliding (full → x only → z only).
## A circle that starts somewhere invalid moves freely until it is out (never soft-locks).
func move(from: Vector2, dx: float, dz: float, radius := 0.3, max_step := 0.55) -> Vector2:
	move_xz(from.x, from.y, dx, dz, radius, max_step)
	return Vector2(move_x, move_z)


## The result of the last `move_xz` (full precision).
var move_x := 0.0
var move_z := 0.0


## `move` on doubles: from (x, z) by (dx, dz) → move_x, move_z.
func move_xz(x: float, z: float, dx: float, dz: float, radius := 0.3, max_step := 0.55) -> void:
	move_x = x
	move_z = z
	var length := sqrt(dx * dx + dz * dz)
	if length <= 1e-9:
		return
	var n := maxi(1, ceili(length / maxf(0.04, radius * 0.5)))
	var sx := dx / n
	var sz := dz / n
	var href := get_height(x, z)
	_loose = 0
	if not _can_occupy(x, z, radius, href, max_step):
		_loose = 2 if is_nan(_stand_height(x, z, href, max_step)) else 1
	for _k in range(n):
		var nx: float
		var nz: float
		if _loose != 0 and _can_occupy(x, z, radius, href, max_step):
			_loose = 0
		if _occupy(x + sx, z + sz, radius, href, max_step):
			nx = x + sx; nz = z + sz
		elif sx != 0.0 and _occupy(x + sx, z, radius, href, max_step):
			nx = x + sx; nz = z
		elif sz != 0.0 and _occupy(x, z + sz, radius, href, max_step):
			nx = x; nz = z + sz
		else:
			break
		_push_out(nx, nz, radius)
		if _px != nx or _pz != nz:
			if _occupy(_px, _pz, radius, href, max_step):
				nx = _px; nz = _pz
			else:
				nx = x; nz = z
		if nx == x and nz == z:
			break
		x = nx
		z = nz
		href = get_height(x, z)
	move_x = x
	move_z = z


## The nearest spot a character can stand on (a spawn in the water, the game's _ensureStandingSpawn).
func nearest_standable(x: float, z: float, radius := 0.3) -> Vector2:
	if _can_occupy(x, z, radius, get_height(x, z), 0.55) and not _point_in_collider(x, z):
		return Vector2(x, z)
	for ring in range(1, 40):
		var rr := ring * 0.25
		for k in range(16):
			var a := TAU * k / 16.0
			var px := x + cos(a) * rr
			var pz := z + sin(a) * rr
			if _can_occupy(px, pz, radius, get_height(px, pz), 0.55) and not _point_in_collider(px, pz):
				return Vector2(px, pz)
	return Vector2(x, z)
