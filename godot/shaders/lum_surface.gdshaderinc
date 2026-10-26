// lum_surface.gdshaderinc — the Luminati world surface: terrain, decals (grass fringes, brims),
// props, wind-swayed trunks and foliage cards. One body, compiled per variant by materials.gd with
// `#define`s (the Godot version of the three.js onBeforeCompile patches):
//
//   LUM_VERTEX_COLOR   baked AO / tint in COLOR.rgb (vertexColors)
//   LUM_NORMAL         tangent-space normal map (derivative tangent frame, like three)
//   LUM_EMISSIVE       emissive map (windows, lantern glass; intensity driven by lighting.gd)
//   LUM_DECAL          TileMap decal mask in UV2: alpha = mask.g, shade = mask.r × 255/170
//   LUM_VARIATION      TileMap organic top variation (quarter turns / mirrors per jittered cell)
//   LUM_BOUNCE         TileMap wall ground-bounce fill
//   LUM_WIND           props/Wind.js sway (CUSTOM0.x aSway, CUSTOM0.y aPhase)
//   LUM_BILLBOARD      leaf cards turned to the camera yaw (sun azimuth in the shadow pass), CUSTOM1.xyz aCenter
//   LUM_FOLIAGE        foliage lighting: no back-face normal flip, wrap diffuse (wrap_light)
//   LUM_LIFT           pull toward the camera (decal polygon offset)

#include "res://shaders/lum_common.gdshaderinc"

uniform sampler2D map : source_color, filter_nearest_mipmap_anisotropic, repeat_enable;
uniform vec4 base_color = vec4(1.0);
uniform vec4 map_transform = vec4(1.0, 1.0, 0.0, 0.0); // repeat.xy, offset.xy (three Texture.repeat / offset)
uniform float alpha_scissor = 0.0;
uniform float wrap_light = 0.0;

#ifdef LUM_NORMAL
uniform sampler2D normal_map : filter_nearest_mipmap_anisotropic, repeat_enable;
uniform vec2 normal_scale = vec2(1.0);
#endif
#ifdef LUM_EMISSIVE
uniform sampler2D emissive_map : source_color, filter_nearest_mipmap_anisotropic, repeat_enable;
uniform vec3 emissive_color = vec3(1.0, 0.72, 0.44);
uniform float emissive_intensity = 1.0;
#endif
#ifdef LUM_DECAL
uniform sampler2D alpha_map : filter_nearest, repeat_enable;
#endif
#ifdef LUM_VARIATION
uniform vec2 lm_units = vec2(4.0);
uniform float lm_var_seed = 3.17;
#endif
#ifdef LUM_BOUNCE
uniform float lm_bounce = 1.0;
#endif
#ifdef LUM_LIFT
uniform float lift = 0.0006;
#endif

#ifdef LUM_VARIATION
float lm_vhash(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}
float lm_vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(lm_vhash(i), lm_vhash(i + vec2(1.0, 0.0)), u.x), mix(lm_vhash(i + vec2(0.0, 1.0)), lm_vhash(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec2 lm_vapply(vec2 d, float r, float fl) {
	d.x = fl > 0.5 ? -d.x : d.x;
	return r < 0.5 ? d : r < 1.5 ? vec2(-d.y, d.x) : r < 2.5 ? -d : vec2(d.y, -d.x);
}
// TileMap.js VARIATION_GLSL: returns the varied uv, `a` the 2×2 frame (columns) it applies
vec2 lm_varied_uv(vec2 uv, out vec4 a) {
	vec2 w = vec2(uv.x * lm_units.x, -uv.y * lm_units.y);
	vec2 pw = (floor(w * 16.0) + 0.5) / 16.0;
	vec2 o = vec2(lm_vnoise(pw * 1.35 + lm_var_seed), lm_vnoise(pw * 1.35 - lm_var_seed + 41.3)) - 0.5;
	o += (vec2(lm_vnoise(pw * 4.1 + 7.7), lm_vnoise(pw * 4.1 - 3.1)) - 0.5) * 0.35;
	vec2 cell = floor(pw + o * 0.95);
	float h = lm_vhash(cell + vec2(lm_var_seed * 0.37, 11.7));
	float r = floor(h * 4.0);
	float fl = step(0.5, fract(h * 7.31));
	vec2 c = cell + 0.5;
	vec2 w2 = c + lm_vapply(w - c, r, fl);
	vec2 eu = lm_vapply(vec2(1.0, 0.0), r, fl);
	vec2 ev = lm_vapply(vec2(0.0, -1.0), r, fl);
	a = vec4(eu.x, -eu.y, ev.x, -ev.y);
	return vec2(w2.x / lm_units.x, -w2.y / lm_units.y);
}
vec2 lm_mul(vec4 a, vec2 v) { return vec2(a.x * v.x + a.z * v.y, a.y * v.x + a.w * v.y); }
vec2 lm_mul_t(vec4 a, vec2 v) { return vec2(a.x * v.x + a.y * v.y, a.z * v.x + a.w * v.y); }
#endif

varying vec3 v_geom_world_normal;

void vertex() {
#ifdef LUM_WIND
	mat3 m3 = mat3(MODEL_MATRIX[0].xyz, MODEL_MATRIX[1].xyz, MODEL_MATRIX[2].xyz);
	float s2 = max(dot(m3[0], m3[0]), 1e-6);
	vec3 transformed = VERTEX;
#ifdef LUM_BILLBOARD
	{
		// colour pass: the camera yaw; shadow pass (the "camera" is the sun): the sun azimuth —
		// both are the yaw of the current view's back axis, as in props/Wind.js
		vec3 cam_back = INV_VIEW_MATRIX[2].xyz;
		bool shadow_pass = abs(dot(normalize(cam_back), normalize(lum_sun_dir))) > 0.9995;
		vec2 dir = normalize(cam_back.xz + vec2(1e-4, 0.0));
		float bb_yaw = atan(dir.x, dir.y);
		float bb_tilt = shadow_pass ? 0.15 : 0.42;
		vec3 center = CUSTOM1.xyz;
		vec3 off = VERTEX - center;
		vec3 to_cam = vec3(sin(bb_yaw), 0.0, cos(bb_yaw));
		vec3 right = vec3(cos(bb_yaw), 0.0, -sin(bb_yaw));
		vec3 up = normalize(vec3(0.0, 1.0, 0.0) - to_cam * bb_tilt);
		vec3 bb_world = (right * off.x + up * off.y + to_cam * off.z) * sqrt(s2);
		transformed = center + (bb_world * m3) / s2;
	}
#endif
	vec3 origin = MODEL_MATRIX[3].xyz;
	float wlen = length(lum_wind);
	vec2 wdir = wlen > 1e-4 ? lum_wind / wlen : vec2(1.0, 0.0);
	float sway_w = CUSTOM0.x;
	float ph = CUSTOM0.y + origin.x * 0.23 + origin.z * 0.17;
	float t = lum_time;
	float gust = 0.55 + 0.45 * sin(t * 0.43 - dot(origin.xz, wdir) * 0.09);
	float sway = sin(t * 1.21 + ph) * 0.62 + sin(t * 2.37 + ph * 1.73) * 0.38;
	float amp = sway_w * lum_wind_strength * (0.35 + 0.65 * min(wlen, 2.0));
	vec3 disp = vec3(0.0);
	disp.xz = wdir * (sway * 0.075 + gust * 0.06) * amp;
	float flutter = sin(t * 4.3 + dot(VERTEX, vec3(2.9, 2.1, 1.7)) + ph * 2.0) * 0.022 * amp;
	disp.xz += vec2(-wdir.y, wdir.x) * flutter;
	disp.y = flutter * 0.7 - sway * sway * 0.012 * amp;
	VERTEX = transformed + (disp * m3) / s2;
#endif
	v_geom_world_normal = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
#ifdef LUM_LIFT
	vec4 vp = MODELVIEW_MATRIX * vec4(VERTEX, 1.0);
	vp.xyz *= max(0.0, 1.0 - lift);
	VERTEX = vp.xyz;
	NORMAL = normalize((MODELVIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);
#endif
}

void fragment() {
	vec2 uv = UV * map_transform.xy + map_transform.zw;
	vec4 tex;
#ifdef LUM_VARIATION
	vec4 lm_a;
	vec2 lm_uv = lm_varied_uv(uv, lm_a);
	vec2 lm_gx = lm_mul(lm_a, dFdx(uv));
	vec2 lm_gy = lm_mul(lm_a, dFdy(uv));
	tex = lum_in(textureGrad(map, lm_uv, lm_gx, lm_gy));
#else
	tex = lum_in(texture(map, uv));
#endif
	vec4 diffuse = base_color * tex;
#ifdef LUM_VERTEX_COLOR
	diffuse.rgb *= COLOR.rgb;
#endif
#ifdef LUM_DECAL
	vec4 mask = texture(alpha_map, UV2);
	diffuse.a *= mask.g;
	diffuse.rgb *= mask.r * (255.0 / 170.0);
#endif
	if (alpha_scissor > 0.0 && diffuse.a < alpha_scissor) {
		discard;
	}
	ALBEDO = lum_out(diffuse.rgb);

	float face = FRONT_FACING ? 1.0 : -1.0;
	vec3 n = normalize(NORMAL);
#ifdef LUM_FOLIAGE
	// authored (spherical canopy) normals: undo the back-face flip
	if (!FRONT_FACING) n = -n;
	face = 1.0;
#endif
#ifdef LUM_NORMAL
	mat3 tbn = lum_tangent_frame(VERTEX, n, uv, face);
#ifdef LUM_VARIATION
	vec3 map_n = textureGrad(normal_map, lm_uv, lm_gx, lm_gy).xyz * 2.0 - 1.0;
	map_n.xy = lm_mul_t(lm_a, map_n.xy);
#else
	vec3 map_n = texture(normal_map, uv).xyz * 2.0 - 1.0;
#endif
	map_n.xy *= normal_scale;
	if (lum_debug < 4.5 || lum_debug > 5.5) {
		n = normalize(tbn * map_n);
	}
#endif
	NORMAL = n;

	vec3 wn = normalize((INV_VIEW_MATRIX * vec4(n, 0.0)).xyz);
	vec3 emission = vec3(0.0);
#ifdef LUM_EMISSIVE
	emission += emissive_color * emissive_intensity * lum_in(texture(emissive_map, uv)).rgb;
#endif
	EMISSION = lum_out(emission);
	if (lum_debug > 0.5 && lum_debug < 4.5) {
		// debug: 1 = albedo, 2 = vertex colour, 3 = world normal
		EMISSION = lum_debug < 1.5 ? ALBEDO : lum_debug < 2.5 ? COLOR.rgb : lum_debug < 3.5 ? wn * 0.5 + 0.5 : lum_hemi(wn);
		ALBEDO = vec3(0.0);
	}
	SPECULAR = 0.0;
	ROUGHNESS = 1.0;
	METALLIC = 0.0;
	FOG = lum_fog(VERTEX);
}

void light() {
	float ndl = dot(NORMAL, LIGHT);
#ifdef LUM_FOLIAGE
	ndl = clamp((ndl + wrap_light) / (1.0 + wrap_light), 0.0, 1.0);
#else
	ndl = clamp(ndl, 0.0, 1.0);
#endif
	DIFFUSE_LIGHT += LIGHT_COLOR * ATTENUATION * ndl * lum_light_scale;
	if (LIGHT_IS_DIRECTIONAL) {
		// the ambient (hemisphere fill, the wall ground-bounce): added once, on the sun's pass
		vec3 irr = lum_hemi(normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz));
#ifdef LUM_BOUNCE
		float side = clamp(1.0 - abs(v_geom_world_normal.y), 0.0, 1.0);
		irr += lum_sun_color * (max(lum_sun_dir.y, 0.0) * 0.44 * lm_bounce * side);
#endif
		DIFFUSE_LIGHT += irr * LUM_INV_PI;
	}
}
