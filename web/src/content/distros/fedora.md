# Set up FriendlyHub on Fedora

Fedora supports Flatpak by default on various editions of Fedora. 

## 1. Add the FriendlyHub repository

Download the FriendlyHub repository file, then double-click to install it. This should work by default on both GNOME and KDE. If it doesn't, or if you're using a different desktop, open a terminal and run:

```bash
flatpak remote-add --if-not-exists friendlyhub https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo
```

## 2. Install apps

You can now browse and install apps from FriendlyHub:

```bash
flatpak install friendlyhub <app-id>
```

Or browse apps on [friendlyhub.org](/apps) and click the install button.