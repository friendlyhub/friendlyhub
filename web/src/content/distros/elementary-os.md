# Set up FriendlyHub on elementary OS

elementary OS supports Flatpak by default in version 5.1 and newer. 

## 1. Add the FriendlyHub repository

Download the [FriendlyHub repository file](https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo), then double-click to install it via AppCenter. If it doesn't work, open a terminal and run:

```bash
flatpak remote-add --if-not-exists friendlyhub https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo
```

## 2. Install apps

You can now browse and install apps from FriendlyHub:

```bash
flatpak install friendlyhub <app-id>
```

Or browse apps on [friendlyhub.org](/apps) and click the install button.