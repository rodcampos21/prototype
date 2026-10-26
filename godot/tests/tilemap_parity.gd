extends Node
## Parity test of the walking rules (scripts/luminati/tile_map.gd) against the three.js engine's
## TileMap: tests/data/<level>_tilemap.json holds 600 ground-height / walkability queries and 600
## moves recorded in the browser (static colliders only). Run:
##   godot --headless --path godot res://tests/tilemap_parity.tscn -- --level=emberfall

func _ready() -> void:
	var level := "emberfall"
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--level="):
			level = a.substr(8)
	var data = JSON.parse_string(FileAccess.get_file_as_string("res://tests/data/%s_tilemap.json" % level))
	var w := LumBakedWorld.new()
	if not w.load_level(level):
		print("PARITY %s: not baked" % level)
		get_tree().quit(2)
		return
	var tm := LumTileMap.new(w)
	var bad_h := 0
	var bad_w := 0
	var bad_m := 0
	var worst := 0.0
	for h in data.heights:
		var gh := tm.get_height(h[0], h[1])
		if absf(gh - float(h[2])) > 1e-4:
			bad_h += 1
		if tm.is_walkable(h[0], h[1]) != bool(h[3]):
			bad_w += 1
	for m in data.moves:
		tm.move_xz(m[0], m[1], m[2], m[3], 0.3, 0.55)
		var out := Vector2(tm.move_x, tm.move_z)
		var err := sqrt(pow(tm.move_x - float(m[4]), 2) + pow(tm.move_z - float(m[5]), 2))
		worst = maxf(worst, err)
		if err > 1e-3:
			bad_m += 1
			print("  move from (%.4f, %.4f) by (%.4f, %.4f): godot (%.4f, %.4f), three (%.4f, %.4f)" % [m[0], m[1], m[2], m[3], out.x, out.y, m[4], m[5]])
	print("PARITY %s: heights %d/%d wrong, walkable %d/%d wrong, moves %d/%d off (worst %.5f)" % [
		level, bad_h, data.heights.size(), bad_w, data.heights.size(), bad_m, data.moves.size(), worst])
	get_tree().quit(0 if bad_h + bad_w + bad_m == 0 else 1)
