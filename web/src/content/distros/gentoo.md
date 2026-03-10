# Set up FriendlyHub on Gentoo

Gentoo ships with Flatpak support available in the official repositories, but it's not installed by default. Follow these steps to get up and running.

## 1. Choose what to install

### Option 1: Install Flatpak (no GUI)

Open a terminal and run:

```bash
sudo emerge --ask sys-apps/flatpak
```

### Option 2: Install Flatpak + GNOME Software

If you would like to use GNOME Software to install Flatpak apps:

```bash
sudo mkdir -p /etc/portage/package.use
echo "gnome-extra/gnome-software flatpak" | sudo tee /etc/portage/package.use/gnome-software

sudo emerge --ask gnome-extra/gnome-software sys-apps/flatpak
```

### Option 3: Install Flatpak + Discover

If you would like to use Discover to install Flatpak apps:

```bash
sudo mkdir -p /etc/portage/package.use
echo "kde-plasma/discover flatpak" | sudo tee /etc/portage/package.use/discover

sudo emerge --ask kde-plasma/discover sys-apps/flatpak
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

## 4. Log out

For the best experience, log out and back in to ensure Flatpak and the new repository are fully set up.

## 5. Install apps

You can now browse and install apps from FriendlyHub:

```bash
flatpak install friendlyhub <app-id>
```

Or, if you have enabled a GUI, browse apps on [friendlyhub.org](/apps) and click the install button.
