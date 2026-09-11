#!/bin/bash
# deploy.sh - Deploy static guitar chords app to Apache
# Usage:
#   ./deploy.sh

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="/mnt/d/Apache/html/sandbox/chords"
BACKUP_BASE="/mnt/d/Apache/html/sandbox/chords-backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$BACKUP_BASE/$TIMESTAMP"

echo "🚀 Starting Apache deployment..."
echo "📁 Project dir : $PROJECT_DIR"
echo "🎯 Target dir  : $TARGET_DIR"
echo ""

echo "1. Backing up existing deployment..."
if [ -d "$TARGET_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    cp -a "$TARGET_DIR"/. "$BACKUP_DIR"/
    echo "   ✅ Backup saved to: $BACKUP_DIR"
else
    echo "   ⚠️  No existing deployment found — skipping backup"
    mkdir -p "$TARGET_DIR"
fi

echo ""
echo "2. Deploying files..."
rsync -a --delete "$PROJECT_DIR/css/" "$TARGET_DIR/css/"
rsync -a --delete "$PROJECT_DIR/js/" "$TARGET_DIR/js/"
rsync -a "$PROJECT_DIR/index.html" "$TARGET_DIR/index.html"
rsync -a "$PROJECT_DIR/favicon.ico" "$TARGET_DIR/favicon.ico"
echo "   ✅ Files synced"

echo ""
echo "3. Setting permissions..."
find "$TARGET_DIR" -type d -exec chmod 755 {} \;
find "$TARGET_DIR" -type f -exec chmod 644 {} \;

echo ""
echo "🎉 Deployment complete!"
echo "🌐 Live at : http://localhost/sandbox/chords/"
echo "💾 Backup  : $BACKUP_DIR"
