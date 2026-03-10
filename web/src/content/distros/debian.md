# Set up FriendlyHub on Debian

Debian ships with Flatpak support available in the official repositories, but it's not installed by default. Follow these steps to get up and running on Debian 10 (Buster) and later.

## 1. Install Flatpak

Open a terminal and run:

```bash
sudo apt install flatpak
```

## 2. Install the GNOME Software plugin (optional)

If you use GNOME Software and want to install Flatpak apps from there:

```bash
sudo apt install gnome-software-plugin-flatpak
```

## 3. Install the Discover backend (optional)

If you use Discover and want to install Flatpak apps from there:

```bash
sudo apt install plasma-discover-backend-flatpak
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

## 6. Restart your system

For the best experience, restart your system to ensure Flatpak and the new repository are fully set up.

## 7. Install apps

You can now browse and install apps from FriendlyHub:

```bash
flatpak install friendlyhub <app-id>
```

Or browse apps on [friendlyhub.org](/apps) and click the install button.
