extends Node3D
## The Luminati game in Godot (src/game/Game.js, phase 1 of the port — docs/GODOT_PORT.md):
## plays a baked level — the diorama, the 24-hour light, the player and the villagers,
## conversations, signs and doors, the HUD, time of day (T), weather looks (R), photo mode (P) and
## switching levels (Page Up / Page Down).
##
## Command line (after `--`):  --level=<id>   start in that baked level (default: emberfall)
##                             --time=<hours> start at that hour
##                             --shot=<png>   render a few frames, save a screenshot and quit
##                             --frames=<n>   frames to wait before the screenshot (default 30)
##                             --yaw=<deg> --distance=<units>  camera for the screenshot

const TIME_PRESETS := [6.5, 12.5, 17.2, 18.9, 22.5]
const INTERACT_RANGE := 1.6
const SPAN_FACING := 0.5
const TALK_COOLDOWN := 0.25
const SPRITE_OPTS := {"normal_up": 0.6, "wrap_light": 0.6, "roundness": 0.55}
const SPRITE_FILL := {"day": 0.05, "night": 0.03}

var level_id := "emberfall"
var baked: LumBakedWorld
var world_root: Node3D
var tile_map: LumTileMap
var lighting: LumLighting
var rig: LumCameraRig
var camera: Camera3D
var sun: DirectionalLight3D
var env: Environment
var world_env: WorldEnvironment
var cam_attr: CameraAttributesPractical
var sky_mat: ShaderMaterial
var grade_mat: ShaderMaterial
var grade_rect: ColorRect
var hud: LumHUD
var dialog: LumDialogBox
var player: LumPlayer
var npcs: Array = []
var interactables: Array = []
var regions: Array = []
var lights_root: Node3D
var water_mats: Array = []

var busy := false
var photo_mode := false
var music_playing := false
var inventory := {}
var _talk_cooldown := 0.0
var _region := ""
var _banners_shown := {}
var _time_glide = null   # {from, to, t}
var _args := {}
var _frames := 0
var _sheet_textures := {}


func _ready() -> void:
	_args = _parse_args()
	if _args.has("level"):
		level_id = _args.level
	_build_scene()
	load_level(level_id)
	if _args.has("debug"):
		RenderingServer.global_shader_parameter_set("lum_debug", float(_args.debug))
	if _args.has("noshadow"):
		sun.shadow_enabled = false


func _parse_args() -> Dictionary:
	var out := {}
	for a in OS.get_cmdline_user_args() + OS.get_cmdline_args():
		if a.begins_with("--") and a.contains("="):
			var kv: PackedStringArray = a.substr(2).split("=", true, 1)
			out[kv[0]] = kv[1]
	return out


# ------------------------------------------------------------------------------------------------
# Scene: environment, sun, camera, post, UI
# ------------------------------------------------------------------------------------------------

func _build_scene() -> void:
	env = Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	sky_mat = ShaderMaterial.new()
	sky_mat.shader = preload("res://shaders/lum_sky.gdshader")
	sky.sky_material = sky_mat
	sky.process_mode = Sky.PROCESS_MODE_REALTIME
	sky.radiance_size = Sky.RADIANCE_SIZE_32
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0, 0, 0)
	env.ambient_light_energy = 0.0
	env.reflected_light_source = Environment.REFLECTION_SOURCE_DISABLED
	# tone mapping happens in lum_grade.gdshader (three's ACES); Godot's stays linear
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	env.tonemap_exposure = 1.0
	# bloom (PostFX UnrealBloomPass: strength 0.5, radius 0.58, threshold 1.05)
	env.glow_enabled = true
	env.glow_intensity = 0.5
	env.glow_strength = 1.0
	env.glow_bloom = 0.0
	env.glow_hdr_threshold = 1.05
	env.glow_hdr_scale = 2.0
	env.glow_hdr_luminance_cap = 24.0
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_ADDITIVE
	for i in range(7):
		env.set_glow_level(i, 1.0 if i >= 1 and i <= 5 else 0.0)
	# the materials write their own fog (lum_common.gdshaderinc); Godot's stays out of the way
	env.fog_enabled = false
	world_env = WorldEnvironment.new()
	world_env.environment = env
	add_child(world_env)

	sun = DirectionalLight3D.new()
	sun.name = "Sun"
	sun.shadow_enabled = true
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.directional_shadow_max_distance = 70.0
	sun.shadow_bias = 0.03
	sun.shadow_normal_bias = 1.2
	sun.shadow_blur = 1.6
	sun.light_specular = 0.0
	add_child(sun)

	camera = Camera3D.new()
	camera.name = "Camera"
	camera.fov = 28.0
	camera.near = 0.5
	camera.far = 400.0
	cam_attr = CameraAttributesPractical.new()
	cam_attr.dof_blur_far_enabled = true
	cam_attr.dof_blur_near_enabled = true
	cam_attr.dof_blur_amount = 0.06
	camera.attributes = cam_attr
	add_child(camera)

	rig = LumCameraRig.new()
	rig.name = "CameraRig"
	rig.camera = camera
	add_child(rig)

	var post := CanvasLayer.new()
	post.layer = 1
	add_child(post)
	grade_rect = ColorRect.new()
	grade_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	grade_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	grade_mat = ShaderMaterial.new()
	grade_mat.shader = preload("res://shaders/lum_grade.gdshader")
	grade_rect.material = grade_mat
	post.add_child(grade_rect)

	var ui := CanvasLayer.new()
	ui.layer = 2
	add_child(ui)
	hud = LumHUD.new()
	ui.add_child(hud)
	dialog = LumDialogBox.new()
	ui.add_child(dialog)

	lighting = LumLighting.new()
	lighting.name = "Lighting"
	add_child(lighting)
	lighting.setup(sun, env, sky_mat, grade_mat, camera)


# ------------------------------------------------------------------------------------------------
# Levels
# ------------------------------------------------------------------------------------------------

func load_level(id: String) -> void:
	_clear_level()
	level_id = id
	baked = LumBakedWorld.new()
	if not baked.load_level(id):
		hud.toast("Level \"%s\" is not baked — run tools/godot-bake/bake.mjs" % id, 8.0)
		return
	var g: Dictionary = baked.manifest.gameplay
	world_root = baked.build()
	add_child(world_root)
	tile_map = LumTileMap.new(baked)
	var lvl: Dictionary = baked.manifest.get("levelData", {})
	var envd: Dictionary = g.get("environment", {})

	lighting.configure(g.get("lighting", {}), envd)
	if _args.has("time"):
		lighting.time_of_day = float(_args.time)
	lighting.point_lights.clear()
	lighting.emissives.clear()
	lights_root = Node3D.new()
	lights_root.name = "PointLights"
	add_child(lights_root)
	var li := 0
	for d in g.get("lights", []):
		lighting.add_point_light(lights_root, d, li)
		li += 1
	for e in g.get("emissives", []):
		var mat = baked.mats.emissive_materials.get(int(e.material))
		if mat:
			lighting.register_emissive(mat, float(e.day), float(e.night))
	water_mats.clear()
	for i in range(baked.mats.entries.size()):
		if baked.mats.entries[i].get("kind") == "water":
			var wm: ShaderMaterial = baked.mats.materials[i]
			water_mats.append({"mat": wm, "brightness": float(wm.get_shader_parameter("brightness")), "glint": float(wm.get_shader_parameter("glint_amount"))})

	# camera
	var cam: Dictionary = g.get("camera", {})
	rig.configure(cam, float(baked.manifest.level.width))
	var framing: Dictionary = cam.get("framing") if cam.get("framing") is Dictionary else {}
	lighting.fog_start = float(framing.get("distance", 30.0)) - 7.0

	# characters
	var sheets: Array = baked.manifest.get("sheets", [])
	var pl = g.get("player")
	var psheet: Dictionary = sheets[int(pl.sheet)] if pl and int(pl.sheet) >= 0 else {}
	var psprite := _make_sprite(psheet, "Player")
	player = LumPlayer.new(psprite, tile_map, rig, g.get("spawn", {}))
	rig.target = psprite
	if _args.has("at"):
		var xz: PackedStringArray = str(_args.at).split(",")
		player.teleport(float(xz[0]), float(xz[1]))
	if _args.has("yaw"):
		rig.yaw_target = deg_to_rad(float(_args.yaw))
	if _args.has("distance"):
		rig.distance_target = float(_args.distance)
	rig.snap()
	var objects := {}
	for o in lvl.get("objects", []):
		objects[str(o.get("id", ""))] = o
	for n in g.get("npcs", []):
		var sh: Dictionary = sheets[int(n.sheet)] if int(n.sheet) >= 0 else {}
		var sp := _make_sprite(sh, "NPC_" + str(n.id))
		npcs.append(LumNpc.new(n.def, objects.get(str(n.id), {}), sp, tile_map, n))
	interactables = g.get("interactables", [])
	regions = g.get("regions", [])
	_region = ""
	_banners_shown.clear()
	hud.set_location(str(baked.manifest.level.name), str(baked.manifest.level.subtitle))
	hud.show_banner(str(baked.manifest.level.name), str(baked.manifest.level.subtitle))
	lighting.follow = psprite
	lighting.apply(0.0)


func _make_sprite(sheet: Dictionary, node_name: String) -> LumCharacterSprite:
	var s := LumCharacterSprite.new()
	s.name = node_name
	var path: String = str(sheet.get("path", ""))
	var tex: Texture2D = _sheet_textures.get(path)
	if tex == null and path != "":
		tex = load(path) if ResourceLoader.exists(path) else ImageTexture.create_from_image(Image.load_from_file(ProjectSettings.globalize_path(path)))
		_sheet_textures[path] = tex
	world_root.add_child(s)
	s.setup(sheet, tex, SPRITE_OPTS)
	return s


func _clear_level() -> void:
	for n in [world_root, lights_root]:
		if n and is_instance_valid(n):
			n.queue_free()
	world_root = null
	lights_root = null
	npcs.clear()
	interactables = []
	player = null


func switch_level(step: int) -> void:
	var list := Lum.baked_levels()
	if list.is_empty():
		return
	var ids: Array = list.map(func(l): return l.id)
	var i := ids.find(level_id)
	var next: String = ids[(i + step + ids.size()) % ids.size()]
	await hud.fade_to(1.0, 0.35)
	load_level(next)
	await get_tree().process_frame
	await hud.fade_to(0.0, 0.5)


# ------------------------------------------------------------------------------------------------
# Frame
# ------------------------------------------------------------------------------------------------

func _process(dt: float) -> void:
	_frames += 1
	RenderingServer.global_shader_parameter_set("lum_time", Time.get_ticks_msec() / 1000.0)
	if player == null:
		_maybe_screenshot()
		return
	var talking := busy or dialog.is_open
	if _talk_cooldown > 0.0:
		_talk_cooldown -= dt
	player.frozen = talking or photo_mode
	rig.input_enabled = not talking
	player.update(dt)
	for n in npcs:
		n.update(dt, player.position, rig.yaw)
	rig.update(dt)
	# zoom-dependent fog (Weather.zoomFog): thinner when zoomed out
	var base_d := float(rig.framing.get("distance", 30.0))
	lighting.zoom_fog = clampf(pow((base_d - 7.0) / maxf(1.0, rig.distance - 7.0), 2.0), 0.4, 1.0)
	_update_time_glide(dt)
	var sun_dir := lighting.light_dir
	player.sprite.update_sprite(dt, rig.yaw, sun_dir)
	for n in npcs:
		n.sprite.update_sprite(dt, rig.yaw, sun_dir)
	var fill := lerpf(SPRITE_FILL.day, SPRITE_FILL.night, lighting.night)
	player.sprite.material.set_shader_parameter("emissive_intensity", fill)
	for n in npcs:
		n.sprite.material.set_shader_parameter("emissive_intensity", fill)
	for w in water_mats:
		(w.mat as ShaderMaterial).set_shader_parameter("brightness", w.brightness * lerpf(1.0, 0.66, lighting.night))
		(w.mat as ShaderMaterial).set_shader_parameter("glint_amount", w.glint * lerpf(1.0, 0.55, lighting.night))
	baked.update(dt, float(lighting.weather.wind))
	_update_dof()
	hud.set_time(lighting.time_of_day, lighting.phase_name())
	_update_region()
	_update_prompt(talking)
	_maybe_screenshot()


func _update_dof() -> void:
	# focus on the player's chest (Game._playerFocusDistance); depth band like the PostFX
	var p := player.position + Vector3(0, 0.9, 0)
	var focus := maxf(1.0, -(camera.global_transform.affine_inverse() * p).z)
	cam_attr.dof_blur_far_distance = focus + 3.0
	cam_attr.dof_blur_far_transition = 9.0
	cam_attr.dof_blur_near_distance = maxf(0.5, focus - 3.0)
	cam_attr.dof_blur_near_transition = 6.0


func _update_time_glide(dt: float) -> void:
	if _time_glide == null:
		return
	_time_glide.t += dt / 2.0
	var k := Lum.smoothstep01(0.0, 1.0, minf(1.0, _time_glide.t))
	var from: float = _time_glide.from
	var to: float = _time_glide.to
	var d := fposmod(to - from, 24.0)
	lighting.time_of_day = fposmod(from + d * k, 24.0)
	if _time_glide.t >= 1.0:
		_time_glide = null


func _cycle_time() -> void:
	var now := lighting.time_of_day
	var next: float = TIME_PRESETS[0]
	for t in TIME_PRESETS:
		if t > now + 0.05:
			next = t
			break
	_time_glide = {"from": now, "to": next, "t": 0.0}


func _update_region() -> void:
	var p := player.position
	var name := ""
	var sub := ""
	for r in regions:
		if p.x >= float(r.minX) and p.x <= float(r.maxX) and p.z >= float(r.minZ) and p.z <= float(r.maxZ):
			name = str(r.get("name", ""))
			sub = str(r.get("subtitle", ""))
			break
	if name == _region:
		return
	_region = name
	if name == "":
		hud.set_location(str(baked.manifest.level.name), str(baked.manifest.level.subtitle))
	else:
		hud.set_location(name, sub)
		if not _banners_shown.has(name):
			_banners_shown[name] = true
			hud.show_banner(name, sub)


# ------------------------------------------------------------------------------------------------
# Interaction (Game._findInteractable / _interact)
# ------------------------------------------------------------------------------------------------

func _nearest_on_span(span: Dictionary, x: float, z: float) -> Vector2:
	var ax: float = span.a[0]
	var az: float = span.a[2]
	var ex: float = span.b[0] - ax
	var ez: float = span.b[2] - az
	var len2 := ex * ex + ez * ez
	var u := clampf(((x - ax) * ex + (z - az) * ez) / len2, 0.0, 1.0) if len2 > 1e-12 else 0.0
	return Vector2(ax + ex * u, az + ez * u)


func _find_target() -> Dictionary:
	var p := player.position
	var f := player.facing
	var best := INF
	var out := {}
	for n in npcs:
		var pos: Vector3 = n.interact_point()
		var d := Vector2(pos.x - p.x, pos.z - p.z).length()
		if d > n.talk_radius or absf(pos.y - p.y) > 1.3:
			continue
		var dot := ((pos.x - p.x) * f.x + (pos.z - p.z) * f.z) / d if d > 1e-3 else 1.0
		var score := d - dot * 0.7 if (d <= 0.55 or dot >= 0.25) else INF
		if score < best:
			best = score
			out = {"npc": n}
	for it in interactables:
		var pp = it.get("position")
		if pp == null:
			continue
		var pos := Vector3(pp[0], pp[1], pp[2])
		var radius := float(it.get("radius", INTERACT_RANGE))
		var d := Vector2(pos.x - p.x, pos.z - p.z).length()
		if d > radius or absf(pos.y - p.y) > 1.3:
			continue
		var dot := ((pos.x - p.x) * f.x + (pos.z - p.z) * f.z) / d if d > 1e-3 else 1.0
		var score := d - dot * 0.7 if (d <= 0.55 or dot >= 0.25) else INF
		var span = it.get("lookSpan")
		if span is Dictionary:
			var q := _nearest_on_span(span, p.x, p.z)
			var lx := q.x - p.x
			var lz := q.y - p.z
			var ld := sqrt(lx * lx + lz * lz)
			var ldot := (lx * f.x + lz * f.z) / ld if ld > 1e-3 else 1.0
			if ldot >= SPAN_FACING:
				score = minf(score, ld - ldot * 0.7)
		if score < best:
			best = score
			out = {"it": it}
	return out


func _update_prompt(talking: bool) -> void:
	if talking or photo_mode:
		hud.hide_prompt()
		return
	var t := _find_target()
	if t.is_empty():
		hud.hide_prompt()
		return
	var world_pos: Vector3
	var verb := "Talk"
	if t.has("npc"):
		world_pos = t.npc.position + Vector3(0, 2.35, 0)
	else:
		var pr = t.it.get("prompt", t.it.position)
		world_pos = Vector3(pr[0], pr[1], pr[2])
		verb = str(t.it.get("label", "Examine"))
	if camera.is_position_behind(world_pos):
		hud.hide_prompt()
		return
	hud.show_prompt(camera.unproject_position(world_pos), verb)


func _unhandled_input(event: InputEvent) -> void:
	if player == null:
		return
	if dialog.is_open or busy:
		return
	if event.is_action_pressed("interact") and not photo_mode and _talk_cooldown <= 0.0:
		var t := _find_target()
		if not t.is_empty():
			get_viewport().set_input_as_handled()
			_interact(t)
	elif event.is_action_pressed("time"):
		_cycle_time()
	elif event.is_action_pressed("weather"):
		var interior: bool = baked.manifest.gameplay.get("environment", {}).get("interior", false) == true
		if interior:
			hud.toast("Clear skies outside")
		else:
			var w := lighting.cycle_weather()
			hud.toast({"clear": "Clear skies", "rain": "Rain", "snow": "Snowfall"}.get(w, w))
	elif event.is_action_pressed("photo"):
		photo_mode = not photo_mode
		hud.visible = not photo_mode
		rig.photo_mode = photo_mode
		if photo_mode:
			hud.toast("Photo mode · P or Esc to return")
	elif event.is_action_pressed("cancel") and photo_mode:
		photo_mode = false
		hud.visible = true
		rig.photo_mode = false
	elif event.is_action_pressed("music"):
		set_music(not music_playing)
		toast("♪ Music on" if music_playing else "Music off")
	elif event.is_action_pressed("level_next"):
		switch_level(1)
	elif event.is_action_pressed("level_prev"):
		switch_level(-1)


func _interact(t: Dictionary) -> void:
	busy = true
	hud.hide_prompt()
	if t.has("npc"):
		var n: LumNpc = t.npc
		n.begin_talk(player.position.x, player.position.z, rig.yaw)
		player.face_towards(n.position.x, n.position.z)
		var ctx := LumDialogue.Context.new()
		ctx.game = self
		ctx.npc = n
		ctx.visits = n.visits
		n.visits += 1
		var speaker := n.name if n.name != "" else "Villager"
		var color := str(n.def.get("portraitColor", ""))
		ctx.say_fn = func(lines: Array) -> int:
			return await dialog.open(speaker, lines, color)
		await LumDialogue.run(ctx, n.obj)
		n.end_talk()
	else:
		var it: Dictionary = t.it
		var span = it.get("lookSpan")
		if span is Dictionary:
			var q := _nearest_on_span(span, player.position.x, player.position.z)
			player.face_towards(q.x, q.y)
		else:
			player.face_towards(float(it.position[0]), float(it.position[2]))
		var text: Dictionary = it.get("text", {}) if it.get("text") is Dictionary else {}
		var lines: Array = text.get("lines", [])
		var speaker := str(text.get("speaker", ""))
		if text.get("speakerDefault") != null:
			speaker = {"signpost": "Signpost", "waystone": "Waystone"}.get(str(text.speakerDefault), speaker)
		if text.get("linesDefault") != null:
			lines = [{"chest": "The chest is locked tight.", "waystoneText": "An old waystone hums quietly."}.get(str(text.linesDefault), "Nothing of note.")]
		if lines.is_empty():
			lines = ["Nothing of note."]
		await dialog.open(speaker, lines)
	busy = false
	_talk_cooldown = TALK_COOLDOWN


func rest_until_morning() -> void:
	await hud.fade_to(1.0, 1.0)
	lighting.time_of_day = 8.0
	_time_glide = null
	await get_tree().create_timer(0.7).timeout
	await hud.fade_to(0.0, 1.1)
	toast("You feel well rested.")


func set_music(on: bool) -> void:
	# procedural music arrives with the audio phase of the port; the state is kept
	music_playing = on


func toast(text: String) -> void:
	hud.toast(text)


# ------------------------------------------------------------------------------------------------
# Screenshots (tests, docs)
# ------------------------------------------------------------------------------------------------

func _maybe_screenshot() -> void:
	# --talk=<npc id>: stand in front of that villager and start the conversation (tests, docs)
	if _args.has("talk") and _frames == 3 and player:
		for n in npcs:
			if n.id == _args.talk:
				var ip: Vector3 = n.interact_point()
				player.teleport(ip.x, ip.z + 1.1)
				player.facing = Vector3(0, 0, -1)
				rig.snap()
				_interact({"npc": n})
	if not _args.has("shot"):
		return
	if _frames < int(_args.get("frames", "30")):
		return
	print("[Luminati] light_dir=", lighting.light_dir, " sun=", sun.light_color, " energy=", sun.light_energy, " sun_fwd=", -sun.global_transform.basis.z, " time=", lighting.time_of_day)
	var img := get_viewport().get_texture().get_image()
	img.save_png(_args.shot)
	print("[Luminati] screenshot saved: ", _args.shot)
	_args.erase("shot")
	get_tree().quit()
