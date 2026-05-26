#!/bin/bash
# install_harness.sh - Download and extract the compiled localharness binary
# from the PyPI wheel without requiring Python, pip, or virtual environments.

set -euo pipefail

# Allow overriding the version via the first argument, default to 0.1.0
VERSION="${1:-0.1.0}"
PLATFORM=""

case "$(uname -s)" in
    Darwin)
        case "$(uname -m)" in
            arm64) PLATFORM="macosx_11_0_arm64" ;;
            x86_64) PLATFORM="macosx_10_9_x86_64" ;;
            *) echo "ERROR: Unsupported macOS architecture: $(uname -m)"; exit 1 ;;
        esac
        ;;
    Linux)
        case "$(uname -m)" in
            x86_64) PLATFORM="manylinux_2_17_x86_64" ;;
            aarch64) PLATFORM="manylinux_2_17_aarch64" ;;
            *) echo "ERROR: Unsupported Linux architecture: $(uname -m)"; exit 1 ;;
        esac
        ;;
    *)
        echo "ERROR: Unsupported operating system: $(uname -s)"
        exit 1
        ;;
esac

# Check for required commands
for cmd in curl unzip; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "ERROR: '$cmd' utility is required but not installed. Please install it and try again."
        exit 1
    fi
done

echo "Fetching localharness v${VERSION} for ${PLATFORM}..."

DOWNLOAD_URL=""

# 1. Query the PyPI JSON API to locate the download URL for the wheel matching our platform
echo "Querying PyPI JSON API..."
JSON_DATA=$(curl -sSfL "https://pypi.org/pypi/google-antigravity/${VERSION}/json" 2>/dev/null || true)
if [ -n "$JSON_DATA" ]; then
    DOWNLOAD_URL=$(echo "$JSON_DATA" | grep -o 'https://[^"]*\.whl' | grep "$PLATFORM" | head -n 1 || true)
fi

# 2. Fallback to the highly stable PyPI Simple Repository API
if [ -z "$DOWNLOAD_URL" ]; then
    echo "PyPI JSON API query returned no results, falling back to simple repository index..."
    SIMPLE_DATA=$(curl -sSfL "https://pypi.org/simple/google-antigravity/" 2>/dev/null || true)
    if [ -n "$SIMPLE_DATA" ]; then
        DOWNLOAD_URL=$(echo "$SIMPLE_DATA" | grep -o 'href="[^"]*"' | grep "${VERSION}" | grep "$PLATFORM" | head -n 1 | cut -d'"' -f2 | cut -d'#' -f1 || true)
    fi
fi

# 3. Last resort hardcoded URL fallback for the default version
if [ -z "$DOWNLOAD_URL" ]; then
    if [ "$VERSION" = "0.1.0" ]; then
        echo "Simple repository query failed, using direct URL fallback..."
        DOWNLOAD_URL="https://files.pythonhosted.org/packages/df/70/812e0ef107fa1b71c3079eab7162928b0695ce59646e19ea32bfb2a21ab7/google_antigravity-0.1.0-py3-none-manylinux_2_17_x86_64.whl"
    else
        echo "ERROR: Could not resolve download URL for version ${VERSION} and platform ${PLATFORM}."
        exit 1
    fi
fi

WHEEL_FILE="google_antigravity-${VERSION}-py3-none-${PLATFORM}.whl"

# Using a progress bar since the wheel file is ~126MB
echo "Downloading wheel package..."
curl -# -L -o "${WHEEL_FILE}" "${DOWNLOAD_URL}"

echo "Extracting localharness binary..."
# Extract just the binary from the wheel (which is a standard ZIP file)
unzip -q -o "${WHEEL_FILE}" "google/antigravity/bin/localharness"

# Move the binary to the bin/ directory
mkdir -p bin
mv google/antigravity/bin/localharness bin/localharness
chmod +x bin/localharness

# Clean up temporary files
rm -rf google "${WHEEL_FILE}"

echo "SUCCESS: localharness v${VERSION} installed at ./bin/localharness"
echo "To configure, run: export ANTIGRAVITY_HARNESS_PATH=\$(pwd)/bin/localharness"
