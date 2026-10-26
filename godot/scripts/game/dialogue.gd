class_name LumDialogue
extends RefCounted
## Conversations — a port of src/game/dialogue.js.
##
##  - `CONVERSATIONS`: Emberfall's hand-written villagers (a level NPC's `script` id);
##  - `level_conversation`: any other villager, from its `dialogue` pages plus a built-in
##    `action` (rest / shop / music).
## A conversation is a coroutine `func(ctx: Context) -> void`; `await ctx.say(lines)` opens the
## dialog box as the villager and returns the chosen choice index (-1: no choice).
## Markup: `{word}` is shown in gold.
##
## The drillmaster and the shopkeeper of Cinderwatch Pass (combat) come with the combat phase;
## until then they speak their level dialogue.


class Context:
	extends RefCounted
	var game
	var npc
	var visits := 0
	## say(lines: Array) → int (await it)
	var say_fn: Callable

	func say(lines: Array) -> int:
		return await say_fn.call(lines)

	func toast(text: String) -> void:
		game.toast(text)

	func sfx(_name: String) -> void:
		pass


## Run the conversation of a level villager object (its `script`, else its `dialogue`).
static func run(ctx: Context, obj: Dictionary) -> void:
	match str(obj.get("script", "")):
		"elder": await elder(ctx)
		"innkeeper": await innkeeper(ctx)
		"merchant": await merchant(ctx)
		"guard": await guard(ctx)
		"farmer": await farmer(ctx)
		"child": await child(ctx)
		"bard": await bard(ctx)
		"scholar": await scholar(ctx)
		_: await level_conversation(ctx, obj)


static func elder(ctx: Context) -> void:
	if ctx.visits == 0:
		await ctx.say([
			"Ah, a traveler. Welcome to {Emberfall}, child. Mind the cobbles — they are older than I am, and twice as stubborn.",
			"Our founders followed this river up from the lowlands four hundred years ago. At dusk the falls catch the last of the sun and glow like embers in a hearth.",
			"Hence the name. We are not an imaginative people, but we are an honest one.",
			"If your feet are weary, the {Ember & Oak} has a bed and a bowl of stew. Rosalind keeps the hearth warm and the gossip warmer.",
		])
	elif ctx.visits % 2 == 1:
		await ctx.say([
			"Thirsty? The well is free to all. Its water comes down from {Windmill Hill}, and in all my years it has never once run dry.",
			"Climb the stair by the inn some evening. The whole valley turns to gold up there.",
		])
	else:
		await ctx.say(["Still here? Good. A village is only as warm as the company that lingers in it."])


static func innkeeper(ctx: Context) -> void:
	var choice: int = await ctx.say([
		"Welcome to the {Ember & Oak}! Warm beds, hot stew, and only a modest amount of snoring from the loft.",
		{"text": "Will you rest until morning?", "choices": ["Not yet", "Rest until morning"]},
	])
	if choice == 1:
		await ctx.game.rest_until_morning()
		await ctx.say(["Good morning, sleepyhead! Breakfast is on the table, and the rooster has been shouting about it for an hour."])
	else:
		await ctx.say(["Take your time, dear. The fire will keep."])


static func merchant(ctx: Context) -> void:
	var choice: int = await ctx.say([
		"Step right up! The finest produce this side of the river — and the only produce this side of the river, but let us not dwell on that.",
		{"text": "An apple, fresh from the valley orchards? For a new face in {Emberfall}, it is on the house.", "choices": ["Just looking", "Take an apple"]},
	])
	if choice == 1:
		var n: int = int(ctx.game.inventory.get("apples", 0)) + 1
		ctx.game.inventory["apples"] = n
		ctx.toast("Obtained: Crisp Apple ×%d" % n if n > 1 else "Obtained: Crisp Apple")
		await ctx.say(["A fine choice! Crisp as a winter morning and twice as sweet. Come back tomorrow — I will have pears. Probably."])
	else:
		await ctx.say(["Looking is free! ...For now."])


static func guard(ctx: Context) -> void:
	if ctx.visits == 0:
		await ctx.say([
			"Halt! State your— ah. Forgive me, traveler. Force of habit.",
			"Nothing has crossed this bridge in years but ducks and gossip, and I have yet to arrest either.",
			"The grove beyond turns to amber this time of year. Keep to the path after dark — the river is gentle, but she is deeper than she looks.",
		])
	else:
		await ctx.say(["All quiet on the bridge. Just the way I like it. ...Mostly."])


static func farmer(ctx: Context) -> void:
	await ctx.say([
		"Hm? Oh, don't mind me. Just asking the turnips how they are getting on.",
		"Soil's been kind this year. Rain came when we asked for it and kept away when we didn't. Can't ask fairer than that.",
		"If you see my granddaughter, tell her the chickens have filed a formal complaint.",
	])


static func child(ctx: Context) -> void:
	if ctx.visits % 2 == 0:
		await ctx.say([
			"Shh! I'm sneaking up on {Duchess}. She's the plump one. She's also the fastest, which is not fair at all.",
			"Grandpa says if I catch her, I get to name the next batch of eggs!",
		])
	else:
		await ctx.say(["...Hey, you're tall. Could you be a fence? You just have to stand really, really still."])


static func bard(ctx: Context) -> void:
	var playing: bool = ctx.game.music_playing
	if ctx.visits == 0:
		await ctx.say([
			"A listener! Sit, sit. The fire is warm and my lute is — mostly — in tune.",
			"You have been hearing me since the square, I expect. This one is called {Emberfall Evening}. I wrote it on that very bench, the night the falls turned gold." if playing
			else "This one is called {Emberfall Evening}. I wrote it on that very bench, the night the falls turned gold.",
		])
		if not playing:
			ctx.game.set_music(true)
			ctx.toast("♪ Emberfall Evening")
	elif playing:
		var choice: int = await ctx.say([{"text": "Another verse, or shall I rest my fingers by the fire?", "choices": ["Keep playing", "Rest a while"]}])
		if choice == 1:
			await ctx.say(["No offence taken. Even a bard's fingers need a rest by the fire."])
			ctx.game.set_music(false)
			ctx.toast("The music fades…")
		else:
			await ctx.say(["Then another verse it is! This part is my favourite — the river joins in."])
	else:
		await ctx.say(["Quiet suits a fire, but a song suits it better. Here — from the top."])
		ctx.game.set_music(true)
		ctx.toast("♪ Emberfall Evening")


static func scholar(ctx: Context) -> void:
	if ctx.visits == 0:
		await ctx.say([
			"Oh! A visitor on the hill. I am cataloguing how the light moves over this valley. Would you believe it is different every hour?",
			"Press {T} and watch the day turn — dawn, noon, golden hour, dusk and night. I have documented each one. Twice.",
			"{R} summons the weather: rain, then snow, then clear skies again. Do not ask me how. Scholarship has its limits.",
			"{P} hides everything but the view. {Q} and {E} turn the world around you, and {Z} and {X} — or the wheel — bring it closer or push it away.",
			"And should you wish to see my working notes, {F1} opens them. {H} will remind you of all this, should you forget.",
		])
	else:
		await ctx.say([
			"Remember: {T} for the hour, {R} for the weather, {P} for the view, {H} for help. The rest is patience.",
			"Golden hour is my favourite. The shadows grow long and everything looks like it remembers something.",
		])


## The pages of a level villager's `dialogue` (strings, or { text, choices }).
static func dialogue_pages(v) -> Array:
	var out: Array = []
	var list: Array = v if v is Array else [v]
	for d in list:
		if d is String:
			if d.strip_edges() != "":
				out.append(d)
		elif d is Dictionary and d.get("text") is String:
			var choices: Array = []
			for c in d.get("choices", []):
				var s := str(c)
				if s.strip_edges() != "":
					choices.append(s)
			out.append({"text": d.text, "choices": choices} if choices.size() else d.text)
	return out


static func level_conversation(ctx: Context, obj: Dictionary) -> void:
	var pages := dialogue_pages(obj.get("dialogue", []))
	var action: String = str(obj.get("action", "none"))
	var item := str(obj.get("item", "")) if str(obj.get("item", "")) != "" else "Crisp Apple"
	var last = pages.back() if pages.size() else null
	var ends_with_choice: bool = last is Dictionary
	var first_yes := 0 if ends_with_choice and last.choices.size() == 1 else 1
	var playing: bool = ctx.game.music_playing
	if not ends_with_choice:
		if action == "rest":
			pages.append({"text": "Will you rest until morning?", "choices": ["Not yet", "Rest until morning"]})
		elif action == "shop":
			pages.append({"text": "Would you like the %s?" % item, "choices": ["Just looking", "Yes, please"]})
		elif action == "music" and playing:
			pages.append({"text": "Another song, or a little quiet?", "choices": ["Keep playing", "Some quiet"]})
	if pages.is_empty():
		pages.append("…")
	var choice: int = await ctx.say(pages)
	var yes := choice >= first_yes
	if action == "rest" and yes:
		await ctx.game.rest_until_morning()
	elif action == "shop" and yes:
		var key := item.to_lower()
		var n: int = int(ctx.game.inventory.get(key, 0)) + 1
		ctx.game.inventory[key] = n
		ctx.toast("Obtained: %s ×%d" % [item, n] if n > 1 else "Obtained: %s" % item)
	elif action == "music":
		if ends_with_choice:
			if yes and not playing:
				ctx.game.set_music(true)
				ctx.toast("♪ Music")
		elif not playing:
			ctx.game.set_music(true)
			ctx.toast("♪ Music")
		elif yes:
			ctx.game.set_music(false)
			ctx.toast("The music fades…")
