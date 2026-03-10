# Set up FriendlyHub on Manjaro

Manjaro supports Flatpak by default in version 20 and newer. 

## 1. Enable Flatpak support

1. Open **Software Manager**.
2. Click on the ellipsis menu (three lines or dots) and select **Preferences**.
3. Open the **Flatpak** tab and enable the toggle for **Enable Flatpak support**. You probably also want to enable checking for updates.


## 2. Add the FriendlyHub repository

Download the [FriendlyHub repository file](https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo), then double-click to install it. This should work by default once Flatpak support is enabled. If it doesn't, open a terminal and run:

```bash
flatpak remote-add --if-not-exists friendlyhub https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo
```

## 3. Install apps

You can now browse and install apps from FriendlyHub:

```bash
flatpak install friendlyhub <app-id>
```

Or browse apps on [friendlyhub.org](/apps) and click the install button.