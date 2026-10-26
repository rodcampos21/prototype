extends Node
## Lum — Luminati's shared constants, input actions and small helpers (autoload).
##
## The controls are the three.js game's (docs/specs/INPUT_AND_CONTROLS.md): W A S D / arrows move,
## Shift runs, Space / Enter / F talk and confirm, Q / E turn the camera, Z / X or the wheel zoom,
## T cycles the time of day, R the weather, P photo mode, N / Tab the map, M the music.

const PPU := 16.0
const LEVEL_HEIGHT := 0.5
const LEVELS_DIR := "res://levels"

## Action → keys (physical keycodes) and gamepad buttons.
const ACTIONS := {
	"move_up": [KEY_W, KEY_UP],
	"move_down": [KEY_S, KEY_DOWN],
	"move_left": [KEY_A, KEY_LEFT],
	"move_right": [KEY_D, KEY_RIGHT],
	"run": [KEY_SHIFT],
	"interact": [KEY_SPACE, KEY_ENTER, KEY_F, KEY_KP_ENTER],
	"cam_left": [KEY_Q],
	"cam_right": [KEY_E],
	"zoom_in": [KEY_Z],
	"zoom_out": [KEY_X],
	"time": [KEY_T],
	"weather": [KEY_R],
	"photo": [KEY_P],
	"map": [KEY_N, KEY_TAB],
	"music": [KEY_M],
	"cancel": [KEY_ESCAPE, KEY_BACKSPACE],
	"debug": [KEY_F1, KEY_QUOTELEFT],
	"level_next": [KEY_PAGEDOWN],
	"level_prev": [KEY_PAGEUP],
}
const PAD := {
	"interact": [JOY_BUTTON_A],
	"cancel": [JOY_BUTTON_B],
	"run": [JOY_BUTTON_X],
	"cam_left": [JOY_BUTTON_LEFT_SHOULDER],
	"cam_right": [JOY_BUTTON_RIGHT_SHOULDER],
	"map": [JOY_BUTTON_BACK],
	"photo": [JOY_BUTTON_Y],
}


func _ready() -> void:
	for action in ACTIONS:
		if not InputMap.has_action(action):
			InputMap.add_action(action, 0.2)
		for key in ACTIONS[action]:
			var ev := InputEventKey.new()
			ev.physical_keycode = key
			InputMap.action_add_event(action, ev)
	for action in PAD:
		for button in PAD[action]:
			var ev := InputEventJoypadButton.new()
			ev.button_index = button
			InputMap.action_add_event(action, ev)
	for pair in [["move_left", JOY_AXIS_LEFT_X, -1.0], ["move_right", JOY_AXIS_LEFT_X, 1.0],
			["move_up", JOY_AXIS_LEFT_Y, -1.0], ["move_down", JOY_AXIS_LEFT_Y, 1.0]]:
		var ev := InputEventJoypadMotion.new()
		ev.axis = pair[1]
		ev.axis_value = pair[2]
		InputMap.action_add_event(pair[0], ev)


## Frame-rate independent exponential damping factor (src/engine/utils/math.js `damp`).
static func damp(lambda: float, dt: float) -> float:
	return 1.0 - exp(-lambda * dt)


static func smoothstep01(e0: float, e1: float, x: float) -> float:
	var t := clampf((x - e0) / (e1 - e0), 0.0, 1.0)
	return t * t * (3.0 - 2.0 * t)


## three.js column-major Matrix4 elements → Godot Transform3D.
static func transform_from_three(e: Array) -> Transform3D:
	return Transform3D(
		Basis(Vector3(e[0], e[1], e[2]), Vector3(e[4], e[5], e[6]), Vector3(e[8], e[9], e[10])),
		Vector3(e[12], e[13], e[14]))


## A colour from a linear [r, g, b] array.
static func lin(c, fallback := Color(1, 1, 1)) -> Color:
	if c is Array and c.size() >= 3:
		return Color(c[0], c[1], c[2])
	return fallback


## An sRGB '#rrggbb' string → linear Color.
static func srgb_hex(hex: String) -> Color:
	return Color.html(hex).srgb_to_linear()


## The levels the bake made (godot/levels/index.json).
static func baked_levels() -> Array:
	var path := LEVELS_DIR + "/index.json"
	if not FileAccess.file_exists(path):
		return []
	var data = JSON.parse_string(FileAccess.get_file_as_string(path))
	return data if data is Array else []
