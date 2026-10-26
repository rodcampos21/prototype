// Water surface (src/engine/world/Water.js): one mesh over every water tile. Pixel-art depth bands
// (shallow teal → deep blue) from the baked shore texture, ripple dashes drifting with the flow
// map, foam lines rolling to the shore, a fresnel-ish sky reflection, HDR sun / moon glints that
// bloom, and the vertical cross-sections where the diorama cuts a water body.
//
// three computes the water's light itself (lmIrradiance with the normal pointing up); here the
// direct part is `light()` (with the same "neutral" desaturation of the light's hue) and the
// hemisphere part goes through EMISSION. The final saturation boost is applied to the albedo.
shader_type spatial;
render_mode blend_mix, depth_draw_always, cull_back, ambient_light_disabled;

#include "res://shaders/lum_common.gdshaderinc"

uniform sampler2D shore : filter_linear, repeat_disable;
uniform vec4 shore_rect = vec4(0.0, 0.0, 1.0, 1.0);
uniform float max_dist = 2.0;
uniform float max_depth = 1.5;
uniform float max_flow = 1.0;
uniform vec3 c0 = vec3(0.3, 0.7, 0.7);
uniform vec3 c1 = vec3(0.2, 0.55, 0.65);
uniform vec3 c2 = vec3(0.12, 0.4, 0.6);
uniform vec3 c3 = vec3(0.08, 0.28, 0.5);
uniform vec3 crest = vec3(0.8, 0.95, 1.0);
uniform vec3 foam_color = vec3(0.9, 0.97, 1.0);
uniform float opacity = 0.9;
uniform float shallow_opacity = 0.58;
uniform float glint_amount = 1.0;
uniform float foam_amount = 1.0;
uniform float brightness = 1.15;
uniform float deep_at = 0.34;
uniform float reflect_amount = 0.1;
uniform float saturation = 1.12;
uniform float neutral = 0.35;

varying vec3 v_world_pos;
varying vec3 v_world_normal;
varying float v_top;
// fragment → light
varying float v_glint;
varying vec3 v_glint_col;

float lm_bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float lm_bayer4(vec2 a) { return lm_bayer2(0.5 * a) * 0.25 + lm_bayer2(a); }
vec3 lm_saturate(vec3 c, float amount) {
	float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
	return max(mix(vec3(l), c, amount), 0.0);
}
float neutral_amount() { return neutral * (1.0 - clamp(lum_night, 0.0, 1.0)); }
vec3 lm_neutral(vec3 irr, float amount) {
	return mix(irr, vec3(dot(irr, vec3(0.2126, 0.7152, 0.0722))), amount);
}
float lm_ripple(vec2 p, float t) {
	vec2 q = vec2(p.x * 1.9, p.y * 5.2);
	float n = lum_noise(q + vec2(t * 0.22, t * 0.08));
	return n * 0.62 + 0.38 * lum_noise(q * 2.3 + vec2(-t * 0.31, t * 0.17) + 17.0);
}
float lm_flow_ripple(vec2 p, vec2 flow, float t) {
	const float PERIOD = 3.2;
	float ph0 = fract(t / PERIOD);
	float ph1 = fract(t / PERIOD + 0.5);
	float w0 = 1.0 - abs(2.0 * ph0 - 1.0);
	float r0 = lm_ripple(p - flow * (ph0 * PERIOD), t);
	float r1 = lm_ripple(p - flow * (ph1 * PERIOD) + vec2(0.37, 0.61), t);
	float r = mix(r1, r0, w0);
	float norm = inversesqrt(w0 * w0 + (1.0 - w0) * (1.0 - w0));
	return clamp((r - 0.5) * norm + 0.5, 0.0, 1.0);
}

void vertex() {
	v_world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	v_world_normal = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
	v_top = CUSTOM0.x;
}

void fragment() {
	float t = lum_time;
	float night = clamp(lum_night, 0.0, 1.0);
	vec3 cam_pos = INV_VIEW_MATRIX[3].xyz;
	vec3 V = normalize(cam_pos - v_world_pos);
	vec3 sky = lum_fog_color;
	vec3 albedo;
	vec3 emit = vec3(0.0);
	float alpha;
	vec3 light_n = vec3(0.0, 1.0, 0.0);
	v_glint = 0.0;
	v_glint_col = vec3(0.0);
	float sat = mix(saturation, 1.0, night);

	if (v_world_normal.y < 0.5) {
		// vertical cross-section of the water body
		vec2 axis = vec2(-v_world_normal.z, v_world_normal.x);
		float u = dot(v_world_pos.xz, axis);
		vec2 px = floor(vec2(u, v_world_pos.y) * 16.0);
		float below = max(0.0, v_top - (px.y + 0.5) / 16.0);
		float band = 1.6 + clamp(below / 0.3, 0.0, 1.0) * 1.9 + (lum_noise(vec2(px.x * 0.22, px.y * 0.3 + t * 0.4)) - 0.5) * 0.5;
		float q = clamp(floor(band + (lm_bayer4(px) - 0.5) * 0.5), 1.0, 3.0);
		vec3 a = q < 1.5 ? c1 : q < 2.5 ? c2 : c3;
		float wob = lum_noise(vec2(px.x * 0.35 + t * 0.6, 3.0));
		float rim = step(below, 1.1 / 16.0 + wob * 0.06);
		a = mix(a, c1, 0.4 * step(0.78, lum_noise(vec2(px.x * 0.16 - t * 0.25, 1.3))) * (1.0 - rim));
		a = mix(a, crest, rim);
		light_n = normalize(mix(normalize(v_world_normal + vec3(0.0, 0.6, 0.0)), vec3(0.0, 1.0, 0.0), rim));
		albedo = lm_saturate(a, sat) * 0.96;
		emit = sky * 0.04;
		alpha = mix(0.95, 1.0, rim);
	} else {
		vec2 px = floor(v_world_pos.xz * 16.0);
		vec2 pc = (px + 0.5) / 16.0;
		vec4 sh = texture(shore, (pc - shore_rect.xy) * shore_rect.zw);
		float dist = sh.r * max_dist;
		float depth = min(sh.g * max_depth, dist * 1.3 + 0.03);
		vec2 flow = (sh.ba * 2.0 - 1.0) * max_flow;
		float dN = clamp(depth / deep_at, 0.0, 1.0);
		float patch_n = lum_noise(pc * 0.42 + vec2(t * 0.03, -t * 0.021)) * 0.75 + lum_noise(pc * 1.3 - t * 0.05) * 0.25;
		float band = dN * 2.3 + smoothstep(0.5, 0.6, patch_n) * 0.95 * dN;
		float q = clamp(floor(band + (lm_bayer4(px) - 0.5) * 0.5), 0.0, 3.0);
		vec3 a = q < 0.5 ? c0 : q < 1.5 ? c1 : q < 2.5 ? c2 : c3;
		float rp = lm_flow_ripple(pc, flow, t);
		float hi = step(0.69, rp);
		float hi2 = step(0.8, rp);
		float lo = 1.0 - step(0.2, rp);
		a = mix(a, c0, hi * (1.0 - hi2) * 0.7);
		a = mix(a, crest, hi2);
		a *= 1.0 - lo * 0.18;
		// sky reflection (the shadow term of three's version is folded in as "lit")
		float fres = reflect_amount * (0.35 + 1.2 * pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0)) * 0.85;
		float k = clamp(fres + hi * 0.06 * 0.85, 0.0, 0.6);
		// foam
		float fn = lum_noise(pc * 2.1 + vec2(t * 0.13, -t * 0.09));
		float contact = step(dist, (0.05 + 0.07 * fn) * foam_amount);
		float phase = dist * 2.3 + t * 0.3 + fn * 0.35;
		float line_mask = step(0.42, lum_noise(pc * 1.25 + vec2(-t * 0.05, t * 0.04) + 9.0));
		float lines = step(0.86, fract(phase)) * (1.0 - smoothstep(0.12, 0.75 * foam_amount, dist)) * line_mask;
		float foam = max(contact, lines * 0.85);
		albedo = lm_saturate((1.0 - foam) * (1.0 - k) * a + foam * foam_color, sat);
		emit = lm_saturate((1.0 - foam) * k * sky, sat);
		// sun / moon glints: 4-point pixel stars in 4×4 px cells (HDR, they bloom)
		vec3 L = normalize(lum_sun_dir);
		vec3 N = normalize(vec3((rp - 0.5) * 0.35, 1.0, (fn - 0.5) * 0.35));
		float spec = pow(max(dot(reflect(-L, N), V), 0.0), 10.0);
		vec2 cell = floor(px / 4.0);
		float ch = lum_hash12(cell * 1.37 + 3.1);
		float tt = t * (1.8 + ch * 1.6) + ch * 11.0;
		float slot = mod(floor(tt), 4096.0);
		float life = fract(tt);
		float hs = lum_hash12(cell + slot * vec2(7.13, 3.71));
		vec2 gpos = 1.0 + floor(vec2(lum_hash12(cell + slot + 0.5), lum_hash12(cell - slot + 1.7)) * 2.0);
		vec2 lp = abs(px - cell * 4.0 - gpos);
		float manh = lp.x + lp.y;
		float centre = step(manh, 0.5);
		float arms = step(manh, 1.5) * (1.0 - centre) * step(0.28, life) * step(life, 0.72);
		float density = (0.045 + 0.35 * spec) * glint_amount * (0.3 + 0.7 * hi);
		v_glint = step(1.0 - density, hs) * (centre + arms * 0.5) * (1.0 - foam) * step(0.02, L.y);
		v_glint_col = lum_sun_color * 3.0 * mix(1.0, 1.7, night) + mix(vec3(0.25, 0.22, 0.15), vec3(0.04, 0.07, 0.16), night);
		alpha = mix(shallow_opacity, opacity, smoothstep(0.02, 0.35, depth));
		alpha = max(alpha, max(foam, min(1.0, v_glint)));
	}
	NORMAL = normalize((VIEW_MATRIX * vec4(light_n, 0.0)).xyz);
	ALBEDO = lum_out(albedo * brightness);
	EMISSION = lum_out(emit);
	ALPHA = alpha;
	if (lum_debug > 0.5 && lum_debug < 1.5) {
		EMISSION = ALBEDO;
		ALBEDO = vec3(0.0);
	}
	if (lum_debug > 6.5 && lum_debug < 7.5) {
		ALPHA = 0.15;
	}
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
		SPECULAR_LIGHT += v_glint * v_glint_col * ATTENUATION;
	}
}
