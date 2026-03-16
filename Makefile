UUID = gamut-tamer@local
BUNDLE = $(UUID).shell-extension.zip

.PHONY: all build install enable disable clean

all: build

build:
	gnome-extensions pack --force \
		--schema=schemas/org.gnome.shell.extensions.gamut-tamer.gschema.xml \
		-o .

DESTDIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

install: build
	mkdir -p $(DESTDIR)
	unzip -o $(BUNDLE) -d $(DESTDIR)
	glib-compile-schemas $(DESTDIR)/schemas/

enable:
	gnome-extensions enable $(UUID)

disable:
	gnome-extensions disable $(UUID)

clean:
	rm -f $(BUNDLE)
