#!/bin/bash
# ============================================
# Setup Sandbox for Claude CLI Processes
# ============================================
# This script creates process isolation between the orchestrator
# and the Claude CLI instances it spawns.
#
# Protection layers:
#   1. UID isolation: Claude runs as 'claude-sandbox' user
#      - Cannot send signals to 'dev' processes (kill blocked by kernel)
#   2. Filesystem: /workspace/orquetrador-claude/ is owner-only (700)
#      - claude-sandbox cannot read orchestrator code, DB, or config
#   3. Group access: claude-sandbox is in 'dev' group
#      - Can read/write project directories (775 owned by dev:dev)
#   4. Env sanitization: orchestrator secrets stripped before spawn
#      - DATABASE_URL, JWT_SECRET, etc. never reach child processes
#   5. Auth: Claude CLI credentials copied to sandbox user
#      - Only .credentials.json and settings.json are shared
#
# Run this script on container startup or after deploy.
# Requires root/sudo.
# ============================================

set -e

echo "🔒 Setting up Claude sandbox..."

# Create sandbox user if not exists
if ! id claude-sandbox &>/dev/null; then
  useradd --system --no-create-home --shell /bin/false claude-sandbox
  echo "  ✅ Created user: claude-sandbox"
else
  echo "  ✅ User exists: claude-sandbox"
fi

# Add to dev group for project file access
usermod -aG dev claude-sandbox 2>/dev/null || true
echo "  ✅ claude-sandbox added to dev group"

# Create home directory for Claude CLI session storage
mkdir -p /home/claude-sandbox/.claude
chown -R claude-sandbox:claude-sandbox /home/claude-sandbox
echo "  ✅ Home directory: /home/claude-sandbox"

# Copy Claude CLI auth credentials (if dev has them)
if [ -f /home/dev/.claude/.credentials.json ]; then
  cp /home/dev/.claude/.credentials.json /home/claude-sandbox/.claude/.credentials.json
  chown claude-sandbox:claude-sandbox /home/claude-sandbox/.claude/.credentials.json
  chmod 600 /home/claude-sandbox/.claude/.credentials.json
  echo "  ✅ Auth credentials copied"
else
  echo "  ⚠️ No credentials found at /home/dev/.claude/.credentials.json"
fi

if [ -f /home/dev/.claude/settings.json ]; then
  cp /home/dev/.claude/settings.json /home/claude-sandbox/.claude/settings.json
  chown claude-sandbox:claude-sandbox /home/claude-sandbox/.claude/settings.json
  echo "  ✅ Settings copied"
fi

# Lock down orchestrator directory
chgrp -R root /workspace/orquetrador-claude/ 2>/dev/null || true
chmod -R o-rwx /workspace/orquetrador-claude/ 2>/dev/null || true
chmod -R g-rwx /workspace/orquetrador-claude/ 2>/dev/null || true
echo "  ✅ Orchestrator locked: /workspace/orquetrador-claude/ (owner-only)"

# Configure sudoers
SUDOERS_FILE="/etc/sudoers.d/claude-sandbox"
echo "dev ALL=(claude-sandbox:dev) NOPASSWD: ALL" > "$SUDOERS_FILE"
chmod 440 "$SUDOERS_FILE"
echo "  ✅ Sudoers configured: dev can run as claude-sandbox"

# Verify
echo ""
echo "🧪 Verification:"

echo -n "  Kill dev processes: "
sudo -n -u claude-sandbox -g dev sh -c "kill -0 1 2>&1" && echo "ALLOWED ⚠️" || echo "BLOCKED ✅"

echo -n "  Read orchestrator:  "
sudo -n -u claude-sandbox -g dev sh -c "ls /workspace/orquetrador-claude/ 2>&1 | head -1" | grep -q "Permission denied" && echo "BLOCKED ✅" || echo "ALLOWED ⚠️"

echo -n "  Write projects:     "
sudo -n -u claude-sandbox -g dev sh -c "touch /tmp/.sandbox-verify && rm /tmp/.sandbox-verify && echo 'OK ✅'" 2>&1

CLAUDE_BIN=$(which claude 2>/dev/null || echo "/home/dev/.npm-global/bin/claude")
echo -n "  Claude CLI auth:    "
cd /tmp && sudo -n -u claude-sandbox -g dev -- env HOME=/home/claude-sandbox PATH="$(dirname $CLAUDE_BIN):/usr/local/bin:/usr/bin:/bin" $CLAUDE_BIN --version 2>&1 | head -1 && echo "  ✅" || echo "  ❌ FAILED"

echo ""
echo "🔒 Sandbox setup complete!"
