#!/bin/bash

# App Store Screenshot Resizer
# Target: iPhone 6.7" (1284 x 2778)

INPUT_DIR="screenshots/raw"
OUTPUT_DIR="screenshots/ios"

mkdir -p "$OUTPUT_DIR"

echo "Resizing screenshots from $INPUT_DIR to $OUTPUT_DIR..."

for f in "$INPUT_DIR"/*.{png,jpg,jpeg}; do
    [ -e "$f" ] || continue
    filename=$(basename "$f")
    echo "Processing $filename..."
    
    # Use sips (macOS built-in) to resize
    # --resampleHeightWidth is better if aspect ratio matches
    sips --resampleHeightWidth 2778 1284 "$f" --out "$OUTPUT_DIR/$filename"
done

echo "Done! Check $OUTPUT_DIR"
