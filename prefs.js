'use strict';

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class GamutTamerPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'Gamut Tamer',
            icon_name: 'preferences-color-symbolic',
        });
        window.add(page);

        // --- Main settings group ---
        const group = new Adw.PreferencesGroup({
            title: 'Correction Settings',
            description: 'DCI-P3 → sRGB gamut correction',
        });
        page.add(group);

        // Monitor selector
        const monitorRow = new Adw.ComboRow({
            title: 'Target Monitor',
            subtitle: 'Apply correction only to this monitor',
        });
        const connectors = [''];
        const labels = ['All monitors'];
        const display = Gdk.Display.get_default();
        const monitors = display.get_monitors();
        for (let i = 0; i < monitors.get_n_items(); i++) {
            const monitor = monitors.get_item(i);
            const conn = monitor.get_connector();
            const model = monitor.get_model() || '';
            connectors.push(conn);
            labels.push(model ? `${conn} (${model})` : conn);
        }
        const stringList = new Gtk.StringList();
        for (const label of labels)
            stringList.append(label);
        monitorRow.set_model(stringList);
        const currentConnector = settings.get_string('monitor-connector');
        const currentIdx = connectors.indexOf(currentConnector);
        monitorRow.set_selected(currentIdx >= 0 ? currentIdx : 0);
        monitorRow.connect('notify::selected', () => {
            settings.set_string('monitor-connector', connectors[monitorRow.get_selected()]);
        });
        settings.connect('changed::monitor-connector', () => {
            const idx = connectors.indexOf(settings.get_string('monitor-connector'));
            monitorRow.set_selected(idx >= 0 ? idx : 0);
        });
        group.add(monitorRow);

        // Enabled switch
        const enabledRow = new Adw.SwitchRow({
            title: 'Enable Correction',
            subtitle: 'Toggle the gamut correction shader on/off',
        });
        settings.bind('enabled', enabledRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(enabledRow);

        // Boost slider
        const boostRow = new Adw.ActionRow({
            title: 'Boost',
            subtitle: 'Amplifies deviation from identity matrix (1.0 = raw, >1 = stronger)',
        });
        const boostLabel = new Gtk.Label({
            label: settings.get_double('boost').toFixed(2),
            valign: Gtk.Align.CENTER,
            css_classes: ['dim-label'],
        });
        const boostScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 0.0,
                upper: 3.0,
                step_increment: 0.01,
                page_increment: 0.1,
            }),
            digits: 2,
            draw_value: false,
            hexpand: true,
            valign: Gtk.Align.CENTER,
        });
        boostScale.set_size_request(200, -1);
        boostScale.set_value(settings.get_double('boost'));
        boostScale.connect('value-changed', () => {
            const val = boostScale.get_value();
            settings.set_double('boost', val);
            boostLabel.set_label(val.toFixed(2));
        });
        settings.connect('changed::boost', () => {
            const val = settings.get_double('boost');
            boostScale.set_value(val);
            boostLabel.set_label(val.toFixed(2));
        });
        boostRow.add_suffix(boostScale);
        boostRow.add_suffix(boostLabel);
        group.add(boostRow);

        // Strength slider
        const strengthRow = new Adw.ActionRow({
            title: 'Strength',
            subtitle: 'Mix between corrected and original (1.0 = full correction)',
        });
        const strengthLabel = new Gtk.Label({
            label: settings.get_double('strength').toFixed(2),
            valign: Gtk.Align.CENTER,
            css_classes: ['dim-label'],
        });
        const strengthScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 0.0,
                upper: 1.0,
                step_increment: 0.01,
                page_increment: 0.1,
            }),
            digits: 2,
            draw_value: false,
            hexpand: true,
            valign: Gtk.Align.CENTER,
        });
        strengthScale.set_size_request(200, -1);
        strengthScale.set_value(settings.get_double('strength'));
        strengthScale.connect('value-changed', () => {
            const val = strengthScale.get_value();
            settings.set_double('strength', val);
            strengthLabel.set_label(val.toFixed(2));
        });
        settings.connect('changed::strength', () => {
            const val = settings.get_double('strength');
            strengthScale.set_value(val);
            strengthLabel.set_label(val.toFixed(2));
        });
        strengthRow.add_suffix(strengthScale);
        strengthRow.add_suffix(strengthLabel);
        group.add(strengthRow);

        // --- Reset group ---
        const resetGroup = new Adw.PreferencesGroup();
        page.add(resetGroup);

        const resetRow = new Adw.ActionRow({
            title: 'Reset to Defaults',
            subtitle: 'Restore boost and strength to default values',
        });
        const resetButton = new Gtk.Button({
            label: 'Reset',
            valign: Gtk.Align.CENTER,
            css_classes: ['destructive-action'],
        });
        resetButton.connect('clicked', () => {
            settings.reset('monitor-connector');
            settings.reset('enabled');
            settings.reset('boost');
            settings.reset('strength');
        });
        resetRow.add_suffix(resetButton);
        resetRow.set_activatable_widget(resetButton);
        resetGroup.add(resetRow);
    }
}
