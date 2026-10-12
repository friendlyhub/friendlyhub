# Getting Started

FriendlyHub is a Flatpak repository that works with any Linux distribution that supports Flatpak. You can use it alongside Flathub or any other Flatpak remote with no conflicts.

## Installing Flatpak

If you're using any of the following distributions, Flatpak is already installed and you can skip to the [next step](#adding-the-friendlyhub-remote):

**AlmaLinux, CentOS Stream, elementary OS, Fedora, Linux Mint, Pop!\_OS, Solus, Zorin OS**

If your distribution isn't listed above, you'll need to install Flatpak first. Choose your distribution below for instructions:

<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0;">
  <a href="https://friendlyhub.org/setup/ubuntu" target="_blank" style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; border-radius: 8px; border: 1px solid var(--vp-c-divider); text-decoration: none; color: var(--vp-c-text-1); transition: border-color 0.2s;" onmouseover="this.style.borderColor='var(--vp-c-brand-1)'" onmouseout="this.style.borderColor='var(--vp-c-divider)'">
    <img src="https://cdn.simpleicons.org/ubuntu/E95420" width="32" height="32" alt="Ubuntu">
    <span style="font-size: 13px;">Ubuntu</span>
  </a>
  <a href="https://friendlyhub.org/setup/debian" target="_blank" style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; border-radius: 8px; border: 1px solid var(--vp-c-divider); text-decoration: none; color: var(--vp-c-text-1); transition: border-color 0.2s;" onmouseover="this.style.borderColor='var(--vp-c-brand-1)'" onmouseout="this.style.borderColor='var(--vp-c-divider)'">
    <img src="https://cdn.simpleicons.org/debian/A81D33" width="32" height="32" alt="Debian">
    <span style="font-size: 13px;">Debian</span>
  </a>
  <a href="https://friendlyhub.org/setup/arch-linux" target="_blank" style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; border-radius: 8px; border: 1px solid var(--vp-c-divider); text-decoration: none; color: var(--vp-c-text-1); transition: border-color 0.2s;" onmouseover="this.style.borderColor='var(--vp-c-brand-1)'" onmouseout="this.style.borderColor='var(--vp-c-divider)'">
    <img src="https://cdn.simpleicons.org/archlinux/1793D1" width="32" height="32" alt="Arch Linux">
    <span style="font-size: 13px;">Arch Linux</span>
  </a>
  <a href="https://friendlyhub.org/setup/opensuse" target="_blank" style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; border-radius: 8px; border: 1px solid var(--vp-c-divider); text-decoration: none; color: var(--vp-c-text-1); transition: border-color 0.2s;" onmouseover="this.style.borderColor='var(--vp-c-brand-1)'" onmouseout="this.style.borderColor='var(--vp-c-divider)'">
    <img src="https://cdn.simpleicons.org/opensuse/73BA25" width="32" height="32" alt="openSUSE">
    <span style="font-size: 13px;">openSUSE</span>
  </a>
  <a href="https://friendlyhub.org/setup/manjaro" target="_blank" style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; border-radius: 8px; border: 1px solid var(--vp-c-divider); text-decoration: none; color: var(--vp-c-text-1); transition: border-color 0.2s;" onmouseover="this.style.borderColor='var(--vp-c-brand-1)'" onmouseout="this.style.borderColor='var(--vp-c-divider)'">
    <img src="https://cdn.simpleicons.org/manjaro/35BF5C" width="32" height="32" alt="Manjaro">
    <span style="font-size: 13px;">Manjaro</span>
  </a>
  <a href="https://friendlyhub.org/setup/void-linux" target="_blank" style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; border-radius: 8px; border: 1px solid var(--vp-c-divider); text-decoration: none; color: var(--vp-c-text-1); transition: border-color 0.2s;" onmouseover="this.style.borderColor='var(--vp-c-brand-1)'" onmouseout="this.style.borderColor='var(--vp-c-divider)'">
    <img src="https://cdn.simpleicons.org/voidlinux/478061" width="32" height="32" alt="Void Linux">
    <span style="font-size: 13px;">Void Linux</span>
  </a>
  <a href="https://friendlyhub.org/setup/gentoo" target="_blank" style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; border-radius: 8px; border: 1px solid var(--vp-c-divider); text-decoration: none; color: var(--vp-c-text-1); transition: border-color 0.2s;" onmouseover="this.style.borderColor='var(--vp-c-brand-1)'" onmouseout="this.style.borderColor='var(--vp-c-divider)'">
    <img src="https://cdn.simpleicons.org/gentoo/54487A" width="32" height="32" alt="Gentoo">
    <span style="font-size: 13px;">Gentoo</span>
  </a>
  <a href="https://friendlyhub.org/setup/nixos" target="_blank" style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; border-radius: 8px; border: 1px solid var(--vp-c-divider); text-decoration: none; color: var(--vp-c-text-1); transition: border-color 0.2s;" onmouseover="this.style.borderColor='var(--vp-c-brand-1)'" onmouseout="this.style.borderColor='var(--vp-c-divider)'">
    <img src="https://cdn.simpleicons.org/nixos/5277C3" width="32" height="32" alt="NixOS">
    <span style="font-size: 13px;">NixOS</span>
  </a>
  <a href="https://friendlyhub.org/setup/rocky-linux" target="_blank" style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; border-radius: 8px; border: 1px solid var(--vp-c-divider); text-decoration: none; color: var(--vp-c-text-1); transition: border-color 0.2s;" onmouseover="this.style.borderColor='var(--vp-c-brand-1)'" onmouseout="this.style.borderColor='var(--vp-c-divider)'">
    <img src="https://cdn.simpleicons.org/rockylinux/10B981" width="32" height="32" alt="Rocky Linux">
    <span style="font-size: 13px;">Rocky Linux</span>
  </a>
  <a href="https://friendlyhub.org/setup" target="_blank" style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; border-radius: 8px; border: 1px solid var(--vp-c-divider); text-decoration: none; color: var(--vp-c-text-1); transition: border-color 0.2s;" onmouseover="this.style.borderColor='var(--vp-c-brand-1)'" onmouseout="this.style.borderColor='var(--vp-c-divider)'">
    <span style="width: 32px; height: 32px; border-radius: 50%; background: var(--vp-c-divider); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 500;">...</span>
    <span style="font-size: 13px;">Other</span>
  </a>
</div>

## Adding the FriendlyHub Remote

FriendlyHub hosts apps only. The runtimes those apps are built on (such as `org.gnome.Platform` and `org.freedesktop.Platform`) come from Flathub, so you need both remotes.

### With the setup script

The quickest way is our [setup script](https://friendlyhub.org/setup.sh). Open a terminal and run:

```bash
curl -fsSL https://friendlyhub.org/setup.sh | sh
```

If you don't have `curl`, `wget -qO- https://friendlyhub.org/setup.sh | sh` does the same.

The script adds whichever of the two remotes are missing, system-wide, and tells you what it changed. It recognises a remote by its URL, so a Flathub remote you added under a different name counts. If Flathub is set up but disabled, it re-enables it rather than adding a second copy. If both are already in place, it changes nothing and says so. It doesn't install Flatpak itself; if Flatpak is missing, it stops and points you to the instructions above.

### By hand

Open a terminal and run:

```bash
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak remote-add --if-not-exists friendlyhub https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo
```

These download each repository's configuration and GPG key. The `--if-not-exists` flag means they're safe to run even if you've already added either remote.

Alternatively, you can download the [flathub.flatpakrepo](https://dl.flathub.org/repo/flathub.flatpakrepo) and [friendlyhub.flatpakrepo](https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo) files and open them with GNOME Software or your system's Flatpak handler.

## Browsing Apps

### On the Web

Visit [friendlyhub.org/apps](https://friendlyhub.org/apps) to browse all available apps. Each app page shows screenshots, a description, permissions, and install instructions.

### From the Terminal

List all available apps:

```bash
flatpak remote-ls friendlyhub
```

Search for a specific app:

```bash
flatpak search --columns=application,remotes "search term" | grep friendlyhub
```

## Installing Apps

### From the Terminal

```bash
flatpak install friendlyhub org.example.MyApp
```

### From GNOME Software or KDE Discover

Once you've added the FriendlyHub and Flathub remotes, apps from FriendlyHub will appear in your software centre's search results alongside apps from other remotes. You can also click the **Install** button on any app's page on the FriendlyHub website, which opens a `.flatpakref` link that your software centre can handle directly.

## Updating Apps

Update all apps from all remotes (including FriendlyHub):

```bash
flatpak update
```

Or update a specific app:

```bash
flatpak update org.example.MyApp
```

GNOME Software and KDE Discover will also show available updates from FriendlyHub in their normal update flow.

## Running Alongside Flathub

FriendlyHub is a standard Flatpak remote. It coexists with Flathub and any other remotes without conflict. If the same app is available on multiple remotes, Flatpak will ask which remote you want to install from.

## Removing the Remote

If you ever want to remove FriendlyHub:

```bash
flatpak remote-delete friendlyhub
```

This removes the remote configuration but does not uninstall any apps you've already installed from it. To uninstall an app first:

```bash
flatpak uninstall org.example.MyApp
flatpak remote-delete friendlyhub
```
