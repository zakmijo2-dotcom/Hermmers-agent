#!/usr/bin/env bash
# ==============================================================================
# Hemmers Agent - Universal AI Agent Enhancement Platform Installer
# https://github.com/zakmijo2-dotcom/Hermmers-agent
# ==============================================================================

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info() {
    echo -e "${BLUE}${BOLD}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}${BOLD}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}${BOLD}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}${BOLD}[ERROR]${NC} $1" >&2
}

echo -e "${CYAN}${BOLD}"
echo "  _    _                                          "
echo " | |  | |                                         "
echo " | |__| | ___ _ __ ___  _ __ ___   ___ _ __ ___   "
echo " |  __  |/ _ \ '_ \` _ \| '_ \` _ \ / _ \ '__/ __|  "
echo " | |  | |  __/ | | | | | | | | | |  __/ |  \__ \  "
echo " |_|  |_|\___|_| |_| |_|_| |_| |_|\___|_|  |___/  "
echo "                                                  "
echo " Universal AI Agent Enhancement Platform & Runtime"
echo -e "${NC}"

# Check Node.js
info "Checking prerequisites..."
if ! command -v node >/dev/null 2>&1; then
    error "Node.js is not installed."
    echo -e "Please install Node.js (v18 or newer):"
    echo -e "  - Termux: ${BOLD}pkg install nodejs-lts${NC}"
    echo -e "  - Ubuntu/Debian: ${BOLD}curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs${NC}"
    echo -e "  - macOS: ${BOLD}brew install node${NC}"
    echo -e "  - NVM: ${BOLD}nvm install --lts${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)

if [ "$NODE_MAJOR" -lt 18 ]; then
    error "Node.js version is v$NODE_VERSION. Hemmers requires Node.js >= v18.0.0."
    exit 1
fi
success "Found Node.js v$NODE_VERSION"

# Check Git
if ! command -v git >/dev/null 2>&1; then
    error "Git is not installed."
    echo -e "Please install git:"
    echo -e "  - Termux: ${BOLD}pkg install git${NC}"
    echo -e "  - Ubuntu/Debian: ${BOLD}sudo apt-get install git${NC}"
    echo -e "  - macOS: ${BOLD}brew install git${NC}"
    exit 1
fi
success "Found Git"

# Determine installation directory
INSTALL_DIR="${HEMMERS_DIR:-$HOME/.hemmers}"
REPO_URL="https://github.com/zakmijo2-dotcom/Hermmers-agent.git"

if [ -d "$INSTALL_DIR/.git" ]; then
    info "Existing Hemmers installation found at $INSTALL_DIR. Updating..."
    git -C "$INSTALL_DIR" fetch origin main
    git -C "$INSTALL_DIR" reset --hard origin/main
else
    info "Cloning Hemmers into $INSTALL_DIR..."
    rm -rf "$INSTALL_DIR"
    git clone "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

info "Installing dependencies..."
npm install

info "Building TypeScript..."
npm run build

info "Configuring global executable..."
# Try global npm link or install into common binary paths
LINKED=0

if npm link 2>/dev/null; then
    LINKED=1
fi

# Fallback: symlink into user's bin path if npm link didn't place it in PATH
if ! command -v hemmers >/dev/null 2>&1; then
    BIN_DIR=""
    if [ -n "$PREFIX" ] && [ -d "$PREFIX/bin" ]; then
        BIN_DIR="$PREFIX/bin"
    elif [ -d "$HOME/.local/bin" ]; then
        BIN_DIR="$HOME/.local/bin"
    elif [ -d "/usr/local/bin" ] && [ -w "/usr/local/bin" ]; then
        BIN_DIR="/usr/local/bin"
    elif [ -d "$HOME/bin" ]; then
        BIN_DIR="$HOME/bin"
    fi

    if [ -n "$BIN_DIR" ]; then
        mkdir -p "$BIN_DIR"
        ln -sf "$INSTALL_DIR/dist/cli/index.js" "$BIN_DIR/hemmers"
        chmod +x "$BIN_DIR/hemmers"
        LINKED=1
    fi
fi

echo ""
success "Hemmers Agent installed successfully!"
echo ""
echo -e "${BOLD}Get Started:${NC}"
echo -e "  1. Verify setup:      ${CYAN}hemmers doctor${NC}"
echo -e "  2. Detect agents:     ${CYAN}hemmers agents${NC}"
echo -e "  3. Initialize:        ${CYAN}hemmers init${NC}"
echo -e "  4. Search skills:     ${CYAN}hemmers search coder${NC}"
echo ""

if ! command -v hemmers >/dev/null 2>&1; then
    warn "The 'hemmers' command is not yet in your PATH."
    echo -e "Add this to your ~/.bashrc or ~/.zshrc:"
    echo -e "  ${BOLD}export PATH=\"\$PATH:$HOME/.local/bin:$INSTALL_DIR/dist/cli\"${NC}"
    echo -e "Or run directly via:"
    echo -e "  ${BOLD}node $INSTALL_DIR/dist/cli/index.js <command>${NC}"
else
    # Run doctor check
    info "Running diagnostic check..."
    hemmers doctor || true
fi
