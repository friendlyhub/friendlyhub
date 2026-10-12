# Set up FriendlyHub on Arch Linux

Installing Flatpak and enabling FriendlyHub on Arch Linux is easy.

## 1. Install Flatpak

Open a terminal and run:

```bash
sudo pacman -S flatpak
```

## 2. Install GNOME Software (optional)

If you use GNOME and want to use GNOME Software to install apps:

```bash
sudo pacman -S gnome-software
```

## 3. Install Discover (optional)

If you use KDE and want to use Discover to install apps:

```bash
sudo pacman -S discover
```

## 4. Add the FriendlyHub and Flathub repositories

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

## 5. Install apps

You can now browse and install apps from FriendlyHub:

```bash
flatpak install friendlyhub <app-id>
```

Or browse apps on [friendlyhub.org](/apps) and click the install button.
