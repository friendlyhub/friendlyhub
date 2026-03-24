# FriendlyHub Flatpak Builder — version 0.2.0
# Used in GitHub Actions to build Flatpak apps and upload to flat-manager.
#
# Based on Fedora for up-to-date flatpak tooling.
# Pre-installs freedesktop + GNOME + KDE runtimes so builds don't re-download them every time.

# Stage 1: Build flat-manager-client from source
FROM fedora:43 AS fm-client-builder

RUN dnf install -y \
    cargo \
    rust \
    gcc \
    pkg-config \
    openssl-devel \
    ostree-devel \
    glib2-devel \
    git \
    && dnf clean all

RUN git clone --depth 1 https://github.com/flatpak/flat-manager.git /flat-manager

WORKDIR /flat-manager
RUN cargo build --release --package flat-manager-client && \
    cp target/release/flat-manager-client /usr/local/bin/flat-manager-client

# Stage 2: Final builder image
FROM fedora:43

RUN dnf install -y \
    flatpak \
    flatpak-builder \
    git \
    curl \
    jq \
    xz \
    bzip2 \
    ostree-libs \
    glib2 \
    openssl-libs \
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
    org.gnome.Platform//49 \
    org.gnome.Sdk//49 \
    org.gnome.Platform//50 \
    org.gnome.Sdk//50 \
    org.kde.Platform//6.9 \
    org.kde.Sdk//6.9 \
    org.kde.Platform//6.10 \
    org.kde.Sdk//6.10

# Copy flat-manager-client built from source
COPY --from=fm-client-builder /usr/local/bin/flat-manager-client /usr/local/bin/flat-manager-client

# Copy the build script
COPY build.sh /usr/local/bin/friendlyhub-build
RUN chmod +x /usr/local/bin/friendlyhub-build

WORKDIR /build
ENTRYPOINT ["/usr/local/bin/friendlyhub-build"]
