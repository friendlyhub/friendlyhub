# FriendlyHub Flatpak Builder
# Used in GitHub Actions to build Flatpak apps and upload to flat-manager.
#
# Based on Fedora for up-to-date flatpak tooling.
# Pre-installs freedesktop + GNOME + KDE runtimes so builds don't re-download them every time.

FROM fedora:43

RUN dnf install -y \
    flatpak \
    flatpak-builder \
    git \
    curl \
    jq \
    xz \
    bzip2 \
    && dnf clean all

# Add Flathub remote (source of runtimes/SDKs)
RUN flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo

# Pre-install common runtimes and SDKs so builds are faster.
# These are the most common ones used by Flatpak apps.
RUN flatpak install -y --noninteractive flathub \
    org.freedesktop.Platform//24.08 \
    org.freedesktop.Sdk//24.08 \
    org.freedesktop.Platform//25.08 \
    org.freedesktop.Sdk//25.08 \
    org.gnome.Platform//48 \
    org.gnome.Sdk//48 \
    org.gnome.Platform//49 \
    org.gnome.Sdk//49 \
    org.kde.Platform//6.8 \
    org.kde.Sdk//6.8 \
    org.kde.Platform//6.10 \
    org.kde.Sdk//6.10

# Install flat-manager-client for uploading builds
# Built from the flat-manager repo (it's not a standalone crate)
RUN dnf install -y cargo rust openssl-devel && \
    cargo install --git https://github.com/flatpak/flat-manager.git flat-manager-client && \
    dnf remove -y cargo rust openssl-devel && \
    dnf clean all

# Copy the build script
COPY build.sh /usr/local/bin/friendlyhub-build
RUN chmod +x /usr/local/bin/friendlyhub-build

WORKDIR /build
ENTRYPOINT ["/usr/local/bin/friendlyhub-build"]
