class_name LumHUD
extends Control
## The HUD (src/engine/ui/HUD.js, InteractPrompt.js, Banner.js, Fader.js): the clock with the hour's
## name, the location plate (the region the player is in, else the level), the arrival banner,
## toasts, the interaction prompt over what the player can talk to or examine, and a fader.

const FONT_BODY := preload("res://assets/fonts/Jersey15-Regular.ttf")
const FONT_SMALL := preload("res://assets/fonts/Jersey10-Regular.ttf")
const FONT_TINY := preload("res://assets/fonts/Tiny5-Regular.ttf")

var clock_label: Label
var phase_label: Label
var location_label: Label
var sub_label: Label
var toast_label: Label
var prompt: PanelContainer
var prompt_label: Label
var banner: Control
var banner_title: Label
var banner_sub: Label
var fader: ColorRect
var help: Label
var _toast_t := 0.0
var _banner_t := 0.0


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	clock_label = _label(FONT_BODY, 40, Color("#f4ecd8"))
	clock_label.anchor_left = 1.0
	clock_label.anchor_right = 1.0
	clock_label.offset_left = -220
	clock_label.offset_right = -28
	clock_label.offset_top = 18
	clock_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	phase_label = _label(FONT_SMALL, 24, Color("#c9a45c"))
	phase_label.anchor_left = 1.0
	phase_label.anchor_right = 1.0
	phase_label.offset_left = -320
	phase_label.offset_right = -28
	phase_label.offset_top = 60
	phase_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	location_label = _label(FONT_BODY, 34, Color("#f4ecd8"))
	location_label.offset_left = 28
	location_label.offset_top = 18
	sub_label = _label(FONT_SMALL, 22, Color("#c9a45c"))
	sub_label.offset_left = 30
	sub_label.offset_top = 56
	toast_label = _label(FONT_BODY, 32, Color("#f4ecd8"))
	toast_label.anchor_left = 0.5
	toast_label.anchor_right = 0.5
	toast_label.offset_left = -400
	toast_label.offset_right = 400
	toast_label.offset_top = 120
	toast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast_label.modulate.a = 0.0
	prompt = PanelContainer.new()
	var ps := StyleBoxFlat.new()
	ps.bg_color = Color(0.06, 0.07, 0.13, 0.85)
	ps.border_color = Color("#c9a45c")
	ps.set_border_width_all(2)
	ps.content_margin_left = 10
	ps.content_margin_right = 10
	ps.content_margin_top = 0
	ps.content_margin_bottom = 2
	prompt.add_theme_stylebox_override("panel", ps)
	prompt_label = _label(FONT_SMALL, 24, Color("#f4ecd8"), prompt)
	prompt.visible = false
	add_child(prompt)
	banner = Control.new()
	banner.set_anchors_preset(Control.PRESET_FULL_RECT)
	banner.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(banner)
	banner_title = _label(FONT_BODY, 64, Color("#f4ecd8"), banner)
	banner_title.anchor_left = 0.5
	banner_title.anchor_right = 0.5
	banner_title.anchor_top = 0.28
	banner_title.offset_left = -600
	banner_title.offset_right = 600
	banner_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	banner_sub = _label(FONT_SMALL, 30, Color("#c9a45c"), banner)
	banner_sub.anchor_left = 0.5
	banner_sub.anchor_right = 0.5
	banner_sub.anchor_top = 0.28
	banner_sub.offset_left = -600
	banner_sub.offset_right = 600
	banner_sub.offset_top = 74
	banner_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	banner.modulate.a = 0.0
	help = _label(FONT_TINY, 16, Color(0.95, 0.92, 0.85, 0.75))
	help.anchor_top = 1.0
	help.anchor_bottom = 1.0
	help.offset_left = 28
	help.offset_top = -30
	help.text = "WASD MOVE · SHIFT RUN · SPACE TALK · Q/E TURN · Z/X ZOOM · T TIME · R WEATHER · P PHOTO · PGUP/PGDN LEVEL"
	fader = ColorRect.new()
	fader.color = Color(0, 0, 0, 0)
	fader.set_anchors_preset(Control.PRESET_FULL_RECT)
	fader.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(fader)


func _label(font: Font, size: int, color: Color, parent: Node = self) -> Label:
	var l := Label.new()
	l.add_theme_font_override("font", font)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_shadow_color", Color(0.03, 0.02, 0.06, 0.85))
	l.add_theme_constant_override("shadow_offset_x", 2)
	l.add_theme_constant_override("shadow_offset_y", 2)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(l)
	return l


func set_time(hours: float, phase: String) -> void:
	var h := int(floor(hours)) % 24
	var m := int(floor((hours - floor(hours)) * 60.0))
	clock_label.text = "%02d:%02d" % [h, m]
	phase_label.text = phase.to_upper()


func set_location(name: String, sub: String) -> void:
	location_label.text = name
	sub_label.text = sub


func toast(text: String, seconds := 2.4) -> void:
	toast_label.text = text.replace("{", "").replace("}", "")
	_toast_t = seconds


func show_banner(title: String, sub: String) -> void:
	banner_title.text = title.to_upper()
	banner_sub.text = sub
	_banner_t = 4.0


func show_prompt(screen_pos: Vector2, verb: String) -> void:
	prompt_label.text = "SPACE  " + verb.to_upper()
	prompt.visible = true
	prompt.reset_size()
	prompt.position = screen_pos - Vector2(prompt.size.x * 0.5, prompt.size.y)


func hide_prompt() -> void:
	prompt.visible = false


func fade_to(alpha: float, seconds: float) -> void:
	var tw := create_tween()
	tw.tween_property(fader, "color:a", alpha, seconds)
	await tw.finished


func _layout() -> void:
	# (positions from the viewport size: robust whatever the parent Control's layout state)
	var vs := get_viewport_rect().size
	size = vs
	clock_label.position = Vector2(vs.x - 220.0, 18.0)
	clock_label.size = Vector2(192.0, 44.0)
	phase_label.position = Vector2(vs.x - 320.0, 60.0)
	phase_label.size = Vector2(292.0, 28.0)
	toast_label.position = Vector2(vs.x * 0.5 - 400.0, 120.0)
	toast_label.size = Vector2(800.0, 40.0)
	banner.position = Vector2.ZERO
	banner.size = vs
	banner_title.position = Vector2(vs.x * 0.5 - 600.0, vs.y * 0.28)
	banner_title.size = Vector2(1200.0, 70.0)
	banner_sub.position = Vector2(vs.x * 0.5 - 600.0, vs.y * 0.28 + 74.0)
	banner_sub.size = Vector2(1200.0, 36.0)
	help.position = Vector2(28.0, vs.y - 30.0)
	fader.position = Vector2.ZERO
	fader.size = vs


func _process(dt: float) -> void:
	_layout()
	if _toast_t > 0.0:
		_toast_t -= dt
		toast_label.modulate.a = clampf(minf(_toast_t / 0.4, 1.0), 0.0, 1.0)
	if _banner_t > 0.0:
		_banner_t -= dt
		var t := 4.0 - _banner_t
		banner.modulate.a = clampf(minf(t / 0.6, _banner_t / 0.8), 0.0, 1.0)
