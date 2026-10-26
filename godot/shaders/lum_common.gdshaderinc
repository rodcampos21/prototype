// lum_common.gdshaderinc — what every Luminati material shares (ported from the three.js engine).
//
// Lighting model (three.js MeshLambertMaterial, src/engine/lighting/LightingSystem.js):
//   - direct light: Lambert with three's intensities (Godot light energy = three intensity), so a
//     light's diffuse is LIGHT_COLOR × N·L × lum_light_scale (Godot's LIGHT_COLOR carries a factor
//     π, three's Lambert BRDF divides by π: lum_light_scale = 1/π²);
//   - ambient: the hemisphere light (sky / ground colours × intensity, set per frame by
//     lighting.gd) added in light() on the sun's pass as irradiance / π, like three's indirect
//     diffuse (Godot's own ambient light is off);
//   - fog: three's FogExp2 with the game's fog start (src/game/AtmosphereFog.js): the first
//     lum_fog_start units in front of the camera stay clear, written through FOG.
//
// Textures use three's UV convention as exported by the bake (tools/godot-bake): canvas textures
// were written bottom-up, so `texture(map, UV)` with the original UVs samples the same texel.

global uniform float lum_time;
global uniform vec2 lum_wind;
global uniform float lum_wind_strength;
global uniform float lum_camera_yaw;
global uniform vec3 lum_sun_dir;
global uniform vec3 lum_sun_color;
global uniform float lum_night;
global uniform vec3 lum_fog_color;
global uniform float lum_fog_density;
global uniform float lum_fog_start;
global uniform vec3 lum_hemi_sky;
global uniform vec3 lum_hemi_ground;
global uniform float lum_light_scale;
global uniform float lum_snow;
global uniform float lum_debug;

const float LUM_INV_PI = 0.3183098861837907;

// Colour spaces per renderer. Forward+ / Mobile: shaders work in linear space (source_color
// textures are decoded when sampled, ALBEDO and EMISSION are linear). Compatibility: sampled
// source_color textures stay sRGB and Godot converts ALBEDO and EMISSION from sRGB to linear
// itself (drivers/gles3/shaders/scene.glsl). Everything here computes in linear space, so on the
// Compatibility renderer the inputs are decoded (lum_in) and the outputs re-encoded (lum_out).
#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
#define LUM_COMPAT
#endif
vec3 lum_srgb_to_linear(vec3 c) {
	return mix(pow((c + 0.055) / 1.055, vec3(2.4)), c / 12.92, lessThan(c, vec3(0.04045)));
}
vec3 lum_linear_to_srgb(vec3 c) {
	c = max(c, vec3(0.0));
	return mix(1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, c * 12.92, lessThan(c, vec3(0.0031308)));
}
// a sampled source_color texel → linear
vec4 lum_in(vec4 c) {
#ifdef LUM_COMPAT
	return vec4(lum_srgb_to_linear(c.rgb), c.a);
#else
	return c;
#endif
}
// a linear colour → what ALBEDO / EMISSION expect on this renderer
vec3 lum_out(vec3 c) {
#ifdef LUM_COMPAT
	return lum_linear_to_srgb(c);
#else
	return c;
#endif
}

// three's hemisphere light irradiance for a world-space normal (before the 1/π of the BRDF)
vec3 lum_hemi(vec3 world_n) {
	float w = 0.5 * dot(world_n, vec3(0.0, 1.0, 0.0)) + 0.5;
	return mix(lum_hemi_ground, lum_hemi_sky, w);
}

// FogExp2 with a start distance: vec4(colour, amount) for FOG
vec4 lum_fog(vec3 view_pos) {
	float d = max(0.0, -view_pos.z - lum_fog_start);
	float f = 1.0 - exp(-lum_fog_density * lum_fog_density * d * d);
	return vec4(lum_fog_color, clamp(f, 0.0, 1.0));
}

// three.js getTangentFrame / perturbNormal2Arb: tangent frame from screen-space derivatives
// (the meshes carry no tangents), in view space.
mat3 lum_tangent_frame(vec3 eye_pos, vec3 surf_norm, vec2 uv, float face) {
	vec3 q0 = dFdx(eye_pos);
	vec3 q1 = dFdy(eye_pos);
	vec2 st0 = dFdx(uv);
	vec2 st1 = dFdy(uv);
	vec3 N = surf_norm;
	vec3 q1perp = cross(q1, N);
	vec3 q0perp = cross(N, q0);
	vec3 T = q1perp * st0.x + q0perp * st1.x;
	vec3 B = q1perp * st0.y + q0perp * st1.y;
	float det = max(dot(T, T), dot(B, B));
	// three's formula assumes WebGL's window y axis (up); Godot's render targets run y down, which
	// mirrors the derived frame. The screen basis' handedness (cross(dx, dy) against the normal that
	// faces the viewer) tells which one is in use, on any renderer.
	float handed = dot(cross(q0, q1), N) < 0.0 ? -1.0 : 1.0;
	float s = det == 0.0 ? 0.0 : face * handed * inversesqrt(det);
	return mat3(T * s, B * s, N);
}

// ordered 4×4 Bayer threshold in (0, 1)
float lum_bayer4(vec2 p) {
	int x = int(mod(floor(p.x), 4.0));
	int y = int(mod(floor(p.y), 4.0));
	int i = y * 4 + x;
	float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
	return (m[i] + 0.5) / 16.0;
}

float lum_hash12(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

float lum_noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(lum_hash12(i), lum_hash12(i + vec2(1.0, 0.0)), u.x),
		mix(lum_hash12(i + vec2(0.0, 1.0)), lum_hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
