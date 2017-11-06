/**
 * color_wave_long_hue.js
 *
 * sine waves generate pulsating colors
 *
 * LEDstrip plugin
 *
 * Copyright (c) 2013 Dougal Campbell
 *
 * Distributed under the MIT License
 */


/*

The envisioned architecture for the real Arduino code:

Everything is a ColorStop.
It is hsla time gradient with some position.

There are superstructures built of such things. They may be able to be moved together, or have some speed.
However, there should still be an ability to modify the parameters (positions, for example) of each ColorStop individually;

Blending fuction for two ColorStops has to be implemented. It accepts position and time, and returns hsla;



*/
 function hslToRgb(hsl)
 {
	 var h = hsl[0], s = hsl[1], l = hsl[2];
     var r, g, b;

     if (s == 0)
     {
         r = g = b = l; // achromatic
     }
     else
     {
         function hue2rgb(p, q, t)
         {
             if (t < 0) t += 1;
             if (t > 1) t -= 1;
             if (t < 1 / 6) return p + (q - p) * 6 * t;
             if (t < 1 / 2) return q;
             if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
             return p;
         }

         var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
         var p = 2 * l - q;

         r = hue2rgb(p, q, h + 1 / 3);
         g = hue2rgb(p, q, h);
         b = hue2rgb(p, q, h - 1 / 3);
     }

     return [
          Math.max(0, Math.min(Math.round(r * 256), 255))
         ,Math.max(0, Math.min(Math.round(g * 256), 255))
         ,Math.max(0, Math.min(Math.round(b * 256), 255))
     ];
 }

 function mean(a1, a2, proportion){
	 a = [];
	 for (var j = 0; j < a1.length; j++) {
		 a[j] = a2[j] * proportion + a1[j] * (1 - proportion);
	 }

	return a;
}

function add(a1, a2){
	a = [];
	for (var j = 0; j < a1.length; j++) {
		a[j] = a2[j] + a1[j];
	}
   return a;
}

function multiply_rgb(a1, a2){
	a = [];
	for (var j = 0; j < a1.length; j++) {
		a[j] = Math.floor(a2[j]*a1[j]/255);
	}
   return a;
}

function screen_rgb(a1, a2){
	a = [];
	for (var j = 0; j < a1.length; j++) {
		a[j] = Math.floor((1- (1- a2[j]/255)*(1 - a1[j]/255))*255);
	}
   return a;
}




function limit_rgb(a){
	for (var i = 0; i < a.length; i++){
		a[i] = Math.max(Math.min(Math.round(a[i]), 255), 0);
	}
	return a;
}

function mix_colors(hsl1, hsl2, proportion){
	return mean(hsl1, hsl2, proportion);
}

function time_gradient (hsl_colors, period, offset=0) {
	this.period = period;
	this.hsl_colors = hsl_colors;
	var phase_period = period/hsl_colors.length;

	function get_color (t){
		t0 = t % period;
		phase = Math.floor(t0 / phase_period);
		proportion = (t0 - phase * phase_period) / phase_period;
		if (phase < hsl_colors.length - 1){
			return mix_colors (hsl_colors[phase], hsl_colors[phase+1], proportion);
		} else {
			return mix_colors (hsl_colors[hsl_colors.length - 1 ], hsl_colors[0], proportion);
		}
	}
	return get_color
}


function ColorWaveLongHue (ledstrip) {
	this.ledstrip = ledstrip;
	this.ledstrip.clear();
	this.direction = 1;
	// tick counter
	this.t = 0;

	return this;
}

function Gradientish (offset, speed){
	this.offset = offset;
	this.speed = speed;
}

Gradientish.prototype.init_with_colors = function (hsl_colors, positiones){
	this.hsl_time_gradients = [];
	this.positiones = positiones;
	for (var i = 0; i < hsl_colors.length; i++) {
		this.hsl_time_gradients.append(function(){return hsl_colors[i]});
	}
}

Gradientish.prototype.init_with_gradients = function (hsl_time_gradients, positiones){
	this.positiones = positiones;
	this.hsl_time_gradients = hsl_time_gradients;
}

Gradientish.draw()

ColorWaveLongHue.prototype.init = function() {
	red = [0, 1, 0.6];
	orange = [40/360, 1, 0.6];
	green = [100/360, 1, 0.6];

	this.tg1 = time_gradient([red, orange], 3);
	this.tg2 = time_gradient([green, orange], 5);
	this.tg3 = time_gradient([green, orange, red, orange], 10);
}

function simple_rgb_blender(simple_blender){
	function blender(rgb1, rgb2){
		rgb = []
		for (var i = 0; i < 3; i++){
			rgb.push(simple_blender(rgb1[i]/255, rgb2[i]/255)*255);
		}
		return limit_rgb(rgb);
	}
	return blender;
}

ColorWaveLongHue.prototype.add_to_buffer = function(i, rgb, blend_rgb=function(a, b){return b;}) {
	if (this.ledstrip.buffer[i] === undefined){
		this.ledstrip.buffer[i] = rgb;
	} else {
		this.ledstrip.buffer[i] = blend_rgb(this.ledstrip.buffer[i], rgb);
	}
}

/**
 * Map an integer so that 0..ledstrip.len => 0..2PI
 */
ColorWaveLongHue.prototype.map2PI = function(tick) {
	return Math.PI * 2 * tick / this.ledstrip.size();
}

/**
 * scale values [-1.0, 1.0] to [0, 255]
 */
ColorWaveLongHue.prototype.scale = function (val) {
	val += 1; 		// bump up to a zero base: [0, 2]
	val *= 255/2; 	// scale up

	return Math.floor(val); // return int
}

ColorWaveLongHue.prototype.wave = function (tick) {
	var i, j, hsin, size = this.ledstrip.size(), offset;

	// if (Math.random() > .999)  this.direction *= -1; // All skate, reverse direction!

	for (i = 0; i < size; i++) {
		/**
		 * Generate some RGBs, range [-1, +1]
		 * If you think about the LED strip as a unit circle, with
		 * circumference 2 PI, then angle between the LEDs is simply
		 *   2 PI / count
		 * And the angle for any particular LED will be
		 *   (2 PI / count) * position
		 * That's what the map2PI() method does.
		 */

		j = i/ this.ledstrip.size() * this.direction  + tick/300.;		// calculate angle
		hsin = (Math.sin(j)+1)/2;
		rgb = hslToRgb([hsin, 1, 0.6]);
		this.ledstrip.buffer[i] = rgb;
	}
}

ColorWaveLongHue.prototype.animate = function() {
	animation = requestAnimationFrame(this.animate.bind(this)); // preserve our context

	this.ledstrip.clear();

	var real_time = this.t/60;

	this.wave(this.t); // calculate waves and increment tick


	for (var i = 0; i < 5; i++){
		multiply = simple_rgb_blender(function(a, b){return a*b;});
		this.add_to_buffer(i, hslToRgb(this.tg1(real_time)), blender=multiply);
		this.add_to_buffer(i+5,  hslToRgb(this.tg2(real_time)));
		this.add_to_buffer(i+10,  hslToRgb(this.tg3(real_time)));
	}

	this.t++;
	this.ledstrip.send(); // update strip
}
