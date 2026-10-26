// The soft additive glow card around a flame (src/engine/world/props/Flame.js GLOW_FRAG): flickers,
// fades toward the flame base, brighter at night; fog fades it out instead of tinting it.
shader_type spatial;
render_mode skip_vertex_transform, unshaded, cull_disabled, shadows_disabled, blend_add, depth_draw_never;

#include "res://shaders/lum_common.gdshaderinc"

uniform float seed = 0.0;
uniform float intensity = 0.6;
uniform float day = 0.25;
uniform float lift = -0.05;
uniform float base_v = -1.0;
uniform vec3 color = vec3(1.0, 0.54, 0.23);

float fh21(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}
float fnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(fh21(i), fh21(i + vec2(1.0, 0.0)), f.x), mix(fh21(i + vec2(0.0, 1.0)), fh21(i + vec2(1.0, 1.0)), f.x), f.y);
}

void vertex() {
	vec3 c = MODEL_MATRIX[3].xyz;
	float sx = length(MODEL_MATRIX[0].xyz);
	float sy = length(MODEL_MATRIX[1].xyz);
	vec3 right = vec3(cos(lum_camera_yaw), 0.0, -sin(lum_camera_yaw));
	vec3 to_cam = vec3(sin(lum_camera_yaw), 0.0, cos(lum_camera_yaw));
	vec3 wpos = c + right * VERTEX.x * sx + vec3(0.0, 1.0, 0.0) * VERTEX.y * sy + to_cam * lift;
	VERTEX = (VIEW_MATRIX * vec4(wpos, 1.0)).xyz;
	NORMAL = normalize((VIEW_MATRIX * vec4(to_cam, 0.0)).xyz);
}

void fragment() {
	float r = length(UV - 0.5) * 2.0;
	float g = pow(max(1.0 - r, 0.0), 1.7);
	g *= smoothstep(base_v - 0.04, base_v + 0.2, UV.y);
	float flick = 0.82 + 0.18 * fnoise(vec2(mod(lum_time, 60.0) * 7.0, fract(seed * 0.1731) * 40.0));
	float k = g * flick * intensity * mix(day, 1.0, lum_night);
	if (k < 0.002) discard;
	float fog_f = lum_fog(VERTEX).a;
	ALBEDO = lum_out(color * k * (1.0 - fog_f));
}
