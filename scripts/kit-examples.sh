#!/bin/sh
# Build the author kit examples into public/author-kit/ for local development.
# CI does the same in .github/workflows/author-kit.yml; these files are not committed.
set -eu
cd "$(dirname "$0")/.."
make -C author-kit
mkdir -p public/author-kit
cp author-kit/paper-human.pdf public/author-kit/roar2027-example-human.pdf
cp author-kit/paper-agent.pdf public/author-kit/roar2027-example-agent.pdf
cp author-kit/paper-agent.roar.json public/author-kit/roar2027-example.roar.json
cp author-kit/generation-log.jsonl public/author-kit/roar2027-example-log.jsonl
for edition in human agent; do
  out="public/author-kit/example-$edition-p1.jpg"
  if command -v pdftoppm >/dev/null 2>&1; then
    pdftoppm -jpeg -jpegopt quality=82 -f 1 -l 1 -scale-to-x 640 -scale-to-y -1 -singlefile \
      "author-kit/paper-$edition.pdf" "${out%.jpg}"
  elif command -v sips >/dev/null 2>&1; then
    sips -s format jpeg -s formatOptions 82 --resampleWidth 640 \
      "author-kit/paper-$edition.pdf" --out "$out" >/dev/null
  else
    echo "No pdftoppm or sips: skipping $out" >&2
  fi
done
ls -la public/author-kit
