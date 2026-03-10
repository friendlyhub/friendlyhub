# Set up FriendlyHub on Rocky Linux

Flatpak is installed by default on Rocky Linux 8 and newer, provided you have GNOME installed. 

## 1. Install Flatpak

If you don't have GNOME installed, open a terminal and run:

```bash
sudo dnf install flatpak
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

