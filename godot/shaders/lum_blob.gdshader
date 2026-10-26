// Contact shadow ("blob") under a character's feet (Sprite3D.blob): a soft dark ellipse.
shader_type spatial;
render_mode unshaded, depth_draw_never, shadows_disabled, cull_disabled, blend_mix;

#include "res://shaders/lum_common.gdshaderinc"

uniform float opacity = 0.5;
uniform vec3 color = vec3(0.047, 0.031, 0.071);

void fragment() {
	float r = length(UV * 2.0 - 1.0);
	float a = pow(clamp(1.0 - r, 0.0, 1.0), 1.4) * opacity;
	vec4 f = lum_fog(VERTEX);
	ALBEDO = lum_out(color);
	ALPHA = a * (1.0 - f.a);
}
