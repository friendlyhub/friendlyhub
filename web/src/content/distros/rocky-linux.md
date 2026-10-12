# Set up FriendlyHub on Rocky Linux

Flatpak is installed by default on Rocky Linux 8 and newer, provided you have GNOME installed. 

## 1. Install Flatpak

If you don't have GNOME installed, open a terminal and run:

```bash
sudo dnf install flatpak
```

## 2. Add the FriendlyHub and Flathub repositories

FriendlyHub apps are built on runtimes (shared libraries) that are hosted on [Flathub](https://flathub.org), so you need both repositories. The quickest way to add them is our [setup script](/setup.sh), which adds whichever are missing and tells you what it changed:

```bash
curl -fsSL https://friendlyhub.org/setup.sh | sh
```

No curl? This does the same with wget:

```bash
wget -qO- https://friendlyhub.org/setup.sh | sh
```

If you'd rather not run a script, add them yourself. If you already have Flathub, its command does nothing.

```bash
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak remote-add --if-not-exists friendlyhub https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo
```

## 3. Restart your system

For the best experience, restart your system to ensure Flatpak and the new repository are fully set up.

## 4. Install apps

You can now browse and install apps from FriendlyHub:

```bash
flatpak install friendlyhub <app-id>
```

Or browse apps on [friendlyhub.org](/apps) and click the install button.

