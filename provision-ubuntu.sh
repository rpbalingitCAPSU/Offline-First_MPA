#!/usr/bin/env bash
# ============================================================
# provision-ubuntu.sh — Run inside WSL2 Ubuntu 22.04
# Provisions the Ubuntu VM with all dependencies needed to
# run the MPA Monitor inference service on Jetson or locally.
# ============================================================

set -euo pipefail

PROJECT_WIN_PATH="/mnt/c/Users/choibali/Documents/IBM Dev Day Hackathon 2026/Offline-First_MPA"
PROJECT_UNIX_PATH="$HOME/mpa-monitor"

echo ""
echo "============================================"
echo "  MPA Monitor — Ubuntu VM Provisioning"
echo "============================================"
echo ""

# ── 1. System update ─────────────────────────────────────────
echo "[1/7] Updating package list..."
sudo apt-get update -qq

# ── 2. System dependencies ───────────────────────────────────
echo "[2/7] Installing system dependencies..."
sudo apt-get install -y -qq \
    python3.12 python3.12-venv python3-pip \
    libopencv-dev python3-opencv \
    git curl wget unzip \
    libgl1-mesa-glx libglib2.0-0

# ── 3. Link project from Windows filesystem ──────────────────
echo "[3/7] Linking project directory..."
if [ ! -d "$PROJECT_UNIX_PATH" ]; then
    ln -s "$PROJECT_WIN_PATH" "$PROJECT_UNIX_PATH"
    echo "  Linked: $PROJECT_UNIX_PATH -> $PROJECT_WIN_PATH"
else
    echo "  Already exists: $PROJECT_UNIX_PATH"
fi

# ── 4. Python virtual environment ────────────────────────────
echo "[4/7] Creating Python virtual environment..."
cd "$PROJECT_UNIX_PATH/inference_service"
python3 -m venv .venv
source .venv/bin/activate

# ── 5. Install Python dependencies ───────────────────────────
echo "[5/7] Installing Python packages (FastAPI, uvicorn, pillow, numpy)..."
pip install --quiet --upgrade pip
pip install --quiet fastapi "uvicorn[standard]" pillow numpy python-multipart opencv-python-headless

# Optional: ONNX Runtime for model inference (lighter than full PyTorch)
pip install --quiet onnxruntime 2>/dev/null && echo "  onnxruntime installed" || echo "  onnxruntime skipped (not critical)"

echo ""
echo "  FastAPI: $(python -c 'import fastapi; print(fastapi.__version__)')"
echo "  Uvicorn: $(python -c 'import uvicorn; print(uvicorn.__version__)')"

# ── 6. Node.js (for serving frontend from WSL) ───────────────
echo "[6/7] Installing Node.js LTS in WSL..."
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - -qq
sudo apt-get install -y -qq nodejs
echo "  Node: $(node --version)  npm: $(npm --version)"
npm install -g serve --quiet
echo "  serve: $(serve --version)"

# ── 7. Create WSL launcher scripts ───────────────────────────
echo "[7/7] Creating launcher scripts..."

cat > "$PROJECT_UNIX_PATH/start-inference-wsl.sh" << 'SCRIPT'
#!/usr/bin/env bash
# Start the FastAPI inference service from WSL
cd "$(dirname "$0")/inference_service"
source .venv/bin/activate
echo "[Inference] Starting FastAPI on http://0.0.0.0:8000 ..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
SCRIPT
chmod +x "$PROJECT_UNIX_PATH/start-inference-wsl.sh"

cat > "$PROJECT_UNIX_PATH/start-frontend-wsl.sh" << 'SCRIPT'
#!/usr/bin/env bash
# Serve the MPA Monitor frontend from WSL
cd "$(dirname "$0")"
echo "[Frontend] Serving MPA Monitor on http://localhost:8080 ..."
echo "[Frontend] Open: http://localhost:8080 in your browser"
serve -l 8080 -s .
SCRIPT
chmod +x "$PROJECT_UNIX_PATH/start-frontend-wsl.sh"

deactivate

echo ""
echo "============================================"
echo "  Provisioning complete!"
echo ""
echo "  To start the app from WSL:"
echo "    Frontend:  bash ~/mpa-monitor/start-frontend-wsl.sh"
echo "    Inference: bash ~/mpa-monitor/start-inference-wsl.sh"
echo ""
echo "  From Windows:"
echo "    start-app.bat        (starts both servers)"
echo "    start-inference.bat  (inference service only)"
echo "============================================"
echo ""
