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

## 4. Add the FriendlyHub repository

```bash
flatpak remote-add --if-not-exists friendlyhub https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo
```

## 5. Add the FlatHub repository (optional)

The majority of Linux apps are distributed on [Flathub](https://flathub.org). You'll probably want to add their repository too!

```bash
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
```

## 6. Install apps

You can now browse and install apps from FriendlyHub:

```bash
flatpak install friendlyhub <app-id>
```

Or browse apps on [friendlyhub.org](/apps) and click the install button.
