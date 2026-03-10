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

## 3. Add the FriendlyHub repository

```bash
flatpak remote-add --if-not-exists friendlyhub https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo
```

## 4. Add the FlatHub repository (optional)

The majority of Linux apps are distributed on [Flathub](https://flathub.org). You'll probably want to add their repository too!

```bash
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
```

## 5. Restart Linux

Right-click the terminal and choose **Shut down Linux**.

## 6. Install apps

You can now browse for apps from [friendlyhub.org](/apps) and click the install button to install them!
