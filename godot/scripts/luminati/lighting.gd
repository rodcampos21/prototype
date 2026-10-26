class_name LumLighting
extends Node
## The 24-hour lighting model — a port of src/engine/lighting/LightingSystem.js with the game's
## tuning (src/game/config.js KEYFRAME_OVERRIDES / SUN_PATH / MOON_PATH, src/game/Weather.js).
##
## A keyframed palette interpolated in linear colour space with a cyclic monotone cubic (PCHIP)
## drives the directional light (sun by day, moon by night, blended through twilight, elevation
## softly clamped to 10°–68°), the hemisphere fill, exp² fog (colour = the sky's horizon), the
## tone-mapping exposure, the sky dome and the global shader parameters every material reads.

const COLOR_FIELDS := ["top", "horizon", "bottom", "sun", "hemiSky", "hemiGround"]
const SCALAR_FIELDS := ["sunI", "hemiI", "fog", "exp", "night", "moon", "shadow", "glow", "clouds"]
const SUN_REFERENCE_INTENSITY := 3.5

## The engine's DEFAULT_KEYFRAMES merged with the game's KEYFRAME_OVERRIDES (used when a bake has none).
const DEFAULT_KEYFRAMES := [
	{"t": 0.0, "name": "night", "top": "#050a1f", "horizon": "#1b2a5c", "bottom": "#0a1232", "sun": "#7294ff", "sunI": 1.0, "hemiSky": "#3656c0", "hemiGround": "#1a2042", "hemiI": 1.6, "fog": 0.011, "exp": 1.36, "night": 1, "moon": 1, "shadow": 0.6, "glow": 0.4, "clouds": 0.3},
	{"t": 4.3, "name": "late night", "top": "#070c24", "horizon": "#213062", "bottom": "#0d1436", "sun": "#7a98ff", "sunI": 0.9, "hemiSky": "#3656c0", "hemiGround": "#1a2042", "hemiI": 1.55, "fog": 0.0115, "exp": 1.36, "night": 1, "moon": 1, "shadow": 0.58, "glow": 0.5, "clouds": 0.34},
	{"t": 5.25, "name": "pre-dawn", "top": "#18204e", "horizon": "#5c5a92", "bottom": "#282852", "sun": "#a0a6ea", "sunI": 0.16, "hemiSky": "#5460a8", "hemiGround": "#221e38", "hemiI": 1.05, "fog": 0.014, "exp": 1.26, "night": 0.86, "moon": 1, "shadow": 0.35, "glow": 0.8, "clouds": 0.45},
	{"t": 6.1, "name": "pink dawn", "top": "#3c5098", "horizon": "#f59aa0", "bottom": "#8a6aa0", "sun": "#ff7c6a", "sunI": 2.3, "hemiSky": "#9a86d2", "hemiGround": "#6a4450", "hemiI": 0.98, "fog": 0.012, "exp": 1.08, "night": 0.3, "moon": 0, "shadow": 0.85, "glow": 1.0, "clouds": 0.45},
	{"t": 6.9, "name": "sunrise", "top": "#4a74c4", "horizon": "#f8c0a0", "bottom": "#a08aa8", "sun": "#ffb88a", "sunI": 2.8, "hemiSky": "#98aee0", "hemiGround": "#6e5048", "hemiI": 1.05, "fog": 0.013, "exp": 1.06, "night": 0.06, "moon": 0, "shadow": 0.95, "glow": 1.0, "clouds": 0.44},
	{"t": 8.0, "name": "morning", "top": "#4f86d6", "horizon": "#d6e6f0", "bottom": "#9cb6cc", "sun": "#ffe6c0", "sunI": 3.2, "hemiSky": "#a2c2ec", "hemiGround": "#6e5c46", "hemiI": 1.05, "fog": 0.011, "exp": 1.02, "night": 0, "moon": 0, "shadow": 1, "glow": 0.8, "clouds": 0.42},
	{"t": 12.2, "name": "noon", "top": "#3a7ee0", "horizon": "#c4e0f2", "bottom": "#8fb4d0", "sun": "#fff4e2", "sunI": 3.5, "hemiSky": "#a6c8f2", "hemiGround": "#72624a", "hemiI": 1.1, "fog": 0.009, "exp": 1.0, "night": 0, "moon": 0, "shadow": 1, "glow": 0.7, "clouds": 0.38},
	{"t": 15.3, "name": "afternoon", "top": "#4880d8", "horizon": "#dde2da", "bottom": "#9eb0c0", "sun": "#ffe0b0", "sunI": 3.6, "hemiSky": "#9cb8e8", "hemiGround": "#786248", "hemiI": 1.1, "fog": 0.0095, "exp": 1.0, "night": 0, "moon": 0, "shadow": 1, "glow": 0.8, "clouds": 0.42},
	{"t": 17.2, "name": "golden hour", "top": "#3e4c9a", "horizon": "#f7a068", "bottom": "#a0628a", "sun": "#ffb466", "sunI": 6.0, "hemiSky": "#6a80d4", "hemiGround": "#7a6058", "hemiI": 1.45, "fog": 0.0098, "exp": 1.12, "night": 0, "moon": 0, "shadow": 1, "glow": 1.0, "clouds": 0.48},
	{"t": 18.45, "name": "sunset", "top": "#2a2a70", "horizon": "#ec7e6c", "bottom": "#643a70", "sun": "#ff8050", "sunI": 3.1, "hemiSky": "#6c5ec4", "hemiGround": "#4c2e44", "hemiI": 1.45, "fog": 0.0112, "exp": 1.2, "night": 0.22, "moon": 0, "shadow": 0.85, "glow": 1.3, "clouds": 0.5},
	{"t": 19.25, "name": "purple dusk", "top": "#1a1c54", "horizon": "#8a5a9e", "bottom": "#2c2052", "sun": "#c07aaa", "sunI": 0.85, "hemiSky": "#4c4ea8", "hemiGround": "#2a1c36", "hemiI": 1.62, "fog": 0.013, "exp": 1.46, "night": 0.62, "moon": 0, "shadow": 0.5, "glow": 0.9, "clouds": 0.46},
	{"t": 20.05, "name": "blue hour", "top": "#0b1240", "horizon": "#2c3e82", "bottom": "#111a40", "sun": "#7090f4", "sunI": 0.38, "hemiSky": "#304cae", "hemiGround": "#12152e", "hemiI": 1.5, "fog": 0.0125, "exp": 1.36, "night": 0.92, "moon": 1, "shadow": 0.5, "glow": 0.5, "clouds": 0.42},
	{"t": 21.4, "name": "night", "top": "#060b20", "horizon": "#1c2b5c", "bottom": "#0b1332", "sun": "#7294ff", "sunI": 1.0, "hemiSky": "#3656c0", "hemiGround": "#1a2042", "hemiI": 1.6, "fog": 0.011, "exp": 1.36, "night": 1, "moon": 1, "shadow": 0.6, "glow": 0.4, "clouds": 0.3},
]

## Weather looks (src/game/WeatherLook.js WEATHER_PARAMS).
const WEATHER := {
	"clear": {"sun": 1.0, "ambient": 1.0, "fog": 1.0, "exposure": 1.0, "wind": 1.0, "windX": 1.0, "windZ": 0.35, "temp": 0.0, "sat": 0.0, "rays": 1.0, "overcast": 0.0},
	"rain": {"sun": 0.26, "ambient": 0.9, "fog": 2.1, "exposure": 0.92, "wind": 2.3, "windX": 2.2, "windZ": 0.9, "temp": -0.12, "sat": -0.24, "rays": 0.0, "overcast": 0.72},
	"snow": {"sun": 0.45, "ambient": 1.15, "fog": 1.9, "exposure": 1.04, "wind": 1.3, "windX": 1.2, "windZ": 0.5, "temp": -0.3, "sat": -0.42, "rays": 0.25, "overcast": 0.62},
}
const OVERCAST_TINT := Color(0.9, 0.97, 1.12)

var time_of_day := 17.2
var time_speed := 0.0
var paused := false
var clock := 0.0
var min_elevation := deg_to_rad(10.0)
var max_elevation := deg_to_rad(68.0)
var sun_path := {"noon": 12.6, "lat": 32.0, "dec": 14.0, "refTime": 17.2, "refAzimuth": -112.0}
var moon_path := {"noon": 23.6, "lat": 45.0, "dec": 2.0, "refTime": 0.0, "refAzimuth": 40.0}
var keyframes: Array = []
## Multipliers (weather, tuning): sun, ambient, fog, exposure, point lights.
var settings := {"sunMul": 1.0, "ambientMul": 1.0, "fogMul": 2.0, "exposureMul": 1.0, "pointLightMul": 1.0}
## The game's fog tuning (Weather.tuning.fogMul) × zoom × level fogScale is applied in `settings.fogMul`.
var fog_tuning := 2.0
var zoom_fog := 1.0
var level_fog := 1.0
var fog_start := 23.0
var backdrop = null  # Color or null

## Current state (read by the game: night factor, sky colours …)
var state := {}
var night := 0.0
var light_dir := Vector3.UP
var sun_dir := Vector3.UP
var moon_dir := Vector3.UP

var weather_name := "clear"
var weather := WEATHER.clear.duplicate()
var _weather_target := "clear"

var sun: DirectionalLight3D
var environment: Environment
var sky_material: ShaderMaterial
var grade: ShaderMaterial
var camera: Camera3D
var follow: Node3D

var point_lights: Array = []   # {light: OmniLight3D, intensity, flicker, nightOnly, dayIntensity, seed, flickerSpeed}
var emissives: Array = []      # {material: ShaderMaterial, day, night, baseDay}

var _times := PackedFloat64Array()
var _vals: Array = []          # per key: PackedFloat64Array(CHANNELS)
var _slopes: Array = []
var _channels := COLOR_FIELDS.size() * 3 + SCALAR_FIELDS.size()
var _sun_yaw := 0.0
## The Compatibility renderer (no HDR 2D canvas): Godot tone-maps, lum_grade only grades.
var compat := false
var _moon_yaw := 0.0


func setup(p_sun: DirectionalLight3D, p_env: Environment, p_sky: ShaderMaterial, p_grade: ShaderMaterial, p_camera: Camera3D) -> void:
	sun = p_sun
	environment = p_env
	sky_material = p_sky
	grade = p_grade
	camera = p_camera
	compat = RenderingServer.get_current_rendering_method() == "gl_compatibility"
	if compat and environment:
		environment.tonemap_mode = Environment.TONE_MAPPER_ACES
		environment.tonemap_white = 16.0
	if grade:
		grade.set_shader_parameter("input_display", compat)
	if keyframes.is_empty():
		set_keyframes(DEFAULT_KEYFRAMES)


## Read the lighting the bake captured (the game's merged keyframes and sun / moon paths).
func configure(baked: Dictionary, env: Dictionary) -> void:
	if baked.has("keyframes") and baked.keyframes is Array and baked.keyframes.size() > 2:
		set_keyframes(baked.keyframes)
	else:
		set_keyframes(DEFAULT_KEYFRAMES)
	if baked.get("sunPath") is Dictionary:
		sun_path = baked.sunPath
	if baked.get("moonPath") is Dictionary:
		moon_path = baked.moonPath
	if baked.has("minElevation"):
		min_elevation = float(baked.minElevation)
	if baked.has("maxElevation"):
		max_elevation = float(baked.maxElevation)
	_sun_yaw = _solve_yaw(sun_path, float(sun_path.refTime), float(sun_path.refAzimuth))
	_moon_yaw = _solve_yaw(moon_path, float(moon_path.refTime), float(moon_path.refAzimuth))
	var t = env.get("timeOfDay", 17.2)
	time_of_day = fposmod(float(t) if (t is float or t is int) else 17.2, 24.0)
	time_speed = 0.0 if env.get("clock", true) == false else 1.0 / 90.0
	var fs = env.get("fogScale", 1.0)
	level_fog = float(fs) if ((fs is float or fs is int) and fs > 0) else 1.0
	backdrop = null
	var b = env.get("backdrop")
	if b is String:
		if b == "void":
			backdrop = Color(0, 0, 0)
		elif b.begins_with("#") and b.length() == 7:
			backdrop = Lum.srgb_hex(b)
	var w = env.get("weather", "clear")
	if env.get("interior", false) == true:
		w = "clear"
	set_weather(w if WEATHER.has(w) else "clear", true)
	apply(0.0)


func set_keyframes(list: Array) -> void:
	keyframes = list.duplicate(true)
	keyframes.sort_custom(func(a, b): return float(a.t) < float(b.t))
	_times = PackedFloat64Array()
	_vals = []
	for k in keyframes:
		_times.append(fposmod(float(k.t), 24.0))
		var v := PackedFloat64Array()
		v.resize(_channels)
		var fb := _nearest_default(float(k.t))
		for i in range(COLOR_FIELDS.size()):
			var f: String = COLOR_FIELDS[i]
			var c := _to_linear(k.get(f, fb.get(f)))
			v[i * 3] = c.r; v[i * 3 + 1] = c.g; v[i * 3 + 2] = c.b
		for i in range(SCALAR_FIELDS.size()):
			var f: String = SCALAR_FIELDS[i]
			v[COLOR_FIELDS.size() * 3 + i] = float(k.get(f, fb.get(f, 0.0)))
		_vals.append(v)
	_compute_slopes()


func _to_linear(c) -> Color:
	if c is String:
		return Color.html(c).srgb_to_linear()
	if c is float or c is int:
		return Color.hex((int(c) << 8) | 0xff).srgb_to_linear()
	return Color(1, 1, 1)


func _nearest_default(t: float) -> Dictionary:
	var best: Dictionary = DEFAULT_KEYFRAMES[0]
	for d in DEFAULT_KEYFRAMES:
		if absf(float(d.t) - t) < absf(float(best.t) - t):
			best = d
	return best


## Cyclic monotone cubic (Fritsch–Butland weighted harmonic mean), as CyclicPchip.
func _compute_slopes() -> void:
	var n := _times.size()
	var h := PackedFloat64Array(); h.resize(n)
	for k in range(n):
		var t1 := _times[(k + 1) % n] + (24.0 if k == n - 1 else 0.0)
		h[k] = t1 - _times[k]
	_slopes = []
	for k in range(n):
		var m := PackedFloat64Array(); m.resize(_channels)
		_slopes.append(m)
	for c in range(_channels):
		var d := PackedFloat64Array(); d.resize(n)
		for k in range(n):
			d[k] = (_vals[(k + 1) % n][c] - _vals[k][c]) / h[k]
		for k in range(n):
			var kp := (k - 1 + n) % n
			var d0 := d[kp]
			var d1 := d[k]
			var mm := 0.0
			if d0 * d1 > 0.0:
				var h0 := h[kp]
				var h1 := h[k]
				var w1 := 2.0 * h1 + h0
				var w2 := h1 + 2.0 * h0
				mm = (w1 + w2) / (w1 / d0 + w2 / d1)
			_slopes[k][c] = mm


func _evaluate(time: float) -> PackedFloat64Array:
	var n := _times.size()
	var x := fposmod(time - _times[0], 24.0) + _times[0]
	var k := 0
	while k < n - 1 and x >= _times[k + 1]:
		k += 1
	var t0 := _times[k]
	var t1 := _times[k + 1] if k < n - 1 else _times[0] + 24.0
	var hk := t1 - t0
	var s := (x - t0) / hk
	var s2 := s * s
	var s3 := s2 * s
	var h00 := 2.0 * s3 - 3.0 * s2 + 1.0
	var h10 := (s3 - 2.0 * s2 + s) * hk
	var h01 := -2.0 * s3 + 3.0 * s2
	var h11 := (s3 - s2) * hk
	var a: PackedFloat64Array = _vals[k]
	var b: PackedFloat64Array = _vals[(k + 1) % n]
	var ma: PackedFloat64Array = _slopes[k]
	var mb: PackedFloat64Array = _slopes[(k + 1) % n]
	var out := PackedFloat64Array(); out.resize(_channels)
	for c in range(_channels):
		out[c] = h00 * a[c] + h10 * ma[c] + h01 * b[c] + h11 * mb[c]
	return out


# ------------------------------------------------------------------------------------------------
# Sun & moon
# ------------------------------------------------------------------------------------------------

static func _celestial(hours: float, path: Dictionary, yaw: float) -> Vector3:
	var H := (hours - float(path.noon)) / 24.0 * TAU
	var lat := deg_to_rad(float(path.lat))
	var dec := deg_to_rad(float(path.dec))
	var cd := cos(dec); var sd := sin(dec)
	var ch := cos(H); var sh := sin(H)
	var sl := sin(lat); var cl := cos(lat)
	var x := -cd * sh
	var y := sd * sl + cd * ch * cl
	var z := -sd * cl + cd * ch * sl
	var cy := cos(yaw); var sy := sin(yaw)
	return Vector3(x * cy + z * sy, y, -x * sy + z * cy).normalized()


static func _solve_yaw(path: Dictionary, hours: float, azimuth_deg: float) -> float:
	var v := _celestial(hours, path, 0.0)
	return deg_to_rad(azimuth_deg) - atan2(v.x, v.z)


static func _smax(a: float, b: float, k: float) -> float:
	return 0.5 * (a + b + sqrt((a - b) * (a - b) + k * k))


static func _smin(a: float, b: float, k: float) -> float:
	return 0.5 * (a + b - sqrt((a - b) * (a - b) + k * k))


func _compute_directions(moon_blend: float) -> void:
	sun_dir = _celestial(time_of_day, sun_path, _sun_yaw)
	moon_dir = _celestial(time_of_day, moon_path, _moon_yaw)
	var sun_el := asin(clampf(sun_dir.y, -1.0, 1.0))
	var moon_el := asin(clampf(moon_dir.y, -1.0, 1.0))
	state["sunElevation"] = sun_el
	var k := 0.12
	var sun_el_c := _smin(_smax(sun_el, min_elevation, k), max_elevation, k)
	var moon_el_c := _smin(_smax(moon_el, min_elevation, k), max_elevation, k)
	var sun_az := atan2(sun_dir.x, sun_dir.z)
	var moon_az := atan2(moon_dir.x, moon_dir.z)
	var az := sun_az + wrapf(moon_az - sun_az, -PI, PI) * moon_blend
	var el := lerpf(sun_el_c, moon_el_c, moon_blend)
	var ce := cos(el)
	light_dir = Vector3(sin(az) * ce, sin(el), cos(az) * ce)


# ------------------------------------------------------------------------------------------------
# Weather (src/game/Weather.js: glides between looks)
# ------------------------------------------------------------------------------------------------

func set_weather(name: String, instant := false) -> void:
	_weather_target = name if WEATHER.has(name) else "clear"
	weather_name = _weather_target
	if instant:
		weather = WEATHER[_weather_target].duplicate()


func cycle_weather() -> String:
	var order := ["clear", "rain", "snow"]
	set_weather(order[(order.find(_weather_target) + 1) % order.size()])
	return _weather_target


func _blend_weather(dt: float) -> void:
	var target: Dictionary = WEATHER[_weather_target]
	var k := Lum.damp(0.6, dt)
	for key in target:
		weather[key] = lerpf(float(weather[key]), float(target[key]), k)


# ------------------------------------------------------------------------------------------------
# Lights
# ------------------------------------------------------------------------------------------------

func add_point_light(parent: Node3D, d: Dictionary, index: int) -> void:
	var l := OmniLight3D.new()
	l.name = "PointLight%d" % index
	var p = d.get("position", [0, 0, 0])
	l.position = Vector3(p[0], p[1], p[2])
	l.light_color = Lum.lin(d.get("color"), Color(1, 0.7, 0.42)).linear_to_srgb()
	l.omni_range = float(d.get("distance", 8.0))
	l.omni_attenuation = float(d.get("decay", 2.0))
	l.shadow_enabled = false
	l.light_energy = 0.0
	l.light_specular = 0.0
	parent.add_child(l)
	var seed = d.get("seed")
	point_lights.append({"light": l, "intensity": float(d.get("intensity", 8.0)), "flicker": float(d.get("flicker", 0.3)),
		"nightOnly": d.get("nightOnly", true), "dayIntensity": float(d.dayIntensity) if d.get("dayIntensity") != null else 0.05,
		"seed": int(seed) if seed != null else (index * 7919 + 13), "flickerSpeed": float(d.get("flickerSpeed", 2.6))})


func register_emissive(mat: ShaderMaterial, day: float, night_v: float) -> void:
	emissives.append({"material": mat, "day": day, "night": night_v, "baseDay": day})


static func _imul(a: int, b: int) -> int:
	a &= 0xFFFFFFFF
	b &= 0xFFFFFFFF
	var lo := (a * (b & 0xFFFF)) & 0xFFFFFFFF
	var hi := ((a * (b >> 16)) & 0xFFFF) << 16
	return (lo + hi) & 0xFFFFFFFF


## src/engine/utils/math.js hash2 → [0, 1)
static func hash2(x: int, y: int, seed: int) -> float:
	var h := _imul(x ^ 0x27d4eb2d, 0x165667b1) ^ _imul(y ^ 0x9e3779b9, 0x85ebca6b) ^ _imul(seed, 0xc2b2ae35)
	h &= 0xFFFFFFFF
	h = _imul(h ^ (h >> 15), 0x2c1b3c6d)
	h = _imul(h ^ (h >> 12), 0x297a2d39)
	h ^= h >> 15
	return float(h & 0xFFFFFFFF) / 4294967296.0


static func _noise1(x: float, seed: int) -> float:
	var i := floori(x)
	var f := x - i
	var u := f * f * (3.0 - 2.0 * f)
	return lerpf(hash2(i, 0, seed), hash2(i + 1, 0, seed), u)


static func flicker_noise(t: float, seed: int) -> float:
	return _noise1(t, seed) * 0.55 + _noise1(t * 2.37 + 11.3, seed + 17) * 0.3 + _noise1(t * 5.13 + 3.1, seed + 41) * 0.15


# ------------------------------------------------------------------------------------------------
# Per frame
# ------------------------------------------------------------------------------------------------

func _process(dt: float) -> void:
	if not paused and time_speed != 0.0:
		time_of_day = fposmod(time_of_day + time_speed * dt, 24.0)
	_blend_weather(dt)
	apply(dt)


func apply(dt: float) -> void:
	if _times.is_empty() or sun == null:
		return
	clock += dt
	var v := _evaluate(time_of_day)
	var cols: Array = []
	for i in range(6):
		cols.append(Color(maxf(0.0, v[i * 3]), maxf(0.0, v[i * 3 + 1]), maxf(0.0, v[i * 3 + 2])))
	var base := COLOR_FIELDS.size() * 3
	var sun_i := maxf(0.0, v[base + 0])
	var hemi_i := maxf(0.0, v[base + 1])
	var fog_d := maxf(0.0, v[base + 2])
	var exposure := maxf(0.05, v[base + 3])
	night = clampf(v[base + 4], 0.0, 1.0)
	var moon_blend := clampf(v[base + 5], 0.0, 1.0)
	var shadow_i := clampf(v[base + 6], 0.0, 1.0)
	var glow := maxf(0.0, v[base + 7])
	var clouds := clampf(v[base + 8], 0.0, 1.0)
	_compute_directions(moon_blend)
	var w := weather
	var sun_mul := float(settings.sunMul) * float(w.sun)
	var amb_mul := float(settings.ambientMul) * float(w.ambient)
	var exp_mul := float(settings.exposureMul) * float(w.exposure)
	var oc := float(w.overcast)
	var sky_top: Color = cols[0]
	var sky_hor: Color = cols[1]
	var sky_bot: Color = cols[2]
	var sun_col: Color = cols[3]
	var hemi_sky: Color = cols[4]
	var hemi_gr: Color = cols[5]
	var fog_col: Color = backdrop if backdrop != null else sky_hor
	if oc > 0.002:
		fog_col = _overcast(fog_col, oc)
		sun_col = _overcast(sun_col, oc * 0.85)
		hemi_sky = _overcast(hemi_sky, oc * 0.6)
		hemi_gr = _overcast(hemi_gr, oc * 0.6)
	state = {"skyTop": sky_top, "skyHorizon": sky_hor, "skyBottom": sky_bot, "sunColor": sun_col, "sunIntensity": sun_i,
		"hemiIntensity": hemi_i, "exposure": exposure, "night": night, "glow": glow, "clouds": clouds, "shadow": shadow_i}

	# directional light (three intensity = Godot energy; see lum_common.gdshaderinc)
	# (Godot light colours are sRGB: it linearises them itself)
	sun.light_color = sun_col.linear_to_srgb()
	sun.light_energy = sun_i * sun_mul
	sun.shadow_opacity = shadow_i
	sun.look_at_from_position(light_dir * 60.0, Vector3.ZERO, Vector3.UP if absf(light_dir.y) < 0.999 else Vector3.FORWARD)

	# global shader parameters
	RenderingServer.global_shader_parameter_set("lum_sun_dir", light_dir)
	var sc := sun_col * (sun_i * sun_mul / SUN_REFERENCE_INTENSITY)
	RenderingServer.global_shader_parameter_set("lum_sun_color", Vector3(sc.r, sc.g, sc.b))
	RenderingServer.global_shader_parameter_set("lum_night", night)
	RenderingServer.global_shader_parameter_set("lum_fog_color", Vector3(fog_col.r, fog_col.g, fog_col.b))
	var fog_mul := fog_tuning * float(w.fog) * zoom_fog * level_fog
	RenderingServer.global_shader_parameter_set("lum_fog_density", fog_d * fog_mul)
	RenderingServer.global_shader_parameter_set("lum_fog_start", fog_start)
	var hs := hemi_sky * (hemi_i * amb_mul)
	var hg := hemi_gr * (hemi_i * amb_mul)
	RenderingServer.global_shader_parameter_set("lum_hemi_sky", Vector3(hs.r, hs.g, hs.b))
	RenderingServer.global_shader_parameter_set("lum_hemi_ground", Vector3(hg.r, hg.g, hg.b))
	RenderingServer.global_shader_parameter_set("lum_wind", Vector2(float(w.windX), float(w.windZ)))
	RenderingServer.global_shader_parameter_set("lum_wind_strength", float(w.wind))

	# sky
	if sky_material:
		sky_material.set_shader_parameter("top_color", sky_top)
		sky_material.set_shader_parameter("horizon_color", _overcast(sky_hor, oc))
		sky_material.set_shader_parameter("bottom_color", sky_bot)
		sky_material.set_shader_parameter("sun_dir", sun_dir)
		sky_material.set_shader_parameter("moon_dir", moon_dir)
		sky_material.set_shader_parameter("sun_color", cols[3])
		sky_material.set_shader_parameter("night", night)
		sky_material.set_shader_parameter("glow", glow)
		sky_material.set_shader_parameter("clouds", clampf(clouds + oc * 0.45, 0.0, 1.0))
		sky_material.set_shader_parameter("sky_time", clock)
	if environment:
		if backdrop != null:
			environment.background_mode = Environment.BG_COLOR
			environment.background_color = (backdrop as Color).linear_to_srgb()
		else:
			environment.background_mode = Environment.BG_SKY
	if grade:
		grade.set_shader_parameter("tone_exposure", exposure * exp_mul)
		if compat and environment:
			# Godot's ACES: colour × exposure × 1.8 → fit; three's: colour × exposure / 0.6 → fit
			environment.tonemap_exposure = exposure * exp_mul / (0.6 * 1.8)
		grade.set_shader_parameter("temperature", 0.04 + float(w.temp))
		grade.set_shader_parameter("saturation", 1.3 + float(w.sat) - 0.22 * night)

	# point lights and emissives
	for h in point_lights:
		var f := 1.0
		if h.flicker > 0.0:
			f = maxf(0.0, 1.0 + h.flicker * (flicker_noise(clock * h.flickerSpeed, h.seed) - 0.5) * 1.7)
		var day_level: float = lerpf(0.05, 0.45, oc) if h.nightOnly else 1.0
		var night_scale: float = lerpf(day_level, 1.0, night) if h.nightOnly else 1.0
		(h.light as OmniLight3D).light_energy = h.intensity * night_scale * f * float(settings.pointLightMul)
	for e in emissives:
		var day_v: float = lerpf(e.baseDay, e.night * 0.4, oc)
		(e.material as ShaderMaterial).set_shader_parameter("emissive_intensity", lerpf(day_v, e.night, night))


func _overcast(c: Color, k: float) -> Color:
	if k <= 0.0:
		return c
	var l := c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722
	return c.lerp(OVERCAST_TINT * l, k)


## The keyframe nearest the current time (HUD clock name).
func phase_name() -> String:
	var best := ""
	var bd := INF
	for k in keyframes:
		var d := minf(absf(float(k.t) - time_of_day), 24.0 - absf(float(k.t) - time_of_day))
		if d < bd:
			bd = d
			best = str(k.get("name", ""))
	return best
