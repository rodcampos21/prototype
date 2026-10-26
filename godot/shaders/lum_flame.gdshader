// Pixel-art flame (src/engine/world/props/Flame.js): a camera-yaw billboard with hand-animated
// (12 fps) tongues in fire bands; the white-hot core is HDR so it blooms. Unlit.
shader_type spatial;
render_mode skip_vertex_transform, unshaded, cull_disabled, shadows_disabled;

#include "res://shaders/lum_common.gdshaderinc"

uniform float seed = 0.0;
uniform float intensity = 1.0;
uniform float speed = 1.0;
uniform float lift = 0.02;
uniform vec2 px_size = vec2(8.0, 12.0);
uniform vec3 fire0 = vec3(0.2, 0.02, 0.01);
uniform vec3 fire1 = vec3(0.4, 0.05, 0.02);
uniform vec3 fire2 = vec3(0.7, 0.15, 0.03);
uniform vec3 fire3 = vec3(0.9, 0.35, 0.05);
uniform vec3 fire4 = vec3(1.0, 0.7, 0.2);
uniform vec3 fire5 = vec3(2.4, 2.2, 1.6);

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
	vec2 px = floor(UV * px_size);
	vec2 uv = (px + 0.5) / px_size;
	float s_off = fract(seed * 0.1731) * 20.0;
	float t = mod(floor(lum_time * 12.0 * speed), 600.0) / 12.0 + s_off;
	float y = uv.y;
	float x = uv.x * 2.0 - 1.0;
	float wob = fnoise(vec2(y * 3.2 - t * 2.3, t * 0.7 + s_off)) - 0.5;
	x += wob * 0.35 * y;
	float w = 0.98 * pow(max(1.0 - y, 0.0), 0.42) * (0.9 + 0.1 * smoothstep(0.0, 0.3, y));
	float rb = 1.0 - clamp(y / 0.16, 0.0, 1.0);
	w *= mix(0.45, 1.0, sqrt(max(1.0 - rb * rb, 0.0)));
	float heat = (1.0 - abs(x) / max(w, 1e-3)) * 1.3;
	float lob = sin(x * 6.9 + t * 1.7 + s_off) * 0.5 + 0.5;
	heat -= (1.0 - lob) * 0.6 * smoothstep(0.5, 1.0, y);
	vec2 q = vec2(px.x * 0.42, px.y * 0.36 - t * 5.5);
	float n = fnoise(q + s_off * 3.0) * 0.6 + fnoise(q * 2.1 + 3.7) * 0.4;
	heat += (n - 0.5) * (0.3 + 0.5 * y);
	heat -= y * 0.15;
	if (heat < 0.08) discard;
	vec3 col;
	if (heat > 1.05 && y < 0.38) col = fire5;
	else if (heat > 0.9) col = fire4;
	else if (heat > 0.55) col = fire3;
	else if (heat > 0.24 || y < 0.25 || y > 0.55) col = fire2;
	else col = fire1;
	ALBEDO = lum_out(col * intensity);
	FOG = lum_fog(VERTEX);
}
