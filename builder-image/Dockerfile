# FriendlyHub Flatpak Builder
# Used in GitHub Actions to build Flatpak apps and upload to flat-manager.
#
# Based on Fedora for up-to-date flatpak tooling.
# Pre-installs freedesktop + GNOME + KDE runtimes so builds don't re-download them every time.

FROM fedora:41

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
    org.gnome.Platform//47 \
    org.gnome.Sdk//47 \
    org.kde.Platform//6.8 \
    org.kde.Sdk//6.8

# Install flat-manager-client for uploading builds
# Build from source since there's no pre-built binary package
RUN dnf install -y cargo rust openssl-devel && \
    cargo install flat-manager-client && \
    dnf remove -y cargo rust openssl-devel && \
    dnf clean all

# Copy the build script
COPY build.sh /usr/local/bin/friendlyhub-build
RUN chmod +x /usr/local/bin/friendlyhub-build

WORKDIR /build
ENTRYPOINT ["/usr/local/bin/friendlyhub-build"]
