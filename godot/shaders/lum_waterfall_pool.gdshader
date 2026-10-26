// The churning foam pool at the foot of a waterfall (src/engine/world/Water.js POOL_FRAG).
shader_type spatial;
render_mode cull_disabled, ambient_light_disabled;

#include "res://shaders/lum_common.gdshaderinc"

uniform vec3 foam_color = vec3(0.9, 0.97, 1.0);
uniform vec3 c0 = vec3(0.3, 0.7, 0.7);
uniform vec2 size = vec2(2.0, 1.0);
uniform float seed = 0.0;


float neutral_amount() { return 0.45 * (1.0 - clamp(lum_night, 0.0, 1.0)); }
vec3 lm_neutral(vec3 irr, float amount) {
	return mix(irr, vec3(dot(irr, vec3(0.2126, 0.7152, 0.0722))), amount);
}

void fragment() {
	float t = lum_time;
	vec2 px = floor(UV * size * 16.0);
	vec2 pc = (px + 0.5) / 16.0;
	float across = abs(pc.x - size.x * 0.5) / (size.x * 0.5);
	float d = pc.y + max(0.0, across - 0.55) * 1.4;
	float churn = lum_noise(pc * 3.2 + vec2(t * 0.7, -t * 2.1) + seed);
	float bub = lum_noise(pc * 6.5 - vec2(0.0, t * 1.4) + seed * 2.0);
	float ring = step(0.8, fract(d * 2.2 - t * 0.9 + churn * 0.4)) * step(0.45, bub);
	float core = step(d, 0.36 + churn * 0.45);
	float speck = step(0.8, bub) * step(d, 0.95);
	float foam = max(core, max(ring * step(d, 1.05), speck * 0.8));
	foam *= step(across, 1.0 - churn * 0.12);
	if (foam < 0.5) discard;
	vec3 albedo = mix(c0, foam_color, 0.72 + 0.28 * step(0.6, churn));
	float night = clamp(lum_night, 0.0, 1.0);
	NORMAL = normalize((VIEW_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
	ALBEDO = lum_out(albedo * 1.1 * 0.95);
	EMISSION = lum_out(lum_fog_color * 0.05);
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
}
