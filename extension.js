'use strict';

import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Slider from 'resource:///org/gnome/shell/ui/slider.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

// DCI-P3 BOE NV16N47 → sRGB correction matrix (row-major):
//   [+0.802682  +0.176662  +0.015146]
//   [+0.038366  +0.957570  +0.005615]
//   [+0.013611  +0.073916  +0.915091]
//
// GLSL mat3 is column-major, so we transpose when constructing.

const SHADER_SOURCE = `
uniform sampler2D tex;
uniform float BOOST;
uniform float STRENGTH;

vec3 srgb_to_linear(vec3 c) {
    vec3 lo = c / 12.92;
    vec3 hi = pow((c + 0.055) / 1.055, vec3(2.4));
    return mix(lo, hi, step(vec3(0.04045), c));
}

vec3 linear_to_srgb(vec3 c) {
    vec3 lo = c * 12.92;
    vec3 hi = 1.055 * pow(c, vec3(1.0/2.4)) - 0.055;
    return mix(lo, hi, step(vec3(0.0031308), c));
}

void main() {
    vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);

    mat3 correction = mat3(
        0.802682, 0.038366, 0.013611,
        0.176662, 0.957570, 0.073916,
        0.015146, 0.005615, 0.915091
    );

    mat3 identity = mat3(1.0);
    mat3 boosted = identity + BOOST * (correction - identity);

    vec3 lin = srgb_to_linear(c.rgb);
    vec3 corrected = boosted * lin;
    vec3 result = linear_to_srgb(clamp(corrected, 0.0, 1.0));

    cogl_color_out = vec4(mix(c.rgb, result, STRENGTH), c.a);
}
`;

const GamutEffect = GObject.registerClass(
class GamutEffect extends Clutter.ShaderEffect {
    _init() {
        super._init({shader_type: Clutter.ShaderType.FRAGMENT_SHADER});
        this._source = SHADER_SOURCE;
        this.set_shader_source(this._source);
        this._boost = 1.4;
        this._strength = 1.0;
    }

    vfunc_get_static_shader_source() {
        return this._source;
    }

    vfunc_paint_target(...args) {
        this.set_uniform_value('tex', 0);
        this.set_uniform_value('BOOST', this._boost);
        this.set_uniform_value('STRENGTH', this._strength);
        super.vfunc_paint_target(...args);
    }
});

const GamutIndicator = GObject.registerClass(
class GamutIndicator extends PanelMenu.Button {
    _init(settings, openPrefs) {
        super._init(0.0, 'Gamut Tamer');
        this._settings = settings;
        this._openPrefs = openPrefs;

        this._icon = new St.Icon({
            icon_name: 'preferences-color-symbolic',
            style_class: 'system-status-icon',
        });
        this.add_child(this._icon);

        // Enabled toggle
        this._enabledItem = new PopupMenu.PopupSwitchMenuItem(
            'Correction active', this._settings.get_boolean('enabled'));
        this._enabledItem.connect('toggled', (_item, state) => {
            this._settings.set_boolean('enabled', state);
        });
        this.menu.addMenuItem(this._enabledItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Boost slider
        this._boostItem = this._createSliderRow(
            'Boost', 'boost', 0.0, 3.0);
        this.menu.addMenuItem(this._boostItem.label);
        this.menu.addMenuItem(this._boostItem.slider);

        // Strength slider
        this._strengthItem = this._createSliderRow(
            'Strength', 'strength', 0.0, 1.0);
        this.menu.addMenuItem(this._strengthItem.label);
        this.menu.addMenuItem(this._strengthItem.slider);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Open full preferences
        const prefsItem = new PopupMenu.PopupMenuItem('Preferences...');
        prefsItem.connect('activate', () => this._openPrefs());
        this.menu.addMenuItem(prefsItem);

        // Listen for external changes (from prefs window or CLI)
        this._settingIds = [];
        this._settingIds.push(this._settings.connect('changed::enabled', () => {
            this._enabledItem.setToggleState(this._settings.get_boolean('enabled'));
        }));
        this._settingIds.push(this._settings.connect('changed::boost', () => {
            const val = this._settings.get_double('boost');
            this._boostItem.slider._slider.value = val / 3.0;
            this._boostItem.label.label = `Boost: ${val.toFixed(2)}`;
        }));
        this._settingIds.push(this._settings.connect('changed::strength', () => {
            const val = this._settings.get_double('strength');
            this._strengthItem.slider._slider.value = val;
            this._strengthItem.label.label = `Strength: ${val.toFixed(2)}`;
        }));
    }

    _createSliderRow(name, key, min, max) {
        const value = this._settings.get_double(key);
        const range = max - min;

        const labelItem = new PopupMenu.PopupMenuItem(`${name}: ${value.toFixed(2)}`, {reactive: false});

        const sliderItem = new PopupMenu.PopupBaseMenuItem({activate: false});
        const slider = new Slider.Slider(0);
        slider.value = (value - min) / range;
        slider.connect('notify::value', () => {
            const val = min + slider.value * range;
            this._settings.set_double(key, val);
            labelItem.label.text = `${name}: ${val.toFixed(2)}`;
        });
        sliderItem._slider = slider;
        sliderItem.add_child(slider);

        return {label: labelItem, slider: sliderItem};
    }

    destroy() {
        for (const id of this._settingIds)
            this._settings?.disconnect(id);
        this._settingIds = [];
        super.destroy();
    }
});

export default class GamutTamerExtension extends Extension {
    _effect = null;
    _settings = null;
    _indicator = null;
    _signalIds = [];

    enable() {
        this._settings = this.getSettings();
        this._effect = new GamutEffect();

        this._effect._boost = this._settings.get_double('boost');
        this._effect._strength = this._settings.get_double('strength');

        if (this._settings.get_boolean('enabled'))
            global.stage.add_effect(this._effect);

        this._connectSetting('enabled', () => {
            if (this._settings.get_boolean('enabled'))
                global.stage.add_effect(this._effect);
            else
                global.stage.remove_effect(this._effect);
        });

        this._connectSetting('boost', () => {
            this._effect._boost = this._settings.get_double('boost');
            this._effect.queue_repaint();
        });

        this._connectSetting('strength', () => {
            this._effect._strength = this._settings.get_double('strength');
            this._effect.queue_repaint();
        });

        // Panel indicator
        this._indicator = new GamutIndicator(this._settings, () => this.openPreferences());
        Main.panel.addToStatusArea('gamut-tamer', this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;

        try {
            global.stage.remove_effect(this._effect);
        } catch (_) {
            // Effect may not be on the stage
        }
        this._effect = null;

        for (const id of this._signalIds)
            this._settings?.disconnect(id);
        this._signalIds = [];
        this._settings = null;
    }

    _connectSetting(key, callback) {
        const id = this._settings.connect(`changed::${key}`, callback);
        this._signalIds.push(id);
    }
}
