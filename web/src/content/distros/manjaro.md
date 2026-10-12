# Set up FriendlyHub on Manjaro

Manjaro supports Flatpak by default in version 20 and newer. 

## 1. Enable Flatpak support

1. Open **Software Manager**.
2. Click on the ellipsis menu (three lines or dots) and select **Preferences**.
3. Open the **Flatpak** tab and enable the toggle for **Enable Flatpak support**. You probably also want to enable checking for updates.


## 2. Add the FriendlyHub repository

FriendlyHub apps are built on runtimes (shared libraries) that are hosted on [Flathub](https://flathub.org), which Manjaro already comes with. The quickest way to add FriendlyHub is our [setup script](/setup.sh), which also checks that Flathub is still set up and tells you what it changed. Open a terminal and run:

```bash
curl -fsSL https://friendlyhub.org/setup.sh | sh
```

No curl? This does the same with wget:

```bash
wget -qO- https://friendlyhub.org/setup.sh | sh
```

If you'd rather not run a script, download the [FriendlyHub repository file](https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo), then double-click to install it. This should work by default once Flatpak support is enabled. If it doesn't, run:

```bash
flatpak remote-add --if-not-exists friendlyhub https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo
```

## 3. Install apps

You can now browse and install apps from FriendlyHub:

```bash
flatpak install friendlyhub <app-id>
```

Or browse apps on [friendlyhub.org](/apps) and click the install button.