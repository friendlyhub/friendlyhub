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

## 3. Restart

To enable Flatpak support, restart your system.

## 4. Install apps

You can now browse and install apps from FriendlyHub:

```bash
flatpak install friendlyhub <app-id>
```