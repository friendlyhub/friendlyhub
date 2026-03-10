# Set up FriendlyHub on Solus

Solus supports Flatpak by default in version 4.7 and newer. 

## 1. Add the FriendlyHub repository

Download the [FriendlyHub repository file](https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo), then double-click to install it. This should work by default on Budgie, GNOME and KDE editions. If it doesn't, open a terminal and run:

```bash
flatpak remote-add --if-not-exists friendlyhub https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo
```

## 2. Install apps

You can now browse and install apps from FriendlyHub:

```bash
flatpak install friendlyhub <app-id>
```

Or browse apps on [friendlyhub.org](/apps) and click the install button.