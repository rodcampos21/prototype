// Tone mapping + display-space colour grade (src/engine/render/PostFX.js OutputPass + GradeShader).
// A full-screen ColorRect above the 3D view. The project renders the 2D canvas in HDR
// (rendering/viewport/hdr_2d) with Godot's own tonemapper set to Linear, so the screen texture
// still holds the scene in linear HDR — with Godot's glow (the bloom) and depth of field already
// in it. This shader then does exactly what the three.js engine does after its bloom:
// ACES filmic (three's fit, exposure / 0.6) → sRGB → sharpen + chromatic aberration → exposure →
// white balance → contrast → saturation → split toning → vignette → film grain → dither,
// and hands the result back in linear (the canvas converts to sRGB on output).
shader_type canvas_item;
render_mode unshaded;

uniform sampler2D screen_tex : hint_screen_texture, filter_linear, repeat_disable;
uniform float tone_exposure = 1.0;
uniform float grade_exposure = 1.03;
uniform float contrast = 1.04;
uniform float saturation = 1.3;
uniform float temperature = 0.04;
uniform float tint = 0.0;
uniform vec3 shadows_tint = vec3(-0.04, 0.05, 0.15);
uniform vec3 highlights_tint = vec3(0.06, 0.03, -0.02);
uniform float vignette = 0.55;
uniform float vignette_softness = 0.55;
uniform float vignette_roundness = 0.65;
uniform vec3 vignette_color = vec3(0.05, 0.025, 0.04);
uniform float grain = 0.03;
uniform float grain_size = 1.0;
uniform float grain_seed = 0.0;
uniform float ca = 0.0015;
uniform float sharpen = 0.15;
uniform float dither = 1.0;
uniform bool enabled = true;
// The Compatibility renderer has no HDR 2D canvas: there Godot's own ACES (matched to three's in
// lighting.gd) tone-maps the scene and the screen texture already holds display (sRGB) values.
uniform bool input_display = false;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hash12(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

vec3 rrt_odt_fit(vec3 v) {
	vec3 a = v * (v + 0.0245786) - 0.000090537;
	vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
	return a / b;
}
// three.js ACESFilmicToneMapping (r186)
vec3 aces(vec3 color) {
	const mat3 IN = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
	const mat3 OUT = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
	color *= tone_exposure / 0.6;
	color = IN * color;
	color = rrt_odt_fit(color);
	color = OUT * color;
	return clamp(color, 0.0, 1.0);
}
vec3 to_srgb(vec3 c) {
	return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
vec3 to_linear(vec3 c) {
	return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}
vec3 display(vec2 uv) {
	vec3 c = max(texture(screen_tex, uv).rgb, vec3(0.0));
	return input_display ? c : to_srgb(aces(c));
}
vec3 output_color(vec3 display_col) {
	return input_display ? display_col : to_linear(display_col);
}

void fragment() {
	vec2 uv = SCREEN_UV;
	if (!enabled) {
		COLOR = vec4(output_color(display(uv)), 1.0);
	} else {
		vec2 texel = SCREEN_PIXEL_SIZE;
		float aspect = texel.y / texel.x;
		vec2 d = uv - 0.5;
		vec2 dv = d * vec2(mix(1.0, aspect, vignette_roundness), 1.0);
		float corner_len = length(vec2(0.5 * mix(1.0, aspect, vignette_roundness), 0.5));
		float r = length(dv) / corner_len;
		vec3 c = display(uv);
		vec3 nb = display(uv + vec2(texel.x, 0.0)) + display(uv - vec2(texel.x, 0.0))
			+ display(uv + vec2(0.0, texel.y)) + display(uv - vec2(0.0, texel.y));
		vec3 detail = clamp((c - nb * 0.25) * sharpen, vec3(-0.08), vec3(0.08));
		vec3 col = c;
		if (ca > 0.0) {
			vec2 off = d * (ca * 2.0 * r * r);
			col.r = display(uv - off).r;
			col.b = display(uv + off).b;
		}
		col += detail;
		col = max(col, vec3(0.0));
		col *= grade_exposure;
		vec3 wb = vec3(1.0 + 0.30 * temperature + 0.10 * tint, 1.0 + 0.02 * temperature - 0.25 * tint, 1.0 - 0.34 * temperature + 0.10 * tint);
		wb /= luma(wb);
		col *= wb;
		col = (col - 0.5) * contrast + 0.5;
		col = max(col, vec3(0.0));
		float l = luma(col);
		col = max(mix(vec3(l), col, saturation), vec3(0.0));
		l = clamp(luma(col), 0.0, 1.0);
		float ws = (1.0 - l) * (1.0 - l);
		float wh = l * l;
		col += shadows_tint * ws + highlights_tint * wh;
		float inner = mix(0.95, 0.05, clamp(vignette_softness, 0.0, 1.0));
		float v = smoothstep(inner, 1.25, r);
		v = v * v * (3.0 - 2.0 * v);
		col = mix(col, vignette_color * col, clamp(vignette * v * 1.35, 0.0, 1.0));
		vec2 gp = floor(FRAGCOORD.xy / grain_size);
		float g = hash12(gp + grain_seed * vec2(113.7, 71.3)) + hash12(gp * 1.37 + grain_seed * vec2(37.1, 91.9)) - 1.0;
		float lg = clamp(luma(col), 0.0, 1.0);
		float gw = 0.35 + 2.6 * lg * (1.0 - lg);
		col += g * grain * gw;
		col += (bayer8(FRAGCOORD.xy) - 0.5) * (dither / 255.0);
		COLOR = vec4(output_color(clamp(col, 0.0, 1.0)), 1.0);
	}
}
