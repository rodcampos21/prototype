class_name LumDialogBox
extends Control
## The conversation box (src/engine/ui/DialogBox.js): a framed pixel panel at the bottom of the
## screen with the speaker's name plate (in the villager's portrait colour), text typed out at a
## steady pace, `{gold}` highlights, a blinking continue marker and a choice list on the last page
## of a question. `open()` is a coroutine that returns the chosen choice index (-1: none).

signal _advanced

const FONT_BODY := preload("res://assets/fonts/Jersey15-Regular.ttf")
const FONT_SMALL := preload("res://assets/fonts/Jersey10-Regular.ttf")
const GOLD := Color("#f2c75c")
const CHARS_PER_SECOND := 48.0

var panel: PanelContainer
var name_plate: PanelContainer
var name_label: Label
var text: RichTextLabel
var marker: Label
var choices_box: VBoxContainer
var is_open := false
var _choices: Array = []
var _choice := 0
var _typing := false
var _blink := 0.0
var _cooldown := 0.0


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel = PanelContainer.new()
	panel.anchor_left = 0.5
	panel.anchor_right = 0.5
	panel.anchor_top = 1.0
	panel.anchor_bottom = 1.0
	panel.offset_left = -430
	panel.offset_right = 430
	panel.offset_top = -210
	panel.offset_bottom = -34
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.07, 0.13, 0.92)
	sb.border_color = Color("#c9a45c")
	sb.set_border_width_all(3)
	sb.shadow_color = Color(0, 0, 0, 0.45)
	sb.shadow_size = 6
	sb.content_margin_left = 26
	sb.content_margin_right = 26
	sb.content_margin_top = 26
	sb.content_margin_bottom = 18
	panel.add_theme_stylebox_override("panel", sb)
	add_child(panel)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 6)
	panel.add_child(vb)
	text = RichTextLabel.new()
	text.bbcode_enabled = true
	text.fit_content = true
	text.scroll_active = false
	text.custom_minimum_size = Vector2(800, 92)
	text.add_theme_font_override("normal_font", FONT_BODY)
	text.add_theme_font_size_override("normal_font_size", 30)
	text.add_theme_color_override("default_color", Color("#f4ecd8"))
	text.add_theme_constant_override("line_separation", 2)
	vb.add_child(text)
	choices_box = VBoxContainer.new()
	choices_box.add_theme_constant_override("separation", 0)
	vb.add_child(choices_box)
	marker = Label.new()
	marker.text = "▼"
	marker.add_theme_font_size_override("font_size", 16)
	marker.add_theme_color_override("font_color", GOLD)
	marker.anchor_left = 1.0
	marker.anchor_right = 1.0
	marker.anchor_top = 1.0
	marker.anchor_bottom = 1.0
	marker.offset_left = -34
	marker.offset_top = -30
	panel.add_child(marker)
	name_plate = PanelContainer.new()
	var nb := StyleBoxFlat.new()
	nb.bg_color = Color("#c9a45c")
	nb.border_color = Color(0.06, 0.07, 0.13, 1)
	nb.set_border_width_all(2)
	nb.content_margin_left = 14
	nb.content_margin_right = 14
	nb.content_margin_top = 2
	nb.content_margin_bottom = 2
	name_plate.add_theme_stylebox_override("panel", nb)
	name_label = Label.new()
	name_label.add_theme_font_override("font", FONT_BODY)
	name_label.add_theme_font_size_override("font_size", 28)
	name_label.add_theme_color_override("font_color", Color(0.07, 0.06, 0.1))
	name_plate.add_child(name_label)
	name_plate.position = Vector2(-410, -232)
	name_plate.anchor_left = 0.5
	name_plate.anchor_top = 1.0
	name_plate.anchor_right = 0.5
	name_plate.anchor_bottom = 1.0
	add_child(name_plate)
	visible = false


## `{word}` → gold; everything else escaped for BBCode.
static func markup(s: String) -> String:
	var out := ""
	var gold := false
	for ch in s:
		if ch == "{":
			out += "[color=#f2c75c]"
			gold = true
		elif ch == "}" and gold:
			out += "[/color]"
			gold = false
		elif ch == "[":
			out += "[lb]"
		else:
			out += ch
	if gold:
		out += "[/color]"
	return out


func open(speaker: String, lines: Array, portrait_color := "") -> int:
	is_open = true
	visible = true
	name_plate.visible = speaker != ""
	name_label.text = speaker
	var nb := name_plate.get_theme_stylebox("panel") as StyleBoxFlat
	if nb:
		nb.bg_color = Color.html(portrait_color) if portrait_color.begins_with("#") else Color("#c9a45c")
	var result := -1
	for page in lines:
		var t: String
		var choices: Array = []
		if page is Dictionary:
			t = str(page.get("text", ""))
			choices = page.get("choices", [])
		else:
			t = str(page)
		text.text = markup(t)
		text.visible_characters = 0
		_set_choices([])
		_typing = true
		_cooldown = 0.12
		var total := text.get_total_character_count()
		var shown := 0.0
		while _typing and shown < total:
			await get_tree().process_frame
			shown += get_process_delta_time() * CHARS_PER_SECOND
			text.visible_characters = int(shown)
		_typing = false
		text.visible_characters = -1
		if choices.size():
			_set_choices(choices)
			await _advanced
			result = _choice
			_set_choices([])
		else:
			await _advanced
	visible = false
	is_open = false
	return result


func _set_choices(list: Array) -> void:
	for c in choices_box.get_children():
		c.queue_free()
	_choices = list
	_choice = 0
	for i in range(list.size()):
		var l := RichTextLabel.new()
		l.bbcode_enabled = true
		l.fit_content = true
		l.scroll_active = false
		l.custom_minimum_size = Vector2(760, 34)
		l.add_theme_font_override("normal_font", FONT_BODY)
		l.add_theme_font_size_override("normal_font_size", 28)
		choices_box.add_child(l)
	_refresh_choices()


func _refresh_choices() -> void:
	var kids := choices_box.get_children()
	for i in range(kids.size()):
		var l := kids[i] as RichTextLabel
		var sel := i == _choice
		l.text = ("[color=#f2c75c]▶ " if sel else "[color=#b9b2a4]   ") + markup(str(_choices[i])) + "[/color]"


func _process(dt: float) -> void:
	var vs := get_viewport_rect().size
	size = vs
	panel.position = Vector2(vs.x * 0.5 - 430.0, vs.y - 210.0)
	panel.size = Vector2(860.0, 176.0)
	name_plate.position = Vector2(vs.x * 0.5 - 410.0, vs.y - 232.0)
	if not is_open:
		return
	_cooldown -= dt
	_blink += dt
	marker.visible = not _typing and _choices.is_empty() and fmod(_blink, 0.8) < 0.5


func _unhandled_input(event: InputEvent) -> void:
	if not is_open:
		return
	if _choices.size() and not _typing:
		if event.is_action_pressed("move_up"):
			_choice = (_choice - 1 + _choices.size()) % _choices.size()
			_refresh_choices()
			get_viewport().set_input_as_handled()
			return
		if event.is_action_pressed("move_down"):
			_choice = (_choice + 1) % _choices.size()
			_refresh_choices()
			get_viewport().set_input_as_handled()
			return
	var advance: bool = event.is_action_pressed("interact") or (event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT)
	if advance:
		get_viewport().set_input_as_handled()
		if _cooldown > 0.0:
			return
		if _typing:
			_typing = false
		else:
			_advanced.emit()
