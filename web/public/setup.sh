#!/bin/sh
# Adds the Flathub and FriendlyHub Flatpak remotes system-wide and reports
# what it changed.
#
#   curl -fsSL https://friendlyhub.org/setup.sh | sh
#
# FriendlyHub hosts apps only. Their runtimes come from Flathub, so both
# remotes are needed. A remote is recognised by its URL whatever it is
# called, and one that is present but disabled is re-enabled rather than
# added a second time.
#
# Everything runs from main on the last line, so a partial download runs
# nothing.

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
    BOLD=$(printf '\033[1m')
    GREEN=$(printf '\033[32m')
    DIM=$(printf '\033[2m')
    RESET=$(printf '\033[0m')
else
    BOLD='' GREEN='' DIM='' RESET=''
fi

fail() {
    printf '%sError:%s %s\n' "$BOLD" "$RESET" "$1" >&2
    exit 1
}

report() {
    printf '  %-12s %s\n' "$1" "$2"
}

# Prints "name<TAB>options" for the system remote at the given URL, if any.
find_remote() {
    flatpak remotes --system --show-disabled --columns=name,url,options 2>/dev/null |
        awk -F '\t' -v want="${1%/}" '{ url = $2; sub(/\/$/, "", url) } url == want { print $1 "\t" $3; exit }'
}

# Usage: setup_remote <label> <name> <url> <flatpakrepo url>
setup_remote() {
    label=$1 name=$2 url=$3 repofile=$4
    found=$(find_remote "$url")
    if [ -n "$found" ]; then
        existing=$(printf '%s' "$found" | cut -f1)
        case $(printf '%s' "$found" | cut -f2) in
            *disabled*)
                flatpak remote-modify --system --enable "$existing" ||
                    fail "Could not enable the $label remote '$existing'."
                report "$label" "${GREEN}enabled${RESET} (it was set up but switched off)"
                CHANGED=1
                ;;
            *)
                report "$label" "${DIM}already set up${RESET}"
                ;;
        esac
        return
    fi
    if flatpak remotes --system --show-disabled --columns=name 2>/dev/null | grep -qx "$name"; then
        fail "A remote called '$name' already exists but points somewhere other than $url."
    fi
    flatpak remote-add --system "$name" "$repofile" ||
        fail "Could not add the $label remote."
    report "$label" "${GREEN}added${RESET}"
    CHANGED=1
}

main() {
    command -v flatpak >/dev/null 2>&1 ||
        fail "Flatpak isn't installed. Follow the steps for your distribution at https://friendlyhub.org/setup, then run this again."

    CHANGED=0
    printf '%sSetting up FriendlyHub%s\n\n' "$BOLD" "$RESET"
    setup_remote Flathub flathub https://dl.flathub.org/repo/ https://dl.flathub.org/repo/flathub.flatpakrepo
    setup_remote FriendlyHub friendlyhub https://dl.friendlyhub.org/repo/ https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo
    echo
    if [ "$CHANGED" = 0 ]; then
        echo "Nothing to do: Flathub and FriendlyHub were already set up."
    else
        echo "All set. Browse apps at https://friendlyhub.org/apps, or install one with:"
        echo "  flatpak install friendlyhub <app-id>"
    fi
}

main "$@"
