extends Node3D
## Measures Godot's LIGHT_COLOR scale in a custom light(): a white plane lit head-on by a
## directional light of energy 1, unshaded otherwise; prints the rendered value of DIFFUSE_LIGHT
## when light() writes LIGHT_COLOR × ATTENUATION × N·L (expected π if Godot premultiplies π).
func _ready() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0, 0, 0)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0, 0, 0)
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	var cam := Camera3D.new(); cam.position = Vector3(0, 0, 3); add_child(cam)
	var l: Light3D
	if OS.get_environment("LUM_CAL_LIGHT") == "omni":
		var o := OmniLight3D.new(); o.position = Vector3(0, 0, float(OS.get_environment("LUM_CAL_D") if OS.get_environment("LUM_CAL_D") != "" else "1")); o.omni_range = 5.0; o.omni_attenuation = 2.0; o.light_energy = 0.1; l = o
	else:
		l = DirectionalLight3D.new(); l.light_energy = 0.1  # shines along -Z (toward the plane)
	add_child(l)
	if OS.get_environment("LUM_CAL_BOTH") == "1":
		var d := DirectionalLight3D.new(); d.light_energy = 0.0001; d.rotation_degrees = Vector3(-90, 0, 0); add_child(d)
	var mi := MeshInstance3D.new(); var q := QuadMesh.new(); q.size = Vector2(4, 4); mi.mesh = q
	var sh := Shader.new()
	var mode := OS.get_environment("LUM_CAL")
	if mode == "emission":
		sh.code = "shader_type spatial;\nrender_mode ambient_light_disabled, specular_disabled;\nvoid fragment(){ ALBEDO = vec3(0.0); EMISSION = vec3(2.0); }\nvoid light(){ }\n"
	elif mode == "fog":
		sh.code = "shader_type spatial;\nrender_mode ambient_light_disabled, specular_disabled;\nvoid fragment(){ ALBEDO = vec3(0.0); EMISSION = vec3(0.0); FOG = vec4(0.1, 0.1, 0.1, 1.0); }\nvoid light(){ }\n"
	else:
		sh.code = "shader_type spatial;\nrender_mode ambient_light_disabled, specular_disabled;\nvoid fragment(){ ALBEDO = vec3(1.0); }\nvoid light(){ DIFFUSE_LIGHT += LIGHT_COLOR * ATTENUATION * max(dot(NORMAL, LIGHT), 0.0); }\n"
	var m := ShaderMaterial.new(); m.shader = sh; mi.material_override = m; add_child(mi)
	if OS.get_environment("LUM_CAL_LATE") == "1":
		var e := l.light_energy
		l.light_energy = 0.0
		l.light_specular = 0.0
		await get_tree().process_frame
		await get_tree().process_frame
		l.light_energy = e
	await get_tree().create_timer(0.3).timeout
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	var c := img.get_pixel(img.get_width() / 2, img.get_height() / 2)
	print("CALIBRATION srgb=", c, " linear=", c.srgb_to_linear(), " (energy 0.1 → LIGHT_COLOR factor = linear / 0.1)")
	get_tree().quit()
