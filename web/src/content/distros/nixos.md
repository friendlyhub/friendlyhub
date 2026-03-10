# Set up FriendlyHub on NixOS

NixOS supports Flatpak. All you need to do is enable it.

## 1. Enable Flatpak

Add the following to **/etc/nixos/configuration.nix**:

```nix
services.flatpak.enable = true;
```

Switch to the new configuration:

```bash
sudo nixos-rebuild switch
```

## 2. Add the FriendlyHub repository

Run the following command:

```bash
flatpak remote-add --if-not-exists friendlyhub https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo
```

## 3. Add the FlatHub repository (optional)

The majority of Linux apps are distributed on [Flathub](https://flathub.org). You'll probably want to add their repository too!

```bash
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
```

## 4. Restart

To enable Flatpak support, restart your system.

## 5. Install apps

You can now browse and install apps from FriendlyHub:

```bash
flatpak install friendlyhub <app-id>
```