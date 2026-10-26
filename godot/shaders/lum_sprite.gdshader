// Character sprite (src/engine/sprite/Sprite3D.js): an animated pixel-art quad on a sprite sheet,
// lit with Luminati's sprite lighting — the shading normal bent toward the camera and up, rounded
// across the frame so side lights rim one edge, wrap diffuse so a low sun behind the sprite never
// turns it black, and a small warm fill glowing in the sprite's own colours (SPRITE_FILL).
// The quad's UVs are Godot's (0, 0 top-left); `frame` picks the sheet cell.
shader_type spatial;
render_mode cull_disabled, ambient_light_disabled, specular_disabled;

#include "res://shaders/lum_common.gdshaderinc"

uniform sampler2D sheet : source_color, filter_nearest, repeat_disable;
uniform vec4 frame = vec4(0.0, 0.0, 1.0, 1.0); // u0, v0, du, dv
uniform bool flip_x = false;
uniform float alpha_scissor = 0.5;
uniform float normal_up = 0.6;
uniform float wrap_light = 0.6;
uniform float roundness = 0.55;
uniform vec3 emissive = vec3(1.0, 0.913, 0.823);
uniform float emissive_intensity = 0.05;
uniform float dither_opacity = 1.0;
uniform vec4 tint = vec4(1.0);

void fragment() {
	vec2 q = UV;
	if (flip_x) q.x = 1.0 - q.x;
	vec4 tex = lum_in(texture(sheet, frame.xy + q * frame.zw)) * tint;
	if (tex.a < alpha_scissor) {
		discard;
	}
	if (dither_opacity < 0.999 && dither_opacity <= lum_bayer4(FRAGCOORD.xy)) {
		discard;
	}
	ALBEDO = lum_out(tex.rgb);
	vec3 ln_up = normalize((VIEW_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
	vec3 ln_cam = normalize(-VERTEX);
	vec3 n = normalize(mix(ln_cam, ln_up, normal_up));
	n = normalize(n + vec3((UV.x * 2.0 - 1.0) * roundness, 0.0, 0.0));
	NORMAL = n;
	vec3 wn = normalize((INV_VIEW_MATRIX * vec4(n, 0.0)).xyz);
	EMISSION = lum_out(emissive * emissive_intensity * tex.rgb);
	FOG = lum_fog(VERTEX);
}

void light() {
	float ndl = clamp((dot(NORMAL, LIGHT) + wrap_light) / (1.0 + wrap_light), 0.0, 1.0);
	DIFFUSE_LIGHT += LIGHT_COLOR * ATTENUATION * ndl * lum_light_scale;
	if (LIGHT_IS_DIRECTIONAL) {
		// the hemisphere fill, added once (on the sun's pass)
		DIFFUSE_LIGHT += lum_hemi(normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz)) * LUM_INV_PI;
	}
}
