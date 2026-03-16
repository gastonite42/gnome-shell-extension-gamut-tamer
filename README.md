# Gamut Tamer

GNOME Shell extension that applies a DCI-P3 → sRGB gamut correction shader system-wide via Mutter's compositor.

Designed for wide-gamut panels (like the BOE NV16N47 in the Dell Precision 5680) where Linux displays oversaturated colors due to the lack of native color management on GNOME/Wayland.

## How it works

A GLSL fragment shader is applied to `global.stage` using `Clutter.ShaderEffect`. It performs a 3x3 matrix transform in linear light space (with proper sRGB EOTF/OETF) to map the panel's native DCI-P3-like gamut down to sRGB.

## Installation

Build the extension zip and install it locally:

```bash
make install
```

This runs `gnome-extensions pack`, extracts the zip to `~/.local/share/gnome-shell/extensions/gamut-tamer@local/`, and compiles the GSettings schema.

Log out and log back in for GNOME Shell to discover the new extension (required on Wayland — there is no way to restart the shell without relogging):

```bash
gnome-extensions enable gamut-tamer@local
```

> **Note:** `gnome-extensions enable` will fail with "does not exist" if you haven't relogged first. GNOME Shell only scans for new extensions at session startup.

## Settings

Open the preferences panel to adjust boost and strength in real time:

```bash
gnome-extensions prefs gamut-tamer@local
```

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| Enabled | true | — | Toggle shader on/off |
| Boost | 1.4 | 0.0–3.0 | Amplifies correction beyond the raw matrix. 1.0 = raw matrix. |
| Strength | 1.0 | 0.0–1.0 | Mix between corrected and original. 0.0 = no effect. |

All changes apply in real time — no session restart needed after the initial enable.

## Makefile targets

| Target | Description |
|--------|-------------|
| `make build` | Create the `.shell-extension.zip` via `gnome-extensions pack` |
| `make install` | Build + extract to extensions dir + compile schema |
| `make enable` | Enable the extension |
| `make disable` | Disable the extension |
| `make clean` | Remove the zip |

## Troubleshooting

If the extension causes display issues (black screen, freeze), switch to a TTY with `Ctrl+Alt+F3` and run:

```bash
gnome-extensions disable gamut-tamer@local
```

Then switch back to your session with `Ctrl+Alt+F2`.

After updating `extension.js`, you **must** log out and log back in for the changes to take effect — GNOME Shell caches JS modules for the entire session.

## Correction matrix

The 3×3 matrix maps the BOE NV16N47 panel's native DCI-P3 gamut to sRGB (row-major):

```
+0.802682  +0.176662  +0.015146
+0.038366  +0.957570  +0.005615
+0.013611  +0.073916  +0.915091
```

## Compatibility

- GNOME Shell 46 (Ubuntu 24.04)
- Wayland and X11 sessions

## License

MIT

