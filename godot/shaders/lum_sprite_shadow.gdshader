// The shadow proxy of a character sprite: a copy of the quad turned to face the sun and drawn only
// in the shadow pass (Sprite3D.shadowProxy), so the cast shadow is the full silhouette whatever the
// camera angle. It cuts the current frame out of the sheet like the visible quad.
shader_type spatial;
render_mode cull_disabled, unshaded, shadows_disabled;

uniform sampler2D sheet : source_color, filter_nearest, repeat_disable;
uniform vec4 frame = vec4(0.0, 0.0, 1.0, 1.0);
uniform bool flip_x = false;
uniform float alpha_scissor = 0.5;

void fragment() {
	vec2 q = UV;
	if (flip_x) q.x = 1.0 - q.x;
	if (texture(sheet, frame.xy + q * frame.zw).a < alpha_scissor) {
		discard;
	}
	ALBEDO = vec3(0.0);
}
