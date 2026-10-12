# Set up FriendlyHub on Pop!_OS

Pop!_OS supports Flatpak by default in version 20.04 and newer. 

## 1. Add the FriendlyHub repository

FriendlyHub apps are built on runtimes (shared libraries) that are hosted on [Flathub](https://flathub.org), which Pop!_OS already comes with. The quickest way to add FriendlyHub is our [setup script](/setup.sh), which also checks that Flathub is still set up and tells you what it changed. Open a terminal and run:

```bash
curl -fsSL https://friendlyhub.org/setup.sh | sh
```

No curl? This does the same with wget:

```bash
wget -qO- https://friendlyhub.org/setup.sh | sh
```

If you'd rather not run a script, download the [FriendlyHub repository file](https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo), then double-click to install it. This should work by default on GNOME (and probably KDE). If it doesn't, or if you're using a different desktop, run:

```bash
flatpak remote-add --if-not-exists friendlyhub https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo
```

## 2. Install apps

You can now browse and install apps from FriendlyHub:

```bash
flatpak install friendlyhub <app-id>
```

Or browse apps on [friendlyhub.org](/apps) and click the install button.