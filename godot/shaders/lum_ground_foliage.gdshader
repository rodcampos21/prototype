// Ground foliage (src/engine/sprite/Foliage.js): thousands of instanced pixel-art billboards (grass
// tufts, flowers, reeds, shrubs) in one MultiMesh. Each instance turns to the camera yaw (to the sun
// azimuth in the shadow pass, so shadows are full silhouettes), sways in the wind (top vertices,
// travelling gusts) and is lit like a character sprite (bent normals + wrap diffuse).
// INSTANCE_CUSTOM.x = sprite-strip frame, COLOR = per-instance tint.
shader_type spatial;
render_mode cull_disabled, ambient_light_disabled, specular_disabled;

#include "res://shaders/lum_common.gdshaderinc"

uniform sampler2D map : source_color, filter_nearest_mipmap_anisotropic, repeat_enable;
uniform vec4 map_transform = vec4(1.0, 1.0, 0.0, 0.0);
uniform float alpha_scissor = 0.5;
uniform float foliage_wind = 1.0;
uniform float anchor_y = 0.0;
uniform float quad_height = 1.0;
uniform float frame_u = 1.0;
uniform float root_darken = 0.35;
uniform float normal_up = 0.8;
uniform float wrap_light = 0.5;
uniform float roundness = 0.25;

varying vec2 v_quad_uv;

vec3 yaw_rotate(vec3 v, float yaw) {
	float c = cos(yaw);
	float s = sin(yaw);
	return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
}

void vertex() {
	// the current view's yaw: the camera (colour pass) or the sun (shadow pass)
	vec3 cam_back = INV_VIEW_MATRIX[2].xyz;
	float yaw = atan(cam_back.x, cam_back.z);
	vec3 transformed = yaw_rotate(VERTEX, yaw);
	NORMAL = yaw_rotate(NORMAL, yaw);
	vec3 lf_pos = MODEL_MATRIX[3].xyz;
	float lf_scale = max(length(MODEL_MATRIX[0].xyz), 1e-4);
	float lf_w = clamp((UV.y - anchor_y) / max(1.0 - anchor_y, 1e-3), 0.0, 1.0);
	float wlen = length(lum_wind);
	vec2 wdir = wlen > 1e-4 ? lum_wind / wlen : vec2(1.0, 0.0);
	float lf_hash = fract(sin(dot(lf_pos.xz, vec2(12.9898, 78.233))) * 43758.5453);
	float lf_wave = dot(lf_pos.xz, wdir) * 0.42 - lum_time * (1.25 + wlen * 0.55);
	float lf_gust = 0.5 + 0.5 * sin(lf_wave) + 0.25 * sin(lf_wave * 0.37 + 1.7);
	lf_gust = lf_gust * lf_gust;
	float lf_flutter = sin(lum_time * (2.1 + lf_hash * 1.9) + lf_hash * 6.2831);
	float lf_amt = lum_wind_strength * foliage_wind * (0.03 + 0.06 * wlen) * quad_height * lf_scale;
	vec2 lf_sway = wdir * lf_amt * (0.3 + lf_gust * 1.1 + lf_flutter * 0.25) + vec2(-wdir.y, wdir.x) * lf_amt * lf_flutter * 0.3;
	transformed.xz += lf_sway * lf_w / lf_scale;
	transformed.y -= dot(lf_sway, lf_sway) * lf_w / (lf_scale * max(quad_height * lf_scale, 0.2)) * 0.5;
	VERTEX = transformed;
	// three's quad uv (v = 0 at the root), before the frame offset
	v_quad_uv = UV;
	UV = UV * map_transform.xy + map_transform.zw + vec2(INSTANCE_CUSTOM.x * frame_u, 0.0);
}

void fragment() {
	vec4 tex = lum_in(texture(map, UV));
	vec4 diffuse = tex * vec4(COLOR.rgb, 1.0);
	if (diffuse.a < alpha_scissor) {
		discard;
	}
	diffuse.rgb *= mix(1.0 - root_darken, 1.0, smoothstep(0.0, 0.6, v_quad_uv.y));
	ALBEDO = lum_out(diffuse.rgb);
	// bent normal (Sprite3D patchSpriteLighting): toward the camera, leaning up, rounded across
	vec3 ln_up = normalize((VIEW_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
	vec3 ln_cam = normalize(-VERTEX);
	vec3 n = normalize(mix(ln_cam, ln_up, normal_up));
	n = normalize(n + vec3((v_quad_uv.x * 2.0 - 1.0) * roundness, 0.0, 0.0));
	NORMAL = n;
	vec3 wn = normalize((INV_VIEW_MATRIX * vec4(n, 0.0)).xyz);
	if (lum_debug > 0.5 && lum_debug < 4.5) {
		EMISSION = lum_debug < 1.5 ? ALBEDO : lum_debug < 2.5 ? COLOR.rgb : lum_debug < 3.5 ? wn * 0.5 + 0.5 : lum_hemi(wn);
		ALBEDO = vec3(0.0);
	}
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
