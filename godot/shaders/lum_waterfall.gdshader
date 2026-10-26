// Waterfall sheet (src/engine/world/Water.js FALL_FRAG): pixel streaks that accelerate as they fall,
// foam where the water bends over the lip and at the bottom, sparkling HDR droplets, ragged
// splashing side edges and a dithered soft entry from the river surface. UV.y is the arc length
// along the sheet (three's uv), UV.x 0..1 across it.
shader_type spatial;
render_mode blend_mix, depth_draw_always, cull_disabled, ambient_light_disabled;

#include "res://shaders/lum_common.gdshaderinc"

uniform float width_units = 2.0;
uniform float length_units = 2.0;
uniform float lip_length = 0.3;
uniform float seed = 0.0;
uniform vec3 c0 = vec3(0.3, 0.7, 0.7);
uniform vec3 c1 = vec3(0.2, 0.55, 0.65);
uniform vec3 c2 = vec3(0.12, 0.4, 0.6);
uniform vec3 c3 = vec3(0.08, 0.28, 0.5);
uniform vec3 foam_color = vec3(0.9, 0.97, 1.0);

varying vec3 v_world_normal;
varying float v_spark;
varying vec3 v_spark_col;

float neutral_amount() { return 0.5 * (1.0 - clamp(lum_night, 0.0, 1.0)); }
vec3 lm_neutral(vec3 irr, float amount) {
	return mix(irr, vec3(dot(irr, vec3(0.2126, 0.7152, 0.0722))), amount);
}
vec3 lm_saturate(vec3 c, float amount) {
	float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
	return max(mix(vec3(l), c, amount), 0.0);
}
float lm_bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float lm_bayer4(vec2 a) { return lm_bayer2(0.5 * a) * 0.25 + lm_bayer2(a); }

void vertex() {
	v_world_normal = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

void fragment() {
	float t = lum_time;
	float col_x = floor(UV.x * width_units * 16.0);
	float n_cols = floor(width_units * 16.0 + 0.5);
	float py = floor(UV.y * 16.0);
	float fall = max(0.0, UV.y - lip_length);
	float h1 = lum_hash12(vec2(col_x, seed));
	float h2 = lum_hash12(vec2(floor(col_x / 3.0), seed + 5.0));
	float speed = (2.2 + h1 * 1.4) * (0.5 + 0.5 * clamp(fall / 1.0, 0.0, 1.0));
	float s1 = fract(py / 16.0 * (0.55 + 0.35 * h2) - t * speed * 0.5 + h1 * 7.0);
	float s2 = fract(py / 16.0 * 0.3 - t * speed * 0.33 + h2 * 3.0);
	vec3 albedo = mix(c1, c0, 0.2 + 0.6 * h2);
	albedo = mix(albedo, c2, step(0.7, s2) * 0.85);
	albedo = mix(albedo, c3, step(s1, 0.16));
	albedo = mix(albedo, foam_color, step(0.91, s1));
	float lip_foam = 1.0 - step(0.1 + 0.16 * lum_hash12(vec2(col_x, mod(floor(t * 6.0), 4096.0))), abs(UV.y - lip_length));
	float bn = lum_noise(vec2(col_x * 0.45, py * 0.4 - t * 5.0));
	float bot_foam = step(length_units - UV.y, 0.2 + 0.42 * bn);
	float foam = max(lip_foam * 0.85, bot_foam);
	albedo = mix(albedo, foam_color, foam);
	// ragged, splashing side edges and a soft entry from the river surface
	float edge_px = min(col_x, n_cols - 1.0 - col_x);
	float jag = lum_hash12(vec2(py + mod(floor(t * 10.0), 4096.0) * 3.0, col_x + seed));
	if (edge_px < 1.0 && jag < 0.55) discard;
	if (edge_px < 2.0 && jag < 0.18) discard;
	float entry = smoothstep(0.0, 0.18, UV.y);
	if (entry < lm_bayer4(vec2(col_x, py)) * 0.999) discard;

	float night = clamp(lum_night, 0.0, 1.0);
	vec3 nw = normalize((FRONT_FACING ? v_world_normal : -v_world_normal) + vec3(0.0, 1.1, 0.0));
	NORMAL = normalize((VIEW_MATRIX * vec4(nw, 0.0)).xyz);
	float sat = mix(1.12, 1.0, night);
	ALBEDO = lum_out(lm_saturate(albedo * 1.12 * 0.94, sat));
	EMISSION = lum_out(lm_saturate(lum_fog_color * 0.06, sat));
	float sp = step(0.988, lum_hash12(vec2(col_x, py) + mod(floor(t * 9.0), 4096.0) * vec2(3.1, 7.7)));
	v_spark = sp * (1.0 - 0.8 * night) * step(0.5, foam + step(0.9, s1));
	v_spark_col = lum_sun_color * 2.2 + vec3(0.1);
	ALPHA = mix(0.9, 1.0, foam);
	SPECULAR = 0.0;
	ROUGHNESS = 1.0;
	FOG = lum_fog(VERTEX);
}

void light() {
	float ndl = max(dot(NORMAL, LIGHT), 0.0);
	float nm = neutral_amount();
	DIFFUSE_LIGHT += lm_neutral(LIGHT_COLOR * ndl * ATTENUATION * lum_light_scale, nm);
	if (LIGHT_IS_DIRECTIONAL) {
		DIFFUSE_LIGHT += lm_neutral(lum_hemi(normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz)) * LUM_INV_PI, nm);
	}
	if (LIGHT_IS_DIRECTIONAL) {
		SPECULAR_LIGHT += v_spark * v_spark_col * ATTENUATION;
	}
}
