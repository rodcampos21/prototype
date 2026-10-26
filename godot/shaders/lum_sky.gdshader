// The sky dome (src/engine/lighting/Sky.js): a three-colour gradient, HDR sun halo and pixel sun
// disc, a pixel moon with craters and phase, twinkling pixel stars at night, sun-tinted pixel
// clouds and a "sea of clouds" haze below the horizon. Driven by lighting.gd every frame.
shader_type sky;

uniform vec3 top_color = vec3(0.04, 0.2, 0.75);
uniform vec3 horizon_color = vec3(0.55, 0.75, 0.88);
uniform vec3 bottom_color = vec3(0.27, 0.45, 0.63);
uniform vec3 sun_dir = vec3(0.3, 0.6, -0.5);
uniform vec3 moon_dir = vec3(-0.3, 0.6, -0.5);
uniform vec3 sun_color = vec3(1.0, 0.9, 0.75);
uniform float night = 0.0;
uniform float glow = 1.0;
uniform float clouds = 0.45;
uniform float lower_clouds = 0.25;
uniform float sky_time = 0.0;
uniform float star_density = 1100.0;
uniform float sun_size = 0.032;
uniform float moon_size = 0.026;
uniform float sun_intensity = 9.0;
uniform float cloud_pixel = 380.0;
uniform vec2 cloud_wind = vec2(0.012, 0.004);


float hash12(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm4(vec2 p) {
	float s = 0.0;
	float a = 0.5;
	for (int i = 0; i < 4; i++) {
		s += a * vnoise(p);
		p = p * 2.03 + vec2(17.13, 3.71);
		a *= 0.5;
	}
	return s / 0.9375;
}
vec3 sky_gradient(float y) {
	if (y >= 0.0) {
		float t = smoothstep(0.0, 1.0, pow(clamp(y, 0.0, 1.0), 0.5));
		return mix(horizon_color, top_color, t);
	}
	float t = clamp(-y / 0.9, 0.0, 1.0);
	return mix(horizon_color, bottom_color, smoothstep(0.0, 1.0, pow(t, 0.8)));
}
vec2 disc_coord(vec3 d, vec3 c, float r) {
	vec3 t1 = cross(c, vec3(0.0, 1.0, 0.0));
	t1 = length(t1) < 1e-4 ? vec3(1.0, 0.0, 0.0) : normalize(t1);
	vec3 t2 = cross(t1, c);
	return vec2(dot(d, t1), dot(d, t2)) / r;
}
vec3 quant_dir(float lat, float lon, float P) {
	float lat_q = (floor(lat * P) + 0.5) / P;
	float cl = max(cos(lat_q), 0.05);
	float lon_q = (floor(lon * P * cl) + 0.5) / (P * cl);
	float c = cos(lat_q);
	return vec3(c * cos(lon_q), sin(lat_q), c * sin(lon_q));
}
vec3 stars(float lat, float lon) {
	float N = star_density;
	float row = floor(lat * N);
	float row_lat = (row + 0.5) / N;
	float cells = max(1.0, floor(TAU * N * cos(row_lat)));
	vec2 cell = vec2(floor((lon / TAU + 0.5) * cells), row);
	float h = hash12(cell);
	float star = step(0.9962, h);
	float tw = 0.55 + 0.45 * sin(sky_time * (1.2 + 3.5 * fract(h * 37.0)) + h * 91.0);
	float mag = fract(h * 113.0);
	float b = star * tw * (0.3 + 1.6 * mag * mag * mag);
	vec3 tint = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.88, 0.72), step(0.6, fract(h * 7.0)));
	vec3 col = tint * b;
	float N2 = N / 5.0;
	float row2 = floor(lat * N2);
	float row_lat2 = (row2 + 0.5) / N2;
	float cells2 = max(1.0, floor(TAU * N2 * cos(row_lat2)));
	float u2 = (lon / TAU + 0.5) * cells2;
	float v2 = lat * N2;
	float h2 = hash12(vec2(floor(u2), row2) + 71.3);
	vec2 f = floor(vec2(fract(u2), fract(v2)) * 5.0);
	float m = abs(f.x - 2.0) + abs(f.y - 2.0);
	float centre = step(m, 0.5);
	float arm = step(m, 1.5) - centre;
	float tw2 = 0.6 + 0.4 * sin(sky_time * (0.7 + 1.8 * h2) + h2 * 50.0);
	float big = step(0.991, h2) * (centre * 2.2 + arm * 0.6) * tw2;
	vec3 tint2 = mix(vec3(0.8, 0.88, 1.0), vec3(1.0, 0.92, 0.78), step(0.5, fract(h2 * 13.0)));
	col += tint2 * big;
	return col;
}

void sky() {
	vec3 d = normalize(EYEDIR);
	float y = d.y;
	vec3 col = sky_gradient(y);
	vec3 sd = normalize(sun_dir);
	vec3 md = normalize(moon_dir);
	float lat = asin(clamp(y, -1.0, 1.0));
	float lon = atan(d.z, d.x);
	float cs = dot(d, sd);
	float cs0 = max(cs, 0.0);
	float sun_up = smoothstep(-0.3, 0.02, sd.y);
	float halo = pow(cs0, 8.0) * 0.1 + pow(cs0, 42.0) * 0.28 + pow(cs0, 600.0) * 1.1;
	vec2 dh = d.xz / max(length(d.xz), 1e-4);
	vec2 shz = sd.xz / max(length(sd.xz), 1e-4);
	float az = dot(dh, shz) * 0.5 + 0.5;
	float low_sun = 1.0 - smoothstep(0.02, 0.6, sd.y);
	float band = exp(-abs(y) * 8.0) * pow(az, 3.0) * low_sun;
	vec3 glow_col = sun_color * glow;
	col += glow_col * (halo + band * 0.32) * sun_up;
	vec3 qd = quant_dir(lat, lon, cloud_pixel);
	if (y > 0.0) {
		float star_mask = night * night * smoothstep(0.03, 0.35, y);
		if (star_mask > 0.002) col += stars(lat, lon) * star_mask;
		float cm = dot(d, md);
		float moon_vis = smoothstep(0.25, 0.8, night) * smoothstep(-0.02, 0.08, md.y);
		if (moon_vis > 0.001 && cm > 0.0) {
			vec2 mp = disc_coord(d, md, moon_size);
			vec2 mcell = floor(mp * 7.0);
			vec2 mq = (mcell + 0.5) / 7.0;
			float inside = step(length(mq), 1.0);
			float mottle = hash12(mcell + 13.0);
			float crater = step(0.78, mottle) * 0.22 + step(0.93, mottle) * 0.12;
			float phase = smoothstep(0.35, 0.95, length(mq - vec2(-0.55, 0.25)));
			vec3 moon_col = vec3(0.84, 0.9, 1.0) * (0.95 - crater * 1.3) * mix(0.22, 1.0, phase);
			col = mix(col, moon_col, inside * moon_vis);
			float cm0 = max(cm, 0.0);
			col += vec3(0.45, 0.58, 1.0) * (pow(cm0, 2500.0) * 0.3 + pow(cm0, 200.0) * 0.08 + pow(cm0, 12.0) * 0.025) * moon_vis;
		}
		if (cs > 0.0) {
			vec2 sp = disc_coord(d, sd, sun_size);
			vec2 sq = (floor(sp * 6.0) + 0.5) / 6.0;
			float r = length(sq);
			float s_in = step(r, 1.0);
			float rim = step(0.8, r);
			col += sun_color * s_in * mix(1.0, 0.55, rim) * sun_intensity * sun_up * smoothstep(-0.005, 0.01, y);
		}
		if (clouds > 0.001) {
			vec2 cp = qd.xz / (max(qd.y, 0.0) + 0.15) * 2.4 + cloud_wind * sky_time;
			float n = fbm4(cp * 1.2);
			float c = smoothstep(1.0 - clouds - 0.08, 1.0 - clouds + 0.2, n);
			float n2 = fbm4((cp + shz * 0.16) * 1.2);
			float lit = clamp(0.55 + (n - n2) * 5.0, 0.0, 1.0);
			c = floor(c * 3.0 + 0.5) / 3.0;
			lit = floor(lit * 3.0 + 0.5) / 3.0;
			float moon_lit = pow(max(dot(d, md), 0.0), 6.0) * smoothstep(0.3, 0.9, night);
			vec3 shade = mix(mix(top_color, horizon_color, 0.5) * 0.95, top_color * 0.8, night);
			vec3 lit_col = mix(horizon_color * 1.12, mix(top_color, horizon_color, 0.55) + vec3(0.05, 0.07, 0.12) * moon_lit, night)
				+ glow_col * (0.12 + pow(cs0, 4.0) * 0.8) * sun_up;
			vec3 cloud_col = mix(shade, lit_col, lit);
			float fade = smoothstep(0.0, 0.22, y);
			col = mix(col, cloud_col, c * fade * mix(0.9, 0.55, night));
		}
	} else if (lower_clouds > 0.001) {
		vec2 lp = qd.xz / (max(-qd.y, 0.0) + 0.07) * 0.6 + cloud_wind * sky_time * 0.6 + vec2(37.0, 11.0);
		float n = fbm4(lp);
		float c = smoothstep(0.42, 0.74, n);
		float n2 = fbm4(lp + shz * 0.12);
		float lit = clamp(0.5 + (n - n2) * 5.0, 0.0, 1.0);
		lit = floor(lit * 3.0 + 0.5) / 3.0;
		c = floor(c * 3.0 + 0.5) / 3.0;
		vec3 top_col = horizon_color * 1.08 + glow_col * (0.06 + band * 0.25) * sun_up;
		vec3 shade_col = mix(bottom_color, horizon_color, 0.5);
		vec3 cc = mix(shade_col, top_col, 0.3 + lit * 0.7);
		float dist_fade = smoothstep(0.0, 0.16, -y);
		col = mix(col, cc, c * lower_clouds * dist_fade);
	}
	COLOR = max(col, vec3(0.0));
}
