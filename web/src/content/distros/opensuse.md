# Set up FriendlyHub on openSUSE

Flatpak is available in current versions of openSUSE Leap and openSUSE Tumbleweed. Follow these steps to get up and running.

## 1. Install Flatpak

Use the 1-click installer from [software.opensuse.org](https://software.opensuse.org/package/flatpak). Alternatively, if you prefer to use the terminal:

```bash
sudo zypper install flatpak
```

## 2. Add the FriendlyHub repository

```bash
flatpak remote-add --if-not-exists friendlyhub https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo
```

## 3. Add the FlatHub repository (optional)

The majority of Linux apps are distributed on [Flathub](https://flathub.org). You'll probably want to add their repository too!

```bash
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
```

## 4. Restart your system

For the best experience, restart your system to ensure Flatpak and the new repository are fully set up.

## 5. Install apps

You can now browse and install apps from FriendlyHub:

```bash
flatpak install friendlyhub <app-id>
```

Or browse apps on [friendlyhub.org](/apps) and click the install button.
