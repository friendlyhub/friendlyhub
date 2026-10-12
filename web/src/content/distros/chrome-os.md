# Set up FriendlyHub on ChromeOS

Flatpak support can be enabled on ChromeOS as long as your device supports the Linux compatibility layer (Crostini). You can check whether your device is supported [here](https://www.reddit.com/r/Crostini/wiki/getstarted/crostini-enabled-devices/).

## 1. Enable Linux Compatibility Layer

1. Open [chrome://os-settings](chrome://os-settings). 
2. Scroll down to **Developers**.
3. Turn on **Linux development environment**.

## 2. Install Flatpak

Press the Search (Launcher) key, type **Terminal** and launch the Terminal app. Type the following command:

```bash
sudo apt install flatpak
```

## 3. Add the FriendlyHub and Flathub repositories

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

## 4. Restart Linux

Right-click the terminal and choose **Shut down Linux**.

## 5. Install apps

You can now browse for apps from [friendlyhub.org](/apps) and click the install button to install them!
